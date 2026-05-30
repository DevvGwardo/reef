#!/bin/bash
# Re-applies cgroup v2 delegation of reef.slice to uid 1000 (the container's
# `node` user) so the reef control plane can place its manager + per-capsule
# workers under REEF_CAPSULE_CGROUP_ROOT=/sys/fs/cgroup/reef.slice.
#
# Why this exists: with Docker's systemd cgroup driver, the compose service uses
# `cgroup: host` + `cgroup_parent: reef.slice`, so Docker (re)creates reef.slice
# root-owned whenever the container starts. cgroup v2 only lets an unprivileged
# process manage a subtree it owns, so reef.slice — the common ancestor of the
# container scope, the manager cgroup, and every capsule cgroup — must be owned
# by uid 1000 with cpu/memory/pids enabled in its subtree_control. Docker does
# not delegate it; we do. Crucially this must re-run on EVERY container start
# (not just boot), because a `docker compose up -d` that recreates the container
# resets reef.slice and the already-running reef would otherwise stay in
# heap-cap-only mode until the next reboot. reef-cgroup-watch.service drives that.
#
# Safe to run repeatedly and concurrently (flock). It nudges reef to re-probe by
# restarting it only when the live control plane isn't actually placed under the
# slice, and backs off so a genuinely broken host can't flap the container.
set -u

SL=/sys/fs/cgroup/reef.slice
CONTAINER=deploy-reef-host-1
LOCK=/run/reef-cgroup-delegate.lock
STAMP=/run/reef-cgroup-delegate.last-restart
RESTART_BACKOFF=60   # seconds — at most one reef restart per window
MANAGER_WAIT=10      # seconds — give a fresh reef time to probe + join

# Serialize: the boot pass and a container start event can fire together.
exec 9>"$LOCK"
flock -w 60 9 || { echo "another delegate run holds the lock; skipping"; exit 0; }

# Docker (re)creates reef.slice when the container starts; wait for it.
for _ in $(seq 1 30); do [ -d "$SL" ] && break; sleep 1; done
[ -d "$SL" ] || { echo "reef.slice absent; nothing to do"; exit 0; }

# Take ownership of the slice first, then purge stale per-capsule cgroups left by
# the previous container generation. This MUST happen before re-enabling
# controllers below: a recreate strips cpu/memory/pids from reef.slice's
# subtree_control, and re-enabling them makes the kernel re-create the limit
# files (memory.max/pids.max/cpu.max) in any *existing* children owned by root
# (us) — which the uid-1000 control plane then cannot write, so the worker gets
# placed but with no caps ("memory.max=max"). Removing the empty stale dirs lets
# reef recreate them fresh (reef-owned → writable). rmdir only succeeds on an
# empty cgroup, so a live worker is never disturbed.
chown 1000 "$SL" "$SL/cgroup.procs" "$SL/cgroup.subtree_control" 2>/dev/null || true
purged=0
for d in "$SL"/capsule-*; do
  [ -d "$d" ] || continue
  [ -n "$(cat "$d/cgroup.procs" 2>/dev/null)" ] && continue   # live; leave it
  rmdir "$d" 2>/dev/null && purged=$((purged+1))
done
[ "$purged" -gt 0 ] && echo "purged $purged stale capsule cgroup(s)"

# Enable controllers in the subtree (now that stale children are gone), then
# re-assert ownership of the delegation set.
echo "+cpu +memory +pids" > "$SL/cgroup.subtree_control" 2>/dev/null || \
  for c in cpu memory pids; do echo "+$c" > "$SL/cgroup.subtree_control" 2>/dev/null || true; done
chown 1000 "$SL" "$SL/cgroup.procs" "$SL/cgroup.subtree_control" 2>/dev/null || true

owner="$(stat -c %u "$SL" 2>/dev/null || echo '?')"
if [ "$owner" != "1000" ]; then
  # Never restart when we couldn't take ownership — reef can't be helped by a
  # bounce and we'd just flap the live site.
  echo "could not take ownership of $SL (owner=$owner); not restarting"
  exit 0
fi

# Is the live control plane actually placed under the slice? manager/cgroup.procs
# is non-empty only while a running reef process is in it — a stale manager dir
# left by a removed container has no live pids. Give a freshly-(re)started reef a
# moment to probe + join before concluding it missed the delegation.
placed=0
for _ in $(seq 1 "$MANAGER_WAIT"); do
  if [ -n "$(cat "$SL/manager/cgroup.procs" 2>/dev/null)" ]; then placed=1; break; fi
  sleep 1
done

# Even when placed, a worker that raced ahead of the purge can land in a stale
# root-owned cgroup and end up uncapped (memory.max=max). Treat any such live
# capsule as unhealthy so the restart below re-spawns it into a fresh dir.
capped_ok=1
for d in "$SL"/capsule-*; do
  [ -d "$d" ] || continue
  [ -n "$(cat "$d/cgroup.procs" 2>/dev/null)" ] || continue   # not live
  [ "$(cat "$d/memory.max" 2>/dev/null)" = "max" ] && { capped_ok=0; break; }
done

if [ "$placed" -eq 1 ] && [ "$capped_ok" -eq 1 ]; then
  echo "delegation applied + control plane placed + capsules capped: owner=$owner controllers=$(cat "$SL/cgroup.subtree_control")"
  exit 0
fi

# reef came up before delegation, hasn't joined, or a worker landed in a stale
# uncapped cgroup: bounce it once so it re-probes + re-spawns into fresh,
# reef-owned cgroups. Back off to avoid a flap loop.
now="$(date +%s)"
last="$(cat "$STAMP" 2>/dev/null || echo 0)"
if [ $((now - last)) -lt "$RESTART_BACKOFF" ]; then
  echo "control plane not placed, but restarted $((now - last))s ago — backing off"
  exit 0
fi
echo "$now" > "$STAMP"
echo "delegation applied (owner=$owner) but control plane not placed — restarting $CONTAINER so it re-probes"
docker restart "$CONTAINER" >/dev/null 2>&1 || true

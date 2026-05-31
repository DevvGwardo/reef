# reef CLI reference

Every `reef` subcommand, what it does, when to reach for it, and the flags that matter.

For the full list of any command's flags, run `reef <command> --help`. This page focuses on intent and common use.

---

## At a glance

| Command                             | What it does                                                            |
| ----------------------------------- | ----------------------------------------------------------------------- |
| [`reef new`](#reef-new)             | Scaffold a new capsule from a template or a free-form description       |
| [`reef dev`](#reef-dev)             | Start the local dev server with hot reload                              |
| [`reef deploy`](#reef-deploy)       | Ship the capsule — hosted on reef.app by default, `--local` for offline |
| [`reef start`](#reef-start)         | Run a previously-built local deploy bundle                              |
| [`reef inspect`](#reef-inspect)     | Peek at a running capsule's state (schema, sockets, ai, blob, env)      |
| [`reef logs`](#reef-logs)           | Stream a capsule's logs                                                 |
| [`reef db`](#reef-db)               | Inspect, dump, back up, and restore the capsule's SQLite                |
| [`reef fork`](#reef-fork)           | Clone a public capsule's source from a deploy URL                       |
| [`reef claim`](#reef-claim)         | Take ownership of an anonymous hosted deploy                            |
| [`reef signup`](#reef-signup)       | Friendly first-account flow — create a user + claim the current deploy  |
| [`reef host`](#reef-host)           | Run your own hosted control plane (the thing `reef deploy` deploys to)  |
| [`reef login`](#reef-login)         | Save a user API token for a control plane                               |
| [`reef dashboard`](#reef-dashboard) | Open the per-host project dashboard in your browser                     |
| [`reef user`](#reef-user)           | Create / list / promote users on a control plane (admin)                |
| [`reef token`](#reef-token)         | Rotate the saved user token                                             |
| [`reef domains`](#reef-domains)     | Attach a custom subdomain to a hosted deploy                            |
| [`reef env`](#reef-env)             | Set, unset, or list env vars on a hosted deploy                         |
| [`reef auth`](#reef-auth)           | Manage your local dev-server guest identity                             |

---

## reef new

Scaffold a new capsule directory. Accepts either a single slug (treated as a name) or a free-form description (treated as a prompt and slugified into a directory name).

**When to use:** starting a brand-new app. Combine with `--generate` if you want a locally-detected agent (hermes → claude → codex) to fill in the code from your prompt.

**Key flags:**

- `--template <name>` — start from a named template instead of the default (`todo`). Run `reef new --list-templates` to see them all. Use `--template blank` for a minimal stub scaffold.
- `--generate` — after scaffolding, invoke the first detected local agent to implement the prompt. With this flag a blank-canvas stub is written and the agent drives the design end-to-end.
- `--dir <name>` (alias `--name_flag`) — override the auto-derived directory name when passing a prompt.
- `--no-git` — skip `git init` in the new directory.

```sh
# Just a name → starts from the default local-first starter
reef new my-app

# A description → slugified to a dir, best-matching template if one is obvious
reef new "a kanban board with markdown cards"

# Same prompt, but an agent writes the code right after scaffolding
reef new "a habit tracker with streak counts" --generate

# Pick a specific template regardless of the prompt
reef new analytics-dash --template todo
```

---

## reef dev

Start the development server. Watches `server/index.ts`, `client/index.tsx`, `shared/`, and `.env.reef.server`, rebuilding on change. Serves the rendered HTML, the bundled JS, and the capsule's queries/mutations/sockets.

**When to use:** every time you're iterating on a capsule locally.

**Key flags:**

- `--port <n>` — preferred port (default `3000`). If it's busy the server walks forward up to 20 ports and tells you which one it landed on (added 0.2.5).

```sh
reef dev
# → reef dev server running at http://localhost:3000
```

---

## reef deploy

Build and ship the capsule. **Hosted by default** — bare `reef deploy` uploads to `https://reef.app`, prints the live URL, the IDE URL, and a one-time `claimToken` (saved to `.reef/deploy.json`).

The CLI picks the deploy target in this order:

1. `--local` → offline bundle (no upload). Run with [`reef start`](#reef-start).
2. `--api <url>` → use that control plane.
3. `.reef/deploy.json` already records an `apiUrl` from a previous deploy → redeploy to the same host. This is how `reef deploy` "remembers" which control plane this capsule lives on after the first deploy.
4. Otherwise → `https://reef.app` (anonymous). A `→ No deploy target set; uploading to https://reef.app …` notice prints before the upload so the behavior isn't invisible.

**Key flags:**

- `--local` — build a standalone bundle in `.reef/deploy-bundle.mjs` instead of uploading. Use for airgapped / self-host shipping.
- `--api <url>` — explicit control plane URL (e.g. `https://my-host.example.com`).
- `--token <value>` — user API token. Overrides `~/.reef/credentials.json` from `reef login`.
- `--push-env` — also upload `.env.reef.server` to the control plane (otherwise env stays local).
- `--public-inspect` — allow `/__reef/inspect` requests without a claim token (default: claim-token required).
- `--port <n>` — port baked into the local bundle (default `3000`, only meaningful with `--local`).

```sh
# Anonymous hosted deploy on reef.app — returns a live URL + claimToken
reef deploy

# Authenticated hosted deploy, env pushed
reef deploy --push-env

# Self-hosted control plane
reef deploy --api https://my-host.example.com

# Offline bundle for `reef start` / shipping yourself
reef deploy --local
```

After a hosted deploy, the URL + `claimToken` are saved to `.reef/deploy.json` (mode `0o600`). The token is one-time — claim or rotate immediately.

---

## reef start

Run a local deploy bundle previously produced by `reef deploy --local`.

**When to use:** smoke-testing a production build on your machine, or serving the bundle behind your own reverse proxy.

**Key flags:**

- `--port <n>` — port to bind (defaults to the `port` saved in `.reef/deploy.json`; falls back to `3000`).

```sh
reef deploy --local   # produces .reef/deploy-bundle.mjs
reef start            # serves it
PORT=8080 reef start  # env-var override
```

---

## reef inspect

Snapshot a running capsule: declared tables, registered sockets, AI providers, blob storage, env-var presence, runtime version.

**When to use:** confirming a deploy actually has the schema and config you expect, or debugging "is the env var set?" without rolling logs.

**Target resolution** (since 0.3.10):

1. `--local` → force `localhost:<port>`.
2. Explicit `target` positional (URL or `deployId`) → use it.
3. `.reef/deploy.json` exists with `url` + `claimToken` → **auto-target the hosted deploy**, prints `→ Inspecting <url>  (pass --local for the dev server)` to stderr.
4. Otherwise → fall back to `localhost:<port>`.

**Key flags:**

- `--port <n>` — localhost port (default `3000`).
- `--local` — force localhost even if `.reef/deploy.json` points at a remote.
- `<target>` (positional) — `deployId`, full URL, or omit to auto-target.

```sh
reef inspect                                  # auto: remote if deployed, else local
reef inspect --local                          # force local dev server
reef inspect https://abc.reef.app             # explicit remote
```

---

## reef logs

Stream stdout/stderr from a running capsule via Server-Sent Events.

**When to use:** watching live activity, or tailing a hosted deploy you just shipped.

**Target resolution:** identical to `reef inspect` — `--local` forces localhost, an explicit `--target` wins, otherwise auto-target the deploy in `.reef/deploy.json`, falling back to `localhost:<port>`.

```sh
reef logs                                     # auto-target the hosted deploy
reef logs --local                             # force local dev server
reef logs --target https://abc.reef.app       # explicit remote
```

A friendly hint fires if the chosen target refuses (`ECONNREFUSED`) — no more raw undici stack traces when the dev server isn't running.

---

## reef db

Inspect, dump, back up, and restore the capsule's SQLite database. Same target-resolution rules as `reef inspect` apply to every subcommand: `--local` to force localhost, explicit `--target`, or auto-target from `.reef/deploy.json`. Bare `reef db` now prints help cleanly (exit 0) instead of erroring with `No command specified`.

### `reef db list`

List table names declared in the schema.

```sh
reef db list
```

### `reef db dump [table]`

Dump rows. With no argument, dumps every table. With an argument, dumps that one.

```sh
reef db dump                # entire database
reef db dump habits         # one table
```

### `reef db backup --out <path>`

Snapshot the SQLite file to a local path (uses `VACUUM INTO` — safe to run on a live database).

```sh
reef db backup --out ./snap.sqlite
```

### `reef db restore --in <path>`

Upload a SQLite snapshot. The capsule writes it to `.reef/data.db.restored` — restart the process to swap it in.

```sh
reef db restore --in ./snap.sqlite
```

---

## reef fork

Clone a public capsule from a deploy URL. Pulls the source tree from `/api/deploys/<id>/source`, writes it to a new local directory, scaffolds `package.json` / `node_modules`, and you're ready for `reef dev`.

**When to use:** starting from someone else's capsule, or recovering source from a deploy you lost the local copy of.

**Key flags:**

- `<deploy>` (positional, required) — deploy URL like `https://abc.reef.app`, or a raw `deployId`.
- `--name <name>` — override the local directory name (default: derived from the capsule title or deployId).
- `--api <url>` — control-plane base URL. When omitted, the API base is derived from the deploy URL — but only `reef.app` / `*.reef.app` hosts are trusted by default. Pass `--api` explicitly to fork from any other control plane.
- `--no-git` — skip `git init`.
- `--allow-scripts` — permit forking a `package.json` that defines npm lifecycle scripts (`preinstall`/`install`/`postinstall`/`prepare`/`postprepare`). **Off by default**: those scripts run automatically on `npm install` and are an RCE vector if the upstream is hostile. The CLI refuses the fork and names the offending scripts unless this flag is passed. Since 0.3.11, the control plane also refuses to **accept** uploads that contain these scripts (POST/PUT `/api/deploys`, single-file PUT `/files/package.json`) — `--allow-scripts` only matters when forking from an older control plane or a self-hosted one that pre-dates the upload-side check.

```sh
reef fork https://abc.reef.app
reef fork https://abc.reef.app --name my-copy
```

---

## reef claim

Take ownership of an anonymous hosted deploy by presenting its `claimToken`, or reattach an already-owned deploy from a new machine. For the friendliest first-time path, use [`reef signup`](#reef-signup) — it wraps this command.

**Authorization rules:**

- **Anonymous deploy** (just created via `reef deploy`, not yet claimed): a valid `claimToken` is sufficient. Pair with `--signup <name>` to mint a new user in the same call, or with `Authorization: Bearer <token>` (an existing user account) to claim under that account.
- **Already-claimed deploy** (since 0.3.9): the `claimToken` alone is **not** sufficient to transfer ownership. The caller's bearer token must belong to the current owner or be an admin. Attempts by a different user are rejected with `403 "Deploy already owned by another account"` and audited as `deploy.claim_denied`. This closes the takeover path where a leaked `claimToken` could dispossess the original owner.

**When to use:** cross-machine ownership reattachment (the legitimate owner re-targeting from a new laptop), or explicit control over the claim step. For day-one "I just deployed and want an account," prefer `reef signup`.

**Key flags:**

- Reads `.reef/deploy.json` from the cwd for `deployId`, `apiUrl`, and `claimToken`.
- `--signup <name>` — create a new user with this username and claim in one shot (anonymous deploys only).
- `--api <url>` — override the API URL from `.reef/deploy.json`.

```sh
reef deploy
# → deployId: abc123…, claimToken: tk_…  (one-time disclosure; server stores only the hash)

reef claim                          # uses .reef/deploy.json (existing user, must be current owner)
reef claim --signup your-username   # claim + create user (anonymous deploys only)
```

Since 0.3.10, the control plane stores only `sha256(claimToken)` on disk — a backup leak no longer yields usable tokens. The plaintext lives only in your local `.reef/deploy.json` (mode `0o600`) and is returned once at create time.

---

## reef signup

Create an account on a reef control plane and claim the current anonymous deploy under it — in one command. Wraps [`reef claim --signup`](#reef-claim) with a name that matches the user's mental model.

**When to use:** day-one. You ran `reef new` and `reef deploy` and now you want an account that owns this deploy. This is the one-line shortcut.

**Key flags:**

- `<username>` (positional, required) — the username to create (matches `/^[a-z0-9_-]{1,32}$/i`).
- `--api <url>` — override the apiUrl from `.reef/deploy.json` (rarely needed — the deploy already knows where it lives).

```sh
# Three-command first-run flow
reef new my-app
reef deploy                # anonymous deploy on reef.app, gets a URL + claimToken
reef signup torrey         # account "torrey" created, this deploy claimed under it
```

If there's no `.reef/deploy.json` (you haven't deployed yet), `reef signup` refuses and points at `reef deploy`. Signup without an attached deploy is intentionally not supported — it would create a dangling account.

---

## reef host

Run your own reef control plane — the server that accepts `reef deploy`, builds bundles, hosts user workers, and serves anonymous deploys.

**When to use:** self-hosting reef instead of (or alongside) `reef.app`. Production: put it behind a TLS-terminating proxy and set `--public-base-url`.

**Key flags:**

- `--port <n>` — bind port (default `8787`).
- `--host <iface>` — interface to bind, default `127.0.0.1`. Use `0.0.0.0` to accept external traffic (only if you also have a TLS proxy).
- `--public-host <name>` — hostname used in returned deploy URLs (default `localhost`). Use this if your proxy hostname differs from `--host`.
- `--public-base-url <url>` — full external URL incl. scheme, e.g. `https://reef.example.com`. When set, deploy URLs use this base instead of `http://<public-host>:<port>`. Required when you're behind TLS.
- `--data-dir <path>` — where the control DB and deploy directories live (default `.reef-host`).
- `--anonymous-deploys` / `--no-anonymous-deploys` — toggle unauthenticated deploys (default: on).
- `--anonymous-grace <duration>` — how long an unclaimed deploy stays alive (`1h`, `30m`, `60s`). Default `1h`.
- `--anonymous-retention <duration>` — how long after termination an unclaimed deploy stays on disk. Default `7d`.
- `--anonymous-rate-per-hour <n>` — rolling-hour rate limit per IP for anonymous deploys. Default `5`.
- `--turnstile-secret <secret>` — Cloudflare Turnstile secret. When set, anonymous `POST /api/deploys` must carry a verified Turnstile token (an `x-reef-turnstile-token` header or a `turnstileToken` body field), checked against Cloudflare's siteverify. When unset (default) there is no challenge — dev/CI behaviour is unchanged. Authenticated deploys are never challenged. Also `REEF_TURNSTILE_SECRET`.
- `--trust-proxy` — read client IPs from `x-forwarded-for` (you must terminate TLS yourself; otherwise this is spoofable). Also `REEF_TRUST_PROXY_HEADERS=1`.
- `--abuse-email <addr>` — contact shown on the `/abuse` and `/security` pages.

```sh
# Local dev
reef host

# Production: bind all interfaces, public URL is HTTPS, abuse contact configured
reef host \
  --host 0.0.0.0 \
  --port 8787 \
  --public-base-url https://reef.example.com \
  --abuse-email abuse@example.com \
  --trust-proxy
```

On Node 22 LTS and later, anonymous deploys boot inside Node's permission model — `--allow-fs-read` / `--allow-fs-write` scoped to the deploy dir. On Node 20 the sandbox is disabled and `reef host` warns about it. (0.2.6 fixed the Node-24 spelling regression here.)

---

## reef admin terminate

Operator kill switch: stop a deploy's worker right now, gated by the **host token**. This is the manual companion to the grace-window sweeper — use it when a deploy is abusive and you don't want to wait for its TTL.

**When to use:** you operate the control plane and need to immediately take a specific deploy offline. For anonymous deploys it also marks the deploy terminated, so it stays down and the retention sweep deletes it on schedule. (To wipe the bytes immediately, `DELETE /api/deploys/:id` with the host token instead.)

**Key flags:**

- `<deployId>` — the deploy to terminate (positional, required).
- `--api <url>` — control plane base URL, e.g. `http://127.0.0.1:8787` (required).
- `--host-token <value>` — the host token. Defaults to `REEF_HOST_TOKEN`.

```sh
# Using REEF_HOST_TOKEN from the environment
REEF_HOST_TOKEN=... reef admin terminate 1a2b3c4d5e6f7081 --api https://reef.example.com

# Or pass the token explicitly
reef admin terminate 1a2b3c4d5e6f7081 --api http://127.0.0.1:8787 --host-token <token>
```

---

## reef login

Attach an existing user identity for a reef control plane. Saves the token to `~/.reef/credentials.json` so subsequent `reef deploy` calls don't need a `--token`.

**When to use:** you already have a token issued to you (from a previous `reef signup`, an admin minting it for you, or a self-hosted bootstrap). For first-time account creation, use [`reef signup`](#reef-signup) instead — it's a one-command path that doesn't require having a token in advance.

**Key flags:**

- `--api <url>` — control plane base URL. **Defaults to `https://reef.app`** (matches `reef deploy`).
- `--username <name>` — label for the saved credential. With `--token`, must match the token's actual user.
- `--token <value>` — attach an existing token (the common path).
- `--admin-token <value>` — admin token, used to create a new (non-admin) user on a self-hosted plane. Requires `--username`.

```sh
# Attach an existing token (most common path)
reef login --username your-username --token usr_xxxxxxxx

# Self-hosted control plane
reef login --api https://reef.example.com --username your-username --token usr_xxxxxxxx

# Self-hosted bootstrap (REEF_HOST_TOKEN must be set, or pass --admin-token)
REEF_HOST_TOKEN=<bootstrap-token> reef login --api https://reef.example.com --username admin
```

When you don't have a token yet, `reef login` errors with a three-way hint:

1. `reef signup <name>` (if you have an anonymous deploy in this directory),
2. `reef login --token <token> --username <name>` (if someone gave you a token),
3. `REEF_HOST_TOKEN=…` or `--admin-token` (self-hosted bootstrap).

---

## reef dashboard

Open the per-host project dashboard in your browser. The dashboard is served by `reef host` at `<host>/dashboard` and lists every deploy owned by the signed-in user — project title, live URL, age, status (owned / shared / anonymous), plus per-deploy actions (Open IDE, Open live app, rotate claim token, delete). It's where you go after `reef deploy` to see "what have I shipped."

**When to use:** to see all your hosted projects in one place, jump into the IDE for any of them, or rotate a claim token after sharing a deploy.

**Resolution order** (so you rarely need to pass `--api`):

1. `--api <url>` if passed.
2. `apiUrl` from `.reef/deploy.json` in the current directory.
3. The only saved credential in `~/.reef/credentials.json` (if exactly one).
4. Otherwise: refuses with a list of `reef dashboard --api <url>` invocations, one per saved credential.

**Key flags:**

- `--api <url>` — pick a specific control plane.
- `--print-url` — print the URL instead of launching a browser. Use in headless / CI environments.

```sh
# Most common — opens whichever host this project deploys to
reef dashboard

# Pick a specific control plane
reef dashboard --api https://reef.app

# Headless / CI
reef dashboard --print-url --api https://reef.example.com
```

The dashboard authenticates with your account API token (the same one `reef login` saves to `~/.reef/credentials.json`). The first visit asks you to paste it; subsequent visits remember it in `localStorage`.

---

## reef user

Admin commands for users on a control plane.

### `reef user create <username> [--admin]`

Create a new user. Requires an admin token (loaded from `~/.reef/credentials.json` or `--token`).

```sh
reef user create alice
reef user create bob --admin
```

### `reef user list`

List users on the control plane.

```sh
reef user list
```

---

## reef token

Manage the saved user API token.

### `reef token rotate --api <url>`

Rotate the saved token for an API. The new token replaces the old in `~/.reef/credentials.json`.

```sh
reef token rotate --api https://reef.example.com
```

---

## reef domains

Manage custom subdomains for hosted deploys. Bare `reef domains` now prints help cleanly (exit 0) instead of erroring with `No command specified`.

### `reef domains list --api <url>`

List subdomains configured for the authenticated user.

### `reef domains add <subdomain> --deploy <deployId> --api <url>`

Attach a subdomain to a deploy. The subdomain becomes `https://<subdomain>.<your-host>`.

```sh
reef domains add my-app --deploy abc123 --api https://reef.example.com
```

### `reef domains remove <subdomain> --api <url>`

Detach a subdomain (the deploy keeps its `<deployId>.<host>` URL).

```sh
reef domains remove my-app --api https://reef.example.com
```

---

## reef env

Manage env vars on a hosted deploy. They're written to the deploy's `.env.reef.server` and re-read on the next worker boot. Bare `reef env` now prints help cleanly (exit 0) instead of erroring with `No command specified`.

### `reef env list [deployId] --api <url>`

List env-var names (values are not returned).

### `reef env set <deployId> KEY=value [KEY2=value2 …] --api <url>`

Set one or more env vars in a single call.

```sh
reef env set abc123 OPENAI_API_KEY=sk_… SENTRY_DSN=https://… --api https://reef.app
```

### `reef env unset <deployId> KEY [KEY2 …] --api <url>`

Delete env vars.

```sh
reef env unset abc123 OLD_FLAG --api https://reef.app
```

---

## reef auth

Manage the local dev-server guest identity. Useful only against `reef dev` — production deploys use real auth.

### `reef auth as --name <name>`

Set the current guest's display name so you can simulate a logged-in user without a real OAuth flow.

```sh
reef auth as --name your-username
```

---

## Environment variables

A few useful ones:

| Variable                   | Purpose                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `REEF_SESSION_SECRET`      | Persistent session-cookie secret. Set this in `.env.reef.server` for production; without it sessions don't survive a restart. |
| `REEF_TRUST_PROXY_HEADERS` | Same effect as `--trust-proxy` on `reef host`.                                                                                |
| `REEF_PUBLIC_BASE_URL`     | Same effect as `--public-base-url` on `reef host`.                                                                            |
| `REEF_TURNSTILE_SECRET`    | Same effect as `--turnstile-secret` on `reef host` — requires a verified Cloudflare Turnstile token on anonymous deploys.     |
| `REEF_HOST_TOKEN`          | The control-plane host token. Used by `reef admin terminate` and host bootstrap.                                              |

---

## See also

- [Server API reference](./api-reference.md) — `capsule()`, `table()`, `query()`, `mutation()`, `ctx.db`, lifecycle.
- [Client API reference](./client-reference.md) — `useQuery`, `useMutation`, `useAuth`, sign-in helpers.
- [Operations guide](./operations.md) — running `reef host` in production.
- [llms-full.txt](./llms-full.txt) — single-file dump of the agent-targeted docs.

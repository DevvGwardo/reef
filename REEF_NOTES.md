# Reef Notes

## What this is

Reef is a Shopify-focused application platform forked from [Pond](https://github.com/DevvGwardo/pond). Reef keeps Pond's control-plane + worker isolation + subdomain routing + browser IDE + env/secret management + quota + auth machinery, but makes Shopify a first-class, built-in capability and the default experience.

## What changed vs Pond

### Fork source

- Forked from Pond commit `6e410bb` (feat/shopify-capsule branch), May 30, 2026
- Pond repo: `/Users/devgwardo/pond` (left untouched)
- Reef repo: `/Users/devgwardo/reef` (self-contained, own git history)

### Brand rename (whole-identifier only, never substrings)

| Before                                            | After                              |
| ------------------------------------------------- | ---------------------------------- |
| CLI: `pond`                                       | `reef`                             |
| Package: `pondsh`                                 | `reefsh`                           |
| Bin: `bin/pond.js`                                | `bin/reef.js`                      |
| Bin: `bin/pondsh.js`                              | `bin/reefsh.js`                    |
| Bin: `bin/pond-mcp.js`                            | `bin/reef-mcp.js`                  |
| Public host: `pond.run`                           | `reef.app`                         |
| Env prefix: `POND_`                               | `REEF_`                            |
| State dir: `.pond`                                | `.reef`                            |
| Credentials dir: `~/.pond`                        | `~/.reef`                          |
| Env file: `.env.pond.server`                      | `.env.reef.server`                 |
| Internal table prefix: `_pond_`                   | `_reef_`                           |
| Route prefix: `/__pond/`                          | `/__reef/`                         |
| Prometheus prefix: `pond_route_`                  | `reef_route_`                      |
| Service names: `pond-host`, `pond-cgroup`, etc.   | `reef-host`, `reef-cgroup`         |
| Internal vars: `pondSrcDir`, `pondNodeModulesDir` | `reefSrcDir`, `reefNodeModulesDir` |

### Default template: Shopify (not Todo)

- `reef new <name>` scaffolds a Shopify-connected capsule by default
- `products` query calling `ctx.shopify.graphql()` with a Preact product-table UI
- `.env.reef.server` includes `SHOPIFY_SHOP=`, `SHOPIFY_TOKEN=`, `SHOPIFY_API_VERSION=` placeholders
- `--template blank` scaffolds a minimal stub (no template, agent-only)
- `--template todo/auth-app/blog/chat/dashboard/webhook-handler` still works
- Heuristic prompt matching still works (e.g. `reef new a chat room` picks the chat template)

### `--template shopify-app` — embedded, App-Store-ready Shopify app

A second Shopify template for building **public Shopify App Store apps** (the
plain `shopify` template stays the single-store Custom App token quick-start).
Scaffolds the full public-app lifecycle, all on reef — no runtime changes, no
new deps (uses `node:crypto` + global `fetch`):

- `GET /auth` + `GET /auth/callback` — OAuth (authorization code grant), HMAC-verified, CSRF state cookie
- Multi-tenant per-shop token storage (`shops` table), not a hardcoded store
- `GET /app` — embedded entry served with App Bridge + `frame-ancestors` CSP (runs in the admin iframe)
- `GET /api/products` — example data path authenticated by the App Bridge **session token** (HS256 JWT verify)
- `POST /webhooks/app/uninstalled` + `POST /webhooks/compliance` — HMAC-verified, mandatory GDPR topics
- **Hybrid layout**: ships `shopify.app.toml` (Shopify CLI config) + an `extensions/` workspace + `README.md`.
  Reef hosts the app backend/embedded UI; **extensions** are built with the Shopify CLI and deploy to
  Shopify (not reef) — same Partner Dashboard app / `client_id`.
- New env placeholders: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_SCOPES`
- `Template.extraFiles` was added to the template system to ship the toml + extensions files
- Verified end-to-end against the dev server (OAuth redirect, CSP/App Bridge embed, HMAC accept+reject);
  covered by `test/shopify-app.test.mjs`

### ctx.shopify (inherited from Pond's Shopify implementation)

- `ctx.shopify.graphql<T>(query, variables?)` always available
- POST to `https://${SHOPIFY_SHOP}/admin/api/${API_VERSION}/graphql.json`
- API_VERSION defaults to `2025-01`, overridable via `SHOPIFY_API_VERSION`
- Reads `SHOPIFY_SHOP` and `SHOPIFY_TOKEN` from app env
- Shop domain normalization (bare name, full domain, protocol+trailing slash)
- Never logs the token
- Unit tested (9 tests in `test/shopify.test.mjs`)

### Security posture

- Outbound network blocked for anonymous deploys, allowed for claimed deploys (inherited from Pond)
- Shopify queries fail at runtime on anonymous deploys until claimed and env is set
- No sandbox/permission/network hardening was weakened
- Full documentation in `deploy/HARDENING.md` and `docs/api-reference.md`

## File map of new/edited files vs Pond

New to Reef (not in Pond):

- `scripts/rename-pond-to-reef.py` — migration/rebranding script (one-time use)
- `REEF_NOTES.md` — this file

Modified from Pond:

- All source files in `src/`, `bin/`, `client/` — branded from pond→reef
- `package.json` — name, bin entries, description, keywords
- `test/*.test.mjs` — CLI name updates, template selection updates
- `deploy/*` — service/file renames
- `docs/*` — all brand references updated
- `.gitignore` — state dir, bin entries, env file

Removed:

- `SHOPIFY_CAPSULE_NOTES.md` (Pond-specific; content absorbed into this file)

Unchanged from Pond:

- Entire architecture (control-plane, worker isolation, subdomain routing, browser IDE, env/secret management, quota, auth, MCP server)
- All dependencies in `package.json`
- `tsconfig.json`
- `LICENSE` (MIT)
- All test infrastructure

## How to test with a REAL store

1. Open your Shopify admin → Settings → Apps and sales channels → Develop apps.
2. Click "Create an app" (or use an existing Custom App).
3. Under "Admin API integration", click "Configure" and select the scopes you need (e.g. `read_products`).
4. Copy the Admin API access token.
5. Scaffold a capsule:
   ```bash
   reef new my-shop
   cd my-shop
   npm install
   ```
6. Edit `.env.reef.server`:
   ```
   SHOPIFY_SHOP=my-store.myshopify.com
   SHOPIFY_TOKEN=shpat_abc123...
   ```
7. Run `npm run dev`.
8. Open `http://localhost:3000` — you should see your products listed.
9. To test the error state, remove the env vars and restart — you should see a styled error box with setup instructions.

## Anonymous-deploy Shopify caveat

Shopify capsules require an **authenticated (claimed)** deploy. Anonymous deploys block all outbound `fetch` by design (see `deploy/HARDENING.md`). A Shopify capsule will fail at runtime if deployed anonymously. This is intentional — the same outbound-block applies to ANY capsule that uses `fetch`, not just Shopify ones.

## Assumptions made

- `SHOPIFY_API_VERSION` default `2025-01` was chosen as the current stable version at time of forking. Update it as Shopify releases new versions.
- The Shopify template uses a products-first approach because it's the most common Shopify API use case.
- The `--template blank` option is a convenience alias for generate-mode stubs without an agent invocation.
- No new npm dependencies were added for Shopify support (uses global `fetch` + Node built-ins only, matching Pond's constraint).
- Token-based standalone Shopify apps (not embedded admin/OAuth apps) — this is a deliberate architectural decision.
- Windows compatibility preserved (path utilities, cross-spawn, no POSIX-only assumptions).

## Running tests

```bash
npm run build
npm test   # or: node --test test/*.test.mjs
```

All 219 tests pass.

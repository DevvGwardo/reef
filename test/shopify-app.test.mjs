// Scaffold test for the `shopify-app` template — the embedded, App-Store-ready
// Shopify app. Verifies `reef new --template shopify-app` produces the full
// public-app skeleton: OAuth endpoints, compliance webhooks, App Bridge embed,
// the shopify.app.toml config, and the Shopify-CLI extensions/ workspace.

import { test } from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import * as path from "node:path"

const execFileP = promisify(execFile)
const REPO_ROOT = path.resolve(import.meta.dirname, "..")
const CLI_PATH = path.join(REPO_ROOT, "src", "cli.js")

test("reef new --template shopify-app scaffolds the embedded public-app skeleton", async () => {
  const parent = mkdtempSync(path.join(tmpdir(), "reef-shopify-app-"))
  try {
    await execFileP(process.execPath, [CLI_PATH, "new", "app", "--template", "shopify-app", "--no-git"], {
      cwd: parent,
      timeout: 30000,
    })
    const dir = path.join(parent, "app")

    // Backend: OAuth, embed, webhooks all present in the capsule.
    const server = readFileSync(path.join(dir, "server", "index.ts"), "utf8")
    for (const needle of [
      'import { createHmac, timingSafeEqual } from "node:crypto"',
      'path: "/auth"',
      'path: "/auth/callback"',
      'path: "/app"',
      'path: "/api/products"',
      'path: "/webhooks/app/uninstalled"',
      'path: "/webhooks/compliance"',
      "verifySessionToken",
      "frame-ancestors",
      "app-bridge.js",
    ]) {
      assert.ok(server.includes(needle), `server/index.ts missing: ${needle}`)
    }

    // Per-shop (multi-tenant) token table, not a single hardcoded store.
    assert.match(server, /shops:\s*table\(/)

    // Hybrid layout: Shopify CLI config + extensions workspace.
    const toml = readFileSync(path.join(dir, "shopify.app.toml"), "utf8")
    assert.match(toml, /embedded\s*=\s*true/)
    assert.match(toml, /compliance_topics/)
    assert.match(toml, /app\/uninstalled/)

    assert.ok(existsSync(path.join(dir, "extensions", "README.md")), "extensions/README.md missing")
    assert.ok(existsSync(path.join(dir, "README.md")), "README.md missing")

    // Env placeholders for the Partner Dashboard credentials.
    const env = readFileSync(path.join(dir, ".env.reef.server"), "utf8")
    for (const k of ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "SHOPIFY_APP_URL"]) {
      assert.ok(env.includes(k), `.env.reef.server missing: ${k}`)
    }
  } finally {
    rmSync(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})

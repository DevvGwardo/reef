export interface Template {
  name: string
  description: string
  keywords: string[]
  serverTs: string
  clientTsx: string
  envExtra?: string
  // Extra files to write into the scaffold, keyed by path relative to the
  // project root (parent dirs are created). Used by templates that need more
  // than server/client/env — e.g. the shopify-app template ships a
  // shopify.app.toml + extensions/ workspace for the Shopify CLI.
  extraFiles?: Record<string, string>
}

// Shared house style for every template:
//   - bg-black background (not zinc-950)
//   - neutral-* palette (truer grays)
//   - square corners — no rounded-* except round avatars
//   - wireframe buttons (border-white outline) for primary actions
//   - display headings (text-5xl tracking-tight) — confident, not timid
//   - mono small text for metadata (timestamps, indices, source tags)
//   - max-w-2xl centered column unless the template's signature breaks it
//
// Each template adds one signature move so they don't blur into the same
// silhouette: todo uses numbered newspaper rows, blog goes serif for the
// post body, chat is full-bleed bottom-anchored terminal-style, dashboard
// uses oversized tabular-nums numbers, webhook is pure mono log lines.

const TODO: Template = {
  name: "todo",
  description: "Default starter — single-column todo list with numbered newspaper rows.",
  keywords: [
    "todo",
    "tasks",
    "list",
    "items",
    "checklist",
    "log",
    "diary",
    "notes",
    "tracker",
    "habit",
    "journal",
    "expense",
    "weight",
    "mood",
    "default",
  ],
  serverTs: `import { capsule, mutation, query, string, table } from "reef/server";

export default capsule({
  schema: {
    messages: table({
      body: string(),
    }),
  },

  queries: {
    messages: query((ctx) =>
      ctx.db.messages.orderBy("createdAt", "desc").all()
    ),
  },

  mutations: {
    sendMessage: mutation((ctx, body: string) =>
      ctx.db.messages.insert({ body })
    ),
  },
});
`,
  clientTsx: `import { useMutation, useQuery } from "reef/client";

type Message = {
  id: string;
  body: string;
  createdAt: string;
};

export function App() {
  const { data: messages, isLoading } = useQuery<Message[]>("messages");
  const [sendMessage, { isLoading: isSending }] = useMutation<[body: string], void>("sendMessage");

  return (
    <main class="min-h-screen bg-black px-6 py-14 text-white">
      <section class="mx-auto max-w-2xl">
        <p class="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef / todo</p>
        <h1 class="mb-10 text-5xl font-bold tracking-tight">Things to do.</h1>

        <form
          class="mb-10 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("body") as HTMLInputElement;
            if (input.value.trim()) {
              void sendMessage(input.value.trim());
              input.value = "";
            }
          }}
        >
          <input
            name="body"
            class="min-w-0 flex-1 border border-neutral-700 bg-black px-3 py-2 text-white outline-none focus:border-white"
            placeholder="What needs doing?"
          />
          <button
            type="submit"
            disabled={isSending}
            class="border border-white px-4 py-2 font-medium disabled:opacity-40"
          >
            {isSending ? "Adding…" : "Add"}
          </button>
        </form>

        {isLoading ? <p class="font-mono text-xs text-neutral-500">loading…</p> : null}

        <ul class="divide-y divide-neutral-900 border-y border-neutral-900">
          {messages?.map((m, i) => (
            <li key={m.id} class="flex items-baseline gap-4 py-3">
              <span class="font-mono text-xs text-neutral-600 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <span class="flex-1">{m.body}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
`,
}

const AUTH_APP: Template = {
  name: "auth-app",
  description: "Authenticated app — Google sign-in + per-user notes. Requires GOOGLE_CLIENT_ID/SECRET.",
  keywords: ["auth", "login", "signin", "google", "user", "users", "account", "profile", "private"],
  envExtra: `GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
`,
  serverTs: `import { capsule, mutation, query, string, table } from "reef/server";

export default capsule({
  schema: {
    notes: table({
      ownerId: string(),
      body: string(),
    }),
  },

  queries: {
    myNotes: query((ctx) => {
      if (ctx.auth.isGuest) return [];
      return ctx.db.notes.where("ownerId", ctx.auth.userId).orderBy("createdAt", "desc").all();
    }),
  },

  mutations: {
    addNote: mutation((ctx, body: string) => {
      if (ctx.auth.isGuest) throw new Error("Sign in to add notes");
      return ctx.db.notes.insert({ ownerId: ctx.auth.userId, body });
    }),
  },
});
`,
  clientTsx: `import { SignInWithGoogle, signOut, useAuth, useMutation, useQuery } from "reef/client";

type Note = { id: string; body: string; createdAt: string };

function ts(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function App() {
  const auth = useAuth();
  const { data: notes } = useQuery<Note[]>("myNotes");
  const [addNote, { isLoading }] = useMutation<[body: string], void>("addNote");

  if (auth.isLoading) {
    return (
      <main class="min-h-screen bg-black px-6 py-14 text-white">
        <p class="mx-auto max-w-2xl font-mono text-xs text-neutral-500">checking session…</p>
      </main>
    );
  }

  if (auth.isGuest) {
    return (
      <main class="flex min-h-screen flex-col items-start justify-center bg-black px-6 py-14 text-white">
        <section class="mx-auto w-full max-w-2xl">
          <p class="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef / notes</p>
          <h1 class="mb-4 text-6xl font-bold tracking-tighter">Your notes.<br/>Only yours.</h1>
          <p class="mb-10 max-w-md text-lg text-neutral-400">Private to your Google account. Sign in to write something down.</p>
          <SignInWithGoogle class="inline-block border border-white px-5 py-3 font-medium hover:bg-white hover:text-black" />
        </section>
      </main>
    );
  }

  return (
    <main class="min-h-screen bg-black px-6 py-10 text-white">
      <section class="mx-auto max-w-2xl">
        <header class="mb-10 flex items-baseline justify-between gap-3">
          <h1 class="text-3xl font-bold tracking-tight">{auth.displayName ?? auth.email}</h1>
          <button onClick={() => signOut()} class="font-mono text-xs text-neutral-500 hover:text-white">sign out</button>
        </header>

        <form
          class="mb-10"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("body") as HTMLInputElement;
            if (input.value.trim()) {
              void addNote(input.value.trim());
              input.value = "";
            }
          }}
        >
          <input
            name="body"
            class="w-full border-b border-neutral-700 bg-transparent py-3 text-lg outline-none placeholder:text-neutral-600 focus:border-white"
            placeholder="What's on your mind?"
            disabled={isLoading}
          />
        </form>

        <ul class="space-y-6">
          {notes?.map((n) => (
            <li key={n.id} class="border-l-2 border-neutral-800 pl-4">
              <p class="mb-1 font-mono text-xs text-neutral-500 tabular-nums">{ts(n.createdAt)}</p>
              <p class="leading-relaxed">{n.body}</p>
            </li>
          ))}
        </ul>

        {notes && notes.length === 0 ? (
          <p class="font-mono text-xs text-neutral-600">no notes yet.</p>
        ) : null}
      </section>
    </main>
  );
}
`,
}

const BLOG: Template = {
  name: "blog",
  description: "Editorial blog — serif body type, mono bylines, no card chrome.",
  keywords: ["blog", "post", "posts", "article", "writing", "markdown", "cms"],
  serverTs: `import { capsule, mutation, query, string, table } from "reef/server";

export default capsule({
  schema: {
    posts: table({
      title: string(),
      body: string(),
      authorId: string(),
    }),
  },

  queries: {
    posts: query((ctx) => ctx.db.posts.orderBy("createdAt", "desc").all()),
  },

  mutations: {
    publish: mutation((ctx, title: string, body: string) => {
      if (ctx.auth.isGuest) throw new Error("Sign in to publish");
      return ctx.db.posts.insert({ title, body, authorId: ctx.auth.userId });
    }),
    deletePost: mutation((ctx, id: string) => {
      const row = ctx.db.posts.get(id);
      if (!row) return;
      if (row.authorId !== ctx.auth.userId) throw new Error("Not your post");
      ctx.db.posts.delete(id);
    }),
  },
});
`,
  clientTsx: `import { SignInWithGoogle, useAuth, useMutation, useQuery } from "reef/client";

type Post = { id: string; title: string; body: string; authorId: string; createdAt: string };

function dateline(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }).toUpperCase();
}

export function App() {
  const auth = useAuth();
  const { data: posts } = useQuery<Post[]>("posts");
  const [publish, { isLoading }] = useMutation<[string, string], void>("publish");
  const [deletePost] = useMutation<[string], void>("deletePost");

  return (
    <main class="min-h-screen bg-black px-6 py-14 text-white">
      <section class="mx-auto max-w-2xl">
        <header class="mb-16 flex items-baseline justify-between border-b border-neutral-800 pb-6">
          <div>
            <p class="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef / journal</p>
            <h1 class="mt-2 text-4xl font-bold tracking-tight">Field notes.</h1>
          </div>
          {auth.isGuest ? (
            <SignInWithGoogle class="border border-white px-3 py-1.5 text-sm font-medium" />
          ) : (
            <span class="font-mono text-xs text-neutral-500">{auth.displayName ?? auth.email}</span>
          )}
        </header>

        {!auth.isGuest ? (
          <form
            class="mb-16 space-y-4 border border-neutral-800 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const title = (form.elements.namedItem("title") as HTMLInputElement).value.trim();
              const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value.trim();
              if (title && body) {
                void publish(title, body);
                form.reset();
              }
            }}
          >
            <input
              name="title"
              class="w-full bg-transparent text-2xl font-bold tracking-tight outline-none placeholder:text-neutral-700"
              placeholder="Title"
            />
            <textarea
              name="body"
              rows={6}
              class="w-full resize-none bg-transparent font-serif text-base leading-relaxed outline-none placeholder:text-neutral-700"
              placeholder="Start writing…"
            />
            <button
              disabled={isLoading}
              class="border border-white px-4 py-2 text-sm font-medium hover:bg-white hover:text-black disabled:opacity-40"
            >
              Publish
            </button>
          </form>
        ) : null}

        <ul class="space-y-16">
          {posts?.map((p) => (
            <li key={p.id}>
              <p class="mb-2 font-mono text-xs tracking-widest text-neutral-500">{dateline(p.createdAt)}</p>
              <h2 class="mb-3 text-3xl font-bold tracking-tight">{p.title}</h2>
              <p class="whitespace-pre-wrap font-serif text-base leading-relaxed text-neutral-200">{p.body}</p>
              {p.authorId === auth.userId ? (
                <button
                  onClick={() => deletePost(p.id)}
                  class="mt-4 font-mono text-xs text-neutral-600 hover:text-red-400"
                >
                  delete post
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        {posts && posts.length === 0 ? (
          <p class="font-mono text-xs text-neutral-600">nothing published yet.</p>
        ) : null}
      </section>
    </main>
  );
}
`,
}

const CHAT: Template = {
  name: "chat",
  description: "Terminal-style chat — bottom-anchored composer, mono messages, color-coded senders.",
  keywords: ["chat", "messaging", "room", "talk", "im", "channel", "conversation"],
  serverTs: `import { capsule, mutation, query, string, table } from "reef/server";

export default capsule({
  schema: {
    messages: table({
      authorId: string(),
      authorName: string(),
      body: string(),
    }),
  },

  queries: {
    recent: query((ctx) => ctx.db.messages.orderBy("createdAt", "asc").limit(200).all()),
  },

  mutations: {
    send: mutation((ctx, body: string) => {
      const id = ctx.auth.isGuest ? "guest" : ctx.auth.userId;
      const name = ctx.auth.displayName ?? ctx.auth.email ?? "Anonymous";
      return ctx.db.messages.insert({ authorId: id, authorName: name, body });
    }),
  },
});
`,
  clientTsx: `import { useEffect, useRef, useState } from "preact/hooks";
import { useMutation, useQuery } from "reef/client";

type Message = { id: string; authorId: string; authorName: string; body: string; createdAt: string };

// Stable per-author tint so the eye can scan a busy room without reading
// every name. Five hand-picked hues; not "random colors", not "every
// message looks the same".
const PALETTE = ["text-amber-300", "text-emerald-300", "text-sky-300", "text-rose-300", "text-violet-300"];
function hueFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function App() {
  const { data, refetch } = useQuery<Message[]>("recent");
  const [send] = useMutation<[string], void>("send");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const t = setInterval(() => void refetch(), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data?.length]);

  return (
    <main class="flex h-screen flex-col bg-black text-white">
      <header class="flex items-baseline justify-between border-b border-neutral-900 px-6 py-4">
        <p class="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef / room</p>
        <p class="font-mono text-xs text-neutral-600 tabular-nums">{data?.length ?? 0} msgs</p>
      </header>

      <ul ref={scrollRef} class="flex-1 overflow-y-auto px-6 py-4 font-mono text-sm">
        {data?.map((m) => (
          <li key={m.id} class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-3 py-1">
            <span class={\`shrink-0 \${hueFor(m.authorId)}\`}>{m.authorName}</span>
            <span class="min-w-0 whitespace-pre-wrap break-words text-neutral-200">{m.body}</span>
            <span class="shrink-0 text-xs text-neutral-700 tabular-nums">{clockTime(m.createdAt)}</span>
          </li>
        ))}
      </ul>

      <form
        class="flex items-center gap-3 border-t border-neutral-900 px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) {
            void send(draft.trim());
            setDraft("");
          }
        }}
      >
        <span class="font-mono text-sm text-neutral-600">&gt;</span>
        <input
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          class="min-w-0 flex-1 bg-transparent font-mono text-sm text-white outline-none placeholder:text-neutral-700"
          placeholder="type and press enter…"
          autoFocus
        />
        <kbd class="border border-neutral-800 px-2 py-0.5 font-mono text-[10px] text-neutral-500">↵</kbd>
      </form>
    </main>
  );
}
`,
}

const DASHBOARD: Template = {
  name: "dashboard",
  description: "KPI dashboard — oversized tabular numbers, no card chrome.",
  keywords: ["dashboard", "metrics", "stats", "analytics", "kpi", "admin", "monitoring"],
  serverTs: `import { capsule, mutation, query, number, string, table } from "reef/server";

export default capsule({
  schema: {
    events: table({
      kind: string(),
      value: number(),
    }),
  },

  queries: {
    summary: query((ctx) => {
      const all = ctx.db.events.all() as Array<{ kind: string; value: number; createdAt: string }>;
      const byKind: Record<string, { count: number; total: number }> = {};
      for (const row of all) {
        const bucket = byKind[row.kind] ?? { count: 0, total: 0 };
        bucket.count += 1;
        bucket.total += row.value;
        byKind[row.kind] = bucket;
      }
      return {
        total: all.length,
        byKind,
        recent: all.slice(-20).reverse(),
      };
    }),
  },

  mutations: {
    record: mutation((ctx, kind: string, value: number) => ctx.db.events.insert({ kind, value })),
  },
});
`,
  clientTsx: `import { useMutation, useQuery } from "reef/client";

type Summary = {
  total: number;
  byKind: Record<string, { count: number; total: number }>;
  recent: Array<{ id: string; kind: string; value: number; createdAt: string }>;
};

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\\.0$/, "") + "k";
  return String(n);
}

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div class="border-t border-neutral-800 pt-4">
      <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">{label}</p>
      <p class="mt-2 text-6xl font-bold tracking-tighter tabular-nums">{value}</p>
      {sub ? <p class="mt-1 font-mono text-xs text-neutral-500 tabular-nums">{sub}</p> : null}
    </div>
  );
}

export function App() {
  const { data } = useQuery<Summary>("summary");
  const [record] = useMutation<[string, number], void>("record");
  const kinds = Object.entries(data?.byKind ?? {});

  return (
    <main class="min-h-screen bg-black px-6 py-12 text-white">
      <section class="mx-auto max-w-4xl">
        <header class="mb-14 flex items-end justify-between">
          <div>
            <p class="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef / dashboard</p>
            <h1 class="mt-2 text-4xl font-bold tracking-tight">Today.</h1>
          </div>
          <div class="flex gap-2 font-mono text-xs">
            <button onClick={() => record("signup", 1)} class="border border-neutral-800 px-3 py-1.5 hover:border-white">+ signup</button>
            <button onClick={() => record("revenue", 19)} class="border border-neutral-800 px-3 py-1.5 hover:border-white">+ $19</button>
          </div>
        </header>

        <section class="mb-16 grid grid-cols-2 gap-x-10 gap-y-8 md:grid-cols-3">
          <Stat label="events total" value={compact(data?.total ?? 0)} />
          {kinds.map(([kind, agg]) => (
            <Stat key={kind} label={kind} value={compact(agg.count)} sub={\`sum \${compact(agg.total)}\`} />
          ))}
        </section>

        <section>
          <p class="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-500">stream</p>
          <ul class="divide-y divide-neutral-900 border-y border-neutral-900 font-mono text-sm">
            {data?.recent.map((r) => (
              <li key={r.id} class="flex items-baseline justify-between gap-4 py-2 tabular-nums">
                <span class="text-neutral-600">{clockTime(r.createdAt)}</span>
                <span class="flex-1 text-neutral-300">{r.kind}</span>
                <span>{r.value}</span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}
`,
}

const WEBHOOK_HANDLER: Template = {
  name: "webhook-handler",
  description: "Webhook receiver + log — pure mono terminal aesthetic, no cards.",
  keywords: ["webhook", "hook", "receive", "callback", "incoming", "integration", "stripe", "github"],
  serverTs: `import { capsule, endpoint, json, query, string, table } from "reef/server";

export default capsule({
  schema: {
    deliveries: table({
      source: string(),
      body: string(),
    }),
  },

  queries: {
    deliveries: query((ctx) => ctx.db.deliveries.orderBy("createdAt", "desc").limit(100).all()),
  },

  mutations: {},

  endpoints: {
    hook: endpoint({ method: "POST", path: "/api/hook" }, async (ctx, req) => {
      const body = await req.text();
      const source = req.headers.get("x-source") ?? "unknown";
      ctx.db.deliveries.insert({ source, body });
      return json({ ok: true });
    }),
  },
});
`,
  clientTsx: `import { useQuery } from "reef/client";

type Delivery = { id: string; source: string; body: string; createdAt: string };

function logTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())} \${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}\`;
}

export function App() {
  const { data: deliveries } = useQuery<Delivery[]>("deliveries");

  return (
    <main class="min-h-screen bg-black px-6 py-12 font-mono text-sm text-white">
      <section class="mx-auto max-w-3xl">
        <header class="mb-10">
          <p class="text-xs uppercase tracking-[0.2em] text-neutral-500">reef / hook</p>
          <h1 class="mt-2 font-sans text-4xl font-bold tracking-tight">Inbound.</h1>
          <p class="mt-3 text-xs text-neutral-500">
            POST <span class="text-emerald-400">/api/hook</span> with header <span class="text-neutral-300">x-source: &lt;name&gt;</span>.
            Latest 100 deliveries are kept.
          </p>
        </header>

        {deliveries && deliveries.length === 0 ? (
          <p class="text-xs text-neutral-600">no deliveries yet. fire one with:</p>
        ) : null}
        {deliveries && deliveries.length === 0 ? (
          <pre class="mt-3 whitespace-pre-wrap text-xs text-neutral-500">
{\`curl -X POST http://localhost:3000/api/hook \\\\
  -H "x-source: test" \\\\
  -d '{"hello":"world"}'\`}
          </pre>
        ) : null}

        <ul class="space-y-6">
          {deliveries?.map((d) => (
            <li key={d.id}>
              <div class="flex items-baseline gap-3 text-xs">
                <span class="text-neutral-600 tabular-nums">{logTime(d.createdAt)}</span>
                <span class="text-emerald-400">{d.source}</span>
              </div>
              <pre class="mt-1 whitespace-pre-wrap break-all border-l-2 border-neutral-800 pl-3 text-xs text-neutral-300">{d.body}</pre>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
`,
}

const SHOPIFY: Template = {
  name: "shopify",
  description: "Shopify-connected capsule — query your store\'s Admin API with a Custom App token.",
  keywords: ["shopify", "store", "products", "ecommerce", "commerce", "orders", "inventory", "default"],
  envExtra: `SHOPIFY_SHOP=
SHOPIFY_TOKEN=
# SHOPIFY_API_VERSION=2025-01
`,
  serverTs: `import { capsule, query } from "reef/server";

// ── Shopify capsule ──────────────────────────────────────────────
// Uses ctx.shopify.graphql() to call the Shopify Admin GraphQL API.
//
// 1. In your Shopify admin: Settings → Apps and sales channels →
//    Develop apps → Create an app (or use an existing Custom App).
// 2. Under "Admin API integration", copy the Admin API access token.
// 3. Set your env vars:
//      reef env set <deployId> SHOPIFY_SHOP=my-store.myshopify.com
//      reef env set <deployId> SHOPIFY_TOKEN=shpat_abc123
//    Or for local dev, add them to .env.reef.server in this directory.
// 4. Optionally override the API version:
//      SHOPIFY_API_VERSION=2025-04
//    (defaults to 2025-01)

export default capsule({
  schema: {},

  queries: {
    products: query(async (ctx) => {
      const result = await ctx.shopify.graphql<{
        products: { edges: Array<{ node: { id: string; title: string; status: string; totalInventory: number } }> };
      }>(\`{
        products(first: 20) {
          edges {
            node {
              id
              title
              status
              totalInventory
            }
          }
        }
      }\`);
      return result.products.edges.map((e) => e.node);
    }),
  },

  mutations: {},
});
`,
  clientTsx: `import { useQuery } from "reef/client";

type Product = {
  id: string;
  title: string;
  status: string;
  totalInventory: number;
};

export function App() {
  const { data: products, isLoading, error } = useQuery<Product[]>("products");

  return (
    <main class="min-h-screen bg-black px-6 py-14 text-white">
      <section class="mx-auto max-w-4xl">
        <p class="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef / shopify</p>
        <h1 class="mb-2 text-5xl font-bold tracking-tight">Products.</h1>
        <p class="mb-10 text-sm text-neutral-500">Loaded from your Shopify store via Admin API.</p>

        {isLoading ? <p class="font-mono text-xs text-neutral-500">loading products\u2026</p> : null}

        {error ? (
          <div class="border border-red-900 bg-red-950/30 px-4 py-3 font-mono text-xs text-red-400">
            <p class="mb-1 font-semibold uppercase tracking-widest">Error</p>
            <p class="break-all">{error instanceof Error ? error.message : String(error)}</p>
            <p class="mt-2 text-neutral-500">
              Set SHOPIFY_SHOP and SHOPIFY_TOKEN in .env.reef.server, or run
              {\` reef env set <deployId> SHOPIFY_SHOP=... SHOPIFY_TOKEN=...\`} for a hosted deploy.
            </p>
          </div>
        ) : null}

        {products && products.length === 0 ? (
          <p class="font-mono text-xs text-neutral-600">No products found, or the store is empty.</p>
        ) : null}

        {products && products.length > 0 ? (
          <table class="w-full border-collapse font-mono text-sm">
            <thead>
              <tr class="border-b border-neutral-800 text-left text-xs uppercase tracking-widest text-neutral-500">
                <th class="pb-2 font-normal">Title</th>
                <th class="pb-2 font-normal">Status</th>
                <th class="pb-2 text-right font-normal tabular-nums">Inventory</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-900">
              {products.map((p) => (
                <tr key={p.id} class="hover:bg-neutral-950">
                  <td class="py-3 pr-4">{p.title}</td>
                  <td class="py-3 pr-4">
                    <span
                      class={"inline-block border px-2 py-0.5 text-[10px] uppercase tracking-widest " +
                        (p.status === "ACTIVE" ? "border-emerald-800 text-emerald-400" : "border-neutral-700 text-neutral-500")}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td class="py-3 text-right tabular-nums text-neutral-300">{p.totalInventory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <p class="mt-10 border-t border-neutral-900 pt-6 font-mono text-[10px] leading-relaxed text-neutral-600">
          Powered by the Shopify Admin API. Create a Custom App in your Shopify admin to get an access token.
        </p>
      </section>
    </main>
  );
}
`,
}

// Public, App-Store-ready embedded Shopify app. Unlike the single-store
// `shopify` template (manual Custom App token), this scaffolds the full
// public-app lifecycle: OAuth install, multi-tenant per-shop tokens, an
// App Bridge embedded UI, session-token-authed data, and the mandatory
// GDPR compliance webhooks. Pairs with a Shopify-CLI extensions/ workspace.
const SHOPIFY_APP: Template = {
  name: "shopify-app",
  description: "Embedded, App-Store-ready Shopify app — OAuth install, per-shop tokens, App Bridge, compliance webhooks.",
  keywords: ["shopify app", "app store", "embedded", "oauth", "public app", "partner", "extension", "app bridge"],
  envExtra: `# ── Shopify app (embedded, App Store ready) ──────────────────────
# Create the app in your Partner Dashboard: https://partners.shopify.com
# Then paste the Client ID / Client secret below and set your public URL.
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
# Public HTTPS URL of THIS app — your reef deploy URL, or a tunnel
# (ngrok/cloudflared) in dev. Must match application_url in shopify.app.toml.
SHOPIFY_APP_URL=
# Access scopes (comma-separated) — must match shopify.app.toml.
SHOPIFY_SCOPES=read_products
# SHOPIFY_API_VERSION=2025-01
`,
  serverTs: `import { capsule, endpoint, json, text, string, table } from "reef/server";
import { createHmac, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────
// Shopify embedded app — App Store ready.
//
// Full public-app lifecycle, all on reef:
//   GET  /auth                       start OAuth (redirect merchant to Shopify)
//   GET  /auth/callback              verify HMAC, exchange code -> per-shop token
//   GET  /app                        embedded entry (App Bridge, in the admin)
//   GET  /api/products               session-token-authed data for the embed
//   POST /webhooks/app/uninstalled   forget the shop's token
//   POST /webhooks/compliance        GDPR: customers/data_request, *_redact
//
// Setup (see README.md):
//   1. Create the app in your Partner Dashboard (partners.shopify.com).
//   2. Put SHOPIFY_API_KEY/SECRET + SHOPIFY_APP_URL in .env.reef.server.
//   3. shopify app config link && shopify app deploy   (pushes config above)
// ─────────────────────────────────────────────────────────────────────

function timingEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Validate + normalize a shop domain. Rejects anything that is not a
// well-formed <name>.myshopify.com (guards against open-redirect / SSRF).
function normShop(input: string): string | null {
  const shop = (input || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\\.myshopify\\.com$/.test(shop)) return null;
  return shop;
}

// Verify the HMAC on an OAuth redirect query (hex digest over sorted params).
function verifyQueryHmac(q: Record<string, string>, secret: string): boolean {
  if (!q.hmac) return false;
  const message = Object.keys(q)
    .filter((k) => k !== "hmac" && k !== "signature")
    .sort()
    .map((k) => k + "=" + q[k])
    .join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  return timingEqual(digest, q.hmac);
}

// Verify a webhook HMAC (base64 digest over the RAW request body).
function verifyWebhookHmac(raw: Buffer, header: string | null, secret: string): boolean {
  if (!header) return false;
  const digest = createHmac("sha256", secret).update(raw).digest("base64");
  return timingEqual(digest, header);
}

// Verify an App Bridge session token (JWT, HS256 signed with the API secret).
// Returns the shop domain on success, else null. See Shopify "session tokens".
function verifySessionToken(token: string, apiKey: string, secret: string): string | null {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  const expected = createHmac("sha256", secret).update(parts[0] + "." + parts[1]).digest("base64url");
  if (!timingEqual(expected, parts[2])) return null;
  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now) return null;
  if (payload.aud !== apiKey) return null;
  const dest = String(payload.dest || "").replace(/^https?:\\/\\//, "").replace(/\\/.*$/, "");
  return normShop(dest);
}

function redirect(location: string) {
  return text("", { status: 302, headers: { Location: location } });
}

function adminGraphql(shop: string, token: string, apiVersion: string, q: string) {
  return fetch("https://" + shop + "/admin/api/" + apiVersion + "/graphql.json", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: q }),
  });
}

export default capsule({
  schema: {
    // One row per store that installs the app — multi-tenant token storage.
    shops: table({
      shop: string(),
      accessToken: string(),
      scope: string(),
    }),
  },

  queries: {},
  mutations: {},

  endpoints: {
    // ── 1. Start OAuth ──────────────────────────────────────────────
    install: endpoint({ method: "GET", path: "/auth" }, async (ctx, req) => {
      const shop = normShop(req.query.shop || "");
      if (!shop) return text("Missing or invalid ?shop=<name>.myshopify.com", { status: 400 });
      const key = ctx.env.SHOPIFY_API_KEY;
      const appUrl = (ctx.env.SHOPIFY_APP_URL || "").replace(/\\/$/, "");
      const scopes = ctx.env.SHOPIFY_SCOPES || "read_products";
      if (!key || !appUrl) return text("Set SHOPIFY_API_KEY and SHOPIFY_APP_URL in .env.reef.server.", { status: 500 });
      const state = createHmac("sha256", ctx.env.SHOPIFY_API_SECRET || "s").update(shop + ":" + Date.now()).digest("hex");
      const authUrl =
        "https://" + shop + "/admin/oauth/authorize?client_id=" + encodeURIComponent(key) +
        "&scope=" + encodeURIComponent(scopes) +
        "&redirect_uri=" + encodeURIComponent(appUrl + "/auth/callback") +
        "&state=" + encodeURIComponent(state);
      const res = redirect(authUrl);
      res.headers["Set-Cookie"] = "reef_oauth_state=" + state + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=600";
      return res;
    }),

    // ── 2. OAuth callback: verify, exchange code, store per-shop token ─
    callback: endpoint({ method: "GET", path: "/auth/callback" }, async (ctx, req) => {
      const q = req.query;
      const secret = ctx.env.SHOPIFY_API_SECRET || "";
      const key = ctx.env.SHOPIFY_API_KEY || "";
      const shop = normShop(q.shop || "");
      if (!shop) return text("Invalid shop", { status: 400 });
      if (!verifyQueryHmac(q, secret)) return text("HMAC verification failed", { status: 401 });
      const cookie = req.headers.get("cookie") || "";
      const m = cookie.match(/reef_oauth_state=([^;]+)/);
      if (!m || !q.state || !timingEqual(m[1], q.state)) return text("State mismatch", { status: 401 });
      const tokenRes = await fetch("https://" + shop + "/admin/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: key, client_secret: secret, code: q.code }),
      });
      if (!tokenRes.ok) return text("Token exchange failed", { status: 502 });
      const tok: any = await tokenRes.json();
      const existing = ctx.db.shops.where("shop", shop).all()[0];
      if (existing) ctx.db.shops.update(existing.id, { accessToken: tok.access_token, scope: tok.scope || "" });
      else ctx.db.shops.insert({ shop, accessToken: tok.access_token, scope: tok.scope || "" });
      ctx.log.info("shopify install", { shop });
      const host = q.host ? "&host=" + encodeURIComponent(q.host) : "";
      return redirect("/app?shop=" + encodeURIComponent(shop) + host);
    }),

    // ── 3. Embedded entry — runs inside the Shopify admin iframe ───────
    app: endpoint({ method: "GET", path: "/app" }, async (ctx, req) => {
      const shop = normShop(req.query.shop || "");
      const key = ctx.env.SHOPIFY_API_KEY || "";
      if (!shop) return text("Open this app from your Shopify admin.", { status: 400 });
      // App Bridge requires the page be frameable by the admin + the shop.
      const csp = "frame-ancestors https://" + shop + " https://admin.shopify.com;";
      const html =
        "<!doctype html><html><head><meta charset=utf-8>" +
        "<meta name=viewport content=\\"width=device-width,initial-scale=1\\">" +
        "<script src=\\"https://cdn.shopify.com/shopifycloud/app-bridge.js\\" data-api-key=\\"" + key + "\\"></script>" +
        "<title>App</title></head>" +
        "<body style=\\"font-family:system-ui;margin:0;padding:24px;color:#111\\">" +
        "<h1 style=\\"font-size:20px;margin:0 0 4px\\">Products</h1>" +
        "<div id=status style=\\"color:#666;font-size:13px\\">Loading...</div>" +
        "<ul id=list style=\\"margin:16px 0 0;padding-left:18px;font-size:14px;line-height:1.7\\"></ul>" +
        "<script>" +
        "(async function(){" +
        "var s=document.getElementById('status');" +
        "try{" +
        "var t=await shopify.idToken();" +
        "var r=await fetch('/api/products',{headers:{Authorization:'Bearer '+t}});" +
        "if(!r.ok){s.textContent='Error '+r.status;return;}" +
        "var d=await r.json();" +
        "s.textContent=d.products.length+' product(s)';" +
        "var ul=document.getElementById('list');" +
        "d.products.forEach(function(p){var li=document.createElement('li');li.textContent=p.title+' ('+p.status+')';ul.appendChild(li);});" +
        "}catch(e){s.textContent='Failed: '+e.message;}" +
        "})();" +
        "</script></body></html>";
      return { body: html, status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": csp } };
    }),

    // ── 4. Data for the embed — authenticated by the App Bridge token ──
    products: endpoint({ method: "GET", path: "/api/products" }, async (ctx, req) => {
      const auth = req.headers.get("authorization") || "";
      const token = auth.replace(/^Bearer /i, "");
      const shop = verifySessionToken(token, ctx.env.SHOPIFY_API_KEY || "", ctx.env.SHOPIFY_API_SECRET || "");
      if (!shop) return json({ error: "Invalid session token" }, { status: 401 });
      const row = ctx.db.shops.where("shop", shop).all()[0];
      if (!row) return json({ error: "Shop not installed" }, { status: 404 });
      const apiVersion = ctx.env.SHOPIFY_API_VERSION || "2025-01";
      const res = await adminGraphql(shop, row.accessToken, apiVersion, "{ products(first: 20) { edges { node { id title status } } } }");
      const body: any = await res.json();
      if (!res.ok || body.errors) return json({ error: "Shopify API error" }, { status: 502 });
      const products = body.data.products.edges.map(function (e: any) { return e.node; });
      return json({ products });
    }),

    // ── 5. App uninstalled — forget the shop's token ──────────────────
    uninstalled: endpoint({ method: "POST", path: "/webhooks/app/uninstalled" }, async (ctx, req) => {
      const raw = Buffer.from(await req.bytes());
      if (!verifyWebhookHmac(raw, req.headers.get("x-shopify-hmac-sha256"), ctx.env.SHOPIFY_API_SECRET || "")) {
        return json({ error: "HMAC failed" }, { status: 401 });
      }
      const shop = normShop(req.headers.get("x-shopify-shop-domain") || "");
      if (shop) {
        const row = ctx.db.shops.where("shop", shop).all()[0];
        if (row) ctx.db.shops.delete(row.id);
      }
      return json({ ok: true });
    }),

    // ── 6. Mandatory GDPR compliance webhooks ─────────────────────────
    // Topics: customers/data_request, customers/redact, shop/redact.
    // Shopify requires a 200 with a valid HMAC. Extend the handler to
    // export/delete merchant + customer data as your data model grows.
    compliance: endpoint({ method: "POST", path: "/webhooks/compliance" }, async (ctx, req) => {
      const raw = Buffer.from(await req.bytes());
      if (!verifyWebhookHmac(raw, req.headers.get("x-shopify-hmac-sha256"), ctx.env.SHOPIFY_API_SECRET || "")) {
        return json({ error: "HMAC failed" }, { status: 401 });
      }
      ctx.log.info("shopify compliance webhook", { topic: req.headers.get("x-shopify-topic") || "" });
      return json({ ok: true });
    }),
  },
});
`,
  clientTsx: `// The "/" page is just a notice — the real UI is the embedded /app entry,
// served by the capsule with App Bridge and rendered inside the Shopify admin.
export function App() {
  return (
    <main class="min-h-screen bg-black px-6 py-16 font-sans text-white">
      <section class="mx-auto max-w-xl">
        <p class="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef / shopify app</p>
        <h1 class="mt-3 text-4xl font-bold tracking-tight">Embedded Shopify app.</h1>
        <p class="mt-4 text-sm leading-relaxed text-neutral-400">
          This is the backend for a public, App-Store-ready Shopify app. The real UI runs
          <span class="text-neutral-200"> embedded inside the Shopify admin</span> — open it from a
          store that has installed the app, not here.
        </p>
        <div class="mt-8 border border-neutral-800 p-5">
          <p class="font-mono text-xs uppercase tracking-widest text-neutral-500">Install (dev)</p>
          <p class="mt-2 break-all font-mono text-sm text-emerald-400">/auth?shop=your-store.myshopify.com</p>
          <p class="mt-3 text-xs leading-relaxed text-neutral-500">
            Set SHOPIFY_API_KEY, SHOPIFY_API_SECRET and SHOPIFY_APP_URL in .env.reef.server first.
            See README.md for the Partner Dashboard + Shopify CLI walkthrough.
          </p>
        </div>
      </section>
    </main>
  );
}
`,
  extraFiles: {
    "shopify.app.toml": `# Shopify app configuration (read by the Shopify CLI).
#
# Declares the app's identity, scopes, OAuth redirect, and the mandatory
# webhooks. The reef capsule in server/index.ts IMPLEMENTS the routes these
# point at. The reef deploy URL is your public app URL.
#
# First-time setup:
#   npm i -g @shopify/cli
#   shopify app config link     # bind to your Partner Dashboard app
#   shopify app deploy          # push this config (+ anything in extensions/)
#
# Replace application_url / redirect_urls with your reef deploy URL
# (or a tunnel URL while developing locally).

name = "my-shopify-app"
client_id = ""
application_url = "https://your-app.reef.app"
embedded = true

[access_scopes]
scopes = "read_products"

[auth]
redirect_urls = [
  "https://your-app.reef.app/auth/callback"
]

[webhooks]
api_version = "2025-01"

  [[webhooks.subscriptions]]
  topics = [ "app/uninstalled" ]
  uri = "/webhooks/app/uninstalled"

  [[webhooks.subscriptions]]
  compliance_topics = [ "customers/data_request", "customers/redact", "shop/redact" ]
  uri = "/webhooks/compliance"

[pos]
embedded = false
`,
    "extensions/README.md": `# Extensions

Shopify **extensions** (Checkout UI, Admin UI, Functions, Theme app extensions,
POS UI) run on **Shopify's** infrastructure — not on reef. Generate them here
with the Shopify CLI; they deploy to Shopify alongside this app's config:

\`\`\`bash
shopify app generate extension
shopify app deploy
\`\`\`

The reef capsule in \`../server/index.ts\` is the app's **backend + embedded UI**.
Extensions you add here share the same Partner Dashboard app (the same
\`client_id\` in \`../shopify.app.toml\`) and can call this backend over HTTPS.
`,
    "README.md": `# Shopify app (embedded, App Store ready)

A public Shopify app whose **backend + embedded admin UI** are hosted on reef,
paired with a Shopify-CLI **extensions/** workspace for any Shopify-hosted
extensions. One Partner Dashboard app drives both.

\`\`\`
this app (one client_id)
├── server/index.ts + client/index.tsx   → hosted on REEF  (OAuth, webhooks, embed)
├── shopify.app.toml                      → app config (Shopify CLI)
└── extensions/                           → built w/ Shopify CLI, deployed to SHOPIFY
\`\`\`

## What reef gives you

- \`GET /auth\` + \`GET /auth/callback\` — OAuth install, HMAC-verified, per-shop tokens
- \`GET /app\` — embedded entry (App Bridge), framed inside the Shopify admin
- \`GET /api/products\` — example data path, authenticated with the App Bridge session token
- \`POST /webhooks/app/uninstalled\` and \`POST /webhooks/compliance\` — HMAC-verified

## Setup

1. **Create the app** in your Partner Dashboard (https://partners.shopify.com).
   Copy the **Client ID** and **Client secret**.
2. **Fill in env** — edit \`.env.reef.server\`:
   \`\`\`
   SHOPIFY_API_KEY=<client id>
   SHOPIFY_API_SECRET=<client secret>
   SHOPIFY_APP_URL=https://<your-reef-deploy>   # or a tunnel URL in dev
   SHOPIFY_SCOPES=read_products
   \`\`\`
3. **Bind config** — \`npm i -g @shopify/cli && shopify app config link\`, then set
   \`application_url\` / \`redirect_urls\` in \`shopify.app.toml\` to your app URL and
   \`shopify app deploy\`.
4. **Run it** — \`npm install && npm run dev\` (local), or \`reef deploy\` (hosted).
   Install on a dev store by visiting \`/auth?shop=<store>.myshopify.com\`.

## Notes

- Local dev needs a public HTTPS URL Shopify can reach — use a tunnel
  (\`cloudflared tunnel --url http://localhost:3000\`) and put it in
  \`SHOPIFY_APP_URL\` + \`shopify.app.toml\`.
- Outbound \`fetch\` is blocked on anonymous reef deploys; claim the deploy so
  the OAuth + Admin API calls can reach Shopify.
- Extensions are a Shopify-CLI concern — see \`extensions/README.md\`.
`,
    "extensions/.gitkeep": "",
  },
}

export const TEMPLATES: Template[] = [SHOPIFY, SHOPIFY_APP, TODO, AUTH_APP, BLOG, CHAT, DASHBOARD, WEBHOOK_HANDLER]

export function getTemplate(name: string): Template | null {
  return TEMPLATES.find((t) => t.name === name) ?? null
}

// Minimal "blank canvas" scaffold for `reef new --generate`. The agent reads
// AGENTS.md and rewrites both files from scratch — we don't want a working
// template colouring its output. Not part of TEMPLATES; not selectable via
// --template; only used internally when generate mode is active.
export const STUB_SERVER_TS = `import { capsule } from "reef/server";

// Stub. The agent should design schema, queries, and mutations from the
// prompt in AGENTS.md, then replace this whole file.
export default capsule({
  schema: {},
  queries: {},
  mutations: {},
});
`

export const STUB_CLIENT_TSX = `// Stub. The agent should design the UI to match the prompt in AGENTS.md,
// then replace this whole file. Design intentionally — pick a palette,
// commit to a type scale, vary weight + spacing for hierarchy. Avoid the
// generic "zinc-950 + rounded card stack + white pill button" default.

export function App() {
  return (
    <main class="min-h-screen bg-black px-6 py-14 text-white">
      <section class="mx-auto max-w-2xl">
        <p class="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">reef</p>
        <h1 class="mb-3 text-5xl font-bold tracking-tight">Building…</h1>
        <p class="text-neutral-400">The agent hasn't replaced this stub yet.</p>
      </section>
    </main>
  );
}
`

export function pickTemplateForPrompt(prompt: string): Template {
  const text = prompt.toLowerCase()
  const scores = TEMPLATES.map((t) => {
    let score = 0
    for (const kw of t.keywords) {
      if (text.includes(kw)) score += kw.length
    }
    return { t, score }
  })
  scores.sort((a, b) => b.score - a.score)
  return scores[0].score > 0 ? scores[0].t : SHOPIFY
}

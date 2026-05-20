# MaintenanceOS — Web

The React/Vite SPA for [MaintenanceOS](https://github.com/jaysanderson/maintenanceOS),
an API-first ERP for property maintenance businesses.

This repo holds the **frontend only**. The API + MCP server live in the
companion repo and the SPA talks to them over HTTP only — no shared types,
no monorepo imports. That keeps this repo small and independently
deployable.

---

## Stack

- React 18 + TypeScript + Vite
- TailwindCSS
- React Router
- Talks to the MaintenanceOS API exclusively via `fetch('/api/...')` (see
  `src/lib/api.ts`)

## Local development

You need the API running locally on **port 4010**. In a checkout of the
[maintenanceOS](https://github.com/jaysanderson/maintenanceOS) repo:

```bash
npm install
npm run dev:api    # boots Fastify on :4010 with seeded SQLite
```

Then in this repo:

```bash
npm install
npm run dev        # Vite on :5173, proxies /api and /docs to :4010
```

Open `http://localhost:5173` and log in with `admin@maintenanceos.com.au`
/ `demo1234`. Other demo logins: `manager@`, `supervisor@`, `dispatch@`,
`tech@maintenanceos.com.au`.

## Production deploy

The default deploy path is **co-hosted on the same Fly machine as the
API** — the API repo's `Dockerfile` clones this repo at build time, runs
`npm run build`, and bundles the resulting `dist/` into the image so
Fastify serves it as static files at `/`. One `fly deploy`, one URL, no
CORS.

To pin a specific build of the SPA (e.g. for rollback), the API repo
accepts a build arg:

```bash
fly deploy --build-arg WEB_REF=<tag-or-sha>
```

### Deploying separately (optional)

The SPA is also a standard static-site build, so you can host it
anywhere if you prefer:

- **Cloudflare Pages / Vercel / Netlify** — connect this repo, build
  command `npm run build`, output `dist/`.
- **Any static host** — `npm run build` → upload `dist/`.

If you deploy independently, you'll need to:

1. Set the API base URL via a build-time env var. Edit
   `src/lib/api.ts` to read `import.meta.env.VITE_API_URL` (currently
   hardcoded to `/api`). Then build with
   `VITE_API_URL=https://maintenanceos.fly.dev/api npm run build`.
2. On the API host, add the new web origin to the `CORS_ORIGIN` env var
   (comma-separated list).

The default `/api` relative path works as long as the SPA and API share
the same origin (the co-hosted Fly path).

## Project layout

```
src/
  App.tsx              Router shell
  main.tsx             Entry
  components/
    Layout.tsx         Sidebar + header
    ui.tsx             Buttons, badges, modals
  pages/               One per route — Accounts, Work Orders, …
  lib/
    api.ts             fetch wrapper with auth + error handling
    auth.tsx           AuthContext (login, role, token)
    hooks.ts           usePagedList, useDebounced, etc.
    types.ts           Shared TS interfaces (manually kept in sync with API)
```

`src/lib/types.ts` is hand-maintained against the API's response shapes.
If the API changes, update this file. (A future improvement is to
generate it from the API's OpenAPI doc using `openapi-typescript`.)

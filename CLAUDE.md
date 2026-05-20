# CLAUDE.md — maintenanceOS-web agent notes

This repo is the React/Vite SPA for MaintenanceOS. The API + MCP server
live in the sibling repo:
https://github.com/jaysanderson/maintenanceOS.

## Quick orientation

- **Dev requires the API running locally on `:4010`.** See `README.md`.
- Talks to the API only via `fetch('/api/...')` (see `src/lib/api.ts`).
  No cross-repo imports; no shared types — `src/lib/types.ts` is
  hand-maintained against the API's response shapes.
- **Production**: this repo's `main` is cloned by the API repo's
  `Dockerfile` at image-build time, built with `npm run build`, and the
  resulting `dist/` is bundled into the Fly image. Pin a specific
  commit/tag with `fly deploy --build-arg WEB_REF=<sha>` from the **API
  repo**, not here.

## Git gotcha (same as the API repo)

Never run `git remote set-url origin <X>` or `git remote add origin`
from inside a `git worktree` — worktrees share `.git/config` and it
clobbers the parent repo's `origin`. Prefer `git push <url> branch:main`
for one-shot pushes, or add a uniquely-named remote (not `origin`).

# Motofy Garage

Motofy is a mobile-first garage workspace built around minimum mechanic input. The product prioritises plate-first vehicle identity with camera, OCR/AI, planned voice input, sensible defaults and one-tap confirmation instead of traditional data-entry-heavy garage software.

## Start here

Before changing code read these files in order:

1. `CURRENT_STATE.md` — what is live, what is on GitHub and known reconciliation work
2. `AGENTS.md` — product rules, architecture guardrails and coding-agent workflow
3. task-relevant source files only
4. `CLAUDE.md` only for deeper historical context
5. `DEPLOYMENT.md` only for release/deployment work

Do not treat an old branch, old deployment or historical document as the current source of truth.

## Current version vocabulary

- Motofy application semantic version: `v2.2.0`
- Current verified OpenAI Sites deployment revision: `v75`

These numbers describe different things. `v75` is a Sites deployment revision and does not mean Motofy `v2.75`.

See `CURRENT_STATE.md` for the current GitHub/live reconciliation status.

## Repository map

- `app/` — mobile UI, login/demo flow, scanner UI and workshop screens
- `lib/data/` — current repository layer and target Motofy domain schema
- `lib/scan-core.mjs` — framework-neutral scan logic
- `worker/index.ts` — server-side API routing for vehicle scanning
- `tests/` — repository, scan and vehicle-record tests currently present on `main`
- `public/` — Motofy icons, manifest and static assets
- `.openai/hosting.json` — temporary OpenAI Sites hosting bindings
- `build/` and `scripts/` — Sites build/install helpers
- `db/`, `drizzle/` and `drizzle.config.ts` — legacy D1/SQLite reference only, not the Motofy persistence target

## Architecture

### Persistence and auth

The decided database/auth/RLS platform is the existing Supabase project `Garage-App` in `eu-west-1`.

The application is not yet using Supabase as its active persistence layer. The current UI works through `lib/data/` and browser-local demo persistence.

The target domain-schema source of truth is:

`lib/data/schema.mjs`

The existing Supabase public schema predates that model and must be reconciled through an explicit reviewed migration. Do not reshape the app to fit legacy database columns.

### Hosting

- Current development/live preview hosting: OpenAI Sites
- Future production hosting target: user-owned Cloudflare account
- Vercel: **not used for Motofy**

Do not create or deploy a Motofy Vercel project unless the architecture decision is explicitly changed.

### AI scan

Server-side scan flow currently uses:

- Plate Recognizer Snapshot Cloud for fast plate recognition
- Gemini for vehicle make/model and plate fallback

Relevant routes on current GitHub `main`:

- `POST /api/scan/plate`
- `POST /api/scan/vehicle`
- `POST /api/scan` — compatibility alias for vehicle scan

API keys must remain deployment secrets. Never put them in browser code, Git history or committed `.env` files.

### AI Name Normalizer

The verified live Sites v75 includes AI Name Normalizer behavior that is not yet cleanly reconciled into current GitHub `main`.

The development branch `feature/ai-name-normalizer` contains useful implementation work but must **not** be merged wholesale because it diverges from the current UI baseline.

See `CURRENT_STATE.md` and `AGENTS.md` before touching this feature.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

### Important dependency-lock status

A committed `package-lock.json` is currently missing from the repository even though `scripts/install-ci.sh` and `npm ci` expect one.

Do **not** claim a deterministic clean install until the lockfile has been regenerated from the intended dependency set, reviewed and committed.

This is a baseline cleanup task and should be completed before formal CI is treated as authoritative.

## Verification

Targeted checks should be run first. Repository-wide checks when justified:

```bash
npm run lint
npm run build
npm test
```

Do not repeatedly run expensive full builds when a targeted test can answer the question.

## Release discipline

A GitHub commit is not a live deployment.

For every functional release record separately:

- application semantic version
- GitHub `main` SHA
- OpenAI Sites deployment revision
- live URL
- build/test result
- live smoke-test result

Only call a change **LIVE** after the intended source has actually been published and smoke-tested.

## Legacy and experimental work

The repository still contains historical branches created during Claude, Abacus, Grok and earlier Motofy work. They are references, not alternate sources of truth.

Current special-hold branches are documented in `CURRENT_STATE.md`. Old merged/release branches should not be used as a coding baseline.

Do not merge experimental branches into `main` without a targeted comparison against current `main`.

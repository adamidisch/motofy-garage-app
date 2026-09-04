# Motofy Garage — working notes

Motofy is a mobile-first workspace for a car garage. The interface is Greek and should remain fast and readable on an iPhone-sized screen.

## Stack

- React + TypeScript application in `app/`
- Cloudflare Worker API in `worker/index.ts`
- Cloudflare D1 schema in `db/schema.ts` with migrations in `drizzle/` — **reference only, superseded by Supabase. See ADR-002.**
- The public deployment is managed through the Sites hosting configuration in `.openai/hosting.json`.

## Important product rules

- The scan flow is camera-first: photo → identify plate and vehicle → mechanic confirms → open/create the vehicle record.
- Never substitute a hard-coded vehicle result. If recognition is uncertain or unavailable, show a clear retry/confirmation state.
- Customer and vehicle details should be kept in Motofy's own database. The present page still contains demo arrays; connect those screens to **Supabase** before calling the data persistent. Do not wire them to D1 — see ADR-002.
- API keys must be server-side secrets only. Never commit a Gemini key, `.env`, or any customer photos.
- Menus, popovers and sheets must close when tapping outside and on Escape.
- Keep controls large enough for mobile and do not use native file-input UI as the visible primary control.

## Scan API

`POST /api/scan` receives `{ imageData, mimeType }`. It calls Gemini from the Worker via `lib/scan-core.mjs`.

**Status: validated 2026-09-04.** A real photo returned `PYZ 824` / Land Rover / Range Rover at `high` confidence in 12,785 ms, and the raw REST response confirmed the parser target `steps[] -> model_output -> content[] -> text`. The earlier failure was a parser bug: the old code looked for `output_text`, which is SDK-only sugar the REST API never returns, so every successful scan was rejected as unusable. Fixed in the Phase 1 commit.

Two things to know before changing this path:

- The server timeout is 30s, and `app/page.tsx` allows **35s** client-side so the server can return its specific timeout response before the browser aborts.
- A 12.8s scan is slow for someone standing at a car. Treat latency as a known open issue, not a solved one.

Reproduce with `node scripts/probe-gemini.mjs <image>`, which talks to Gemini directly and prints the raw response. Set `SCAN_DEBUG=1` to get upstream diagnostics back from the endpoint itself. Neither can print the API key.

## Verify changes

```bash
npm run lint
npm run build
```

Test the full mobile flow: choose/take a photo, recognise it, cancel it, tap outside any overlay, and retry after an API failure.

## Architecture decisions (ADR)

Locked 2026-09-04. A future agent should treat **Decided** items as settled and
not relitigate them. **Temporary** items are deliberate stopgaps with a known
exit condition. **Open** items are not yet decided — ask before assuming.

### ADR-001 — Hosting

| | |
| --- | --- |
| Development hosting | OpenAI Sites (`.openai/hosting.json`) — **Temporary** |
| Production hosting | Our own Cloudflare account — **Decided**, not yet done |
| Vercel | **Decided: not part of the plan.** Do not propose or prepare a Vercel migration. |

Vercel Hobby permits personal, non-commercial use only, and its terms treat any
deployment that earns money for anyone who built it as commercial. Motofy is
intended for real garages, so the free tier was never viable and Pro is $20 per
seat. Cloudflare Free allows commercial use, and the app already runs on the
Cloudflare runtime, so moving there is strictly less work.

Note that the current deployment is on OpenAI's Sites platform, which runs on
Cloudflare but under OpenAI's account and control plane. We do not own the
bindings, secrets or metrics. Moving to our own Cloudflare account is therefore
a real migration step, just a much smaller one than Vercel would have been.

### ADR-002 — Database, auth and permissions

| | |
| --- | --- |
| Postgres, Auth, RLS | Supabase — **Decided** |
| Project | Existing `Garage-App`, region `eu-west-1` (Ireland) — **Decided** |
| D1 / Drizzle | Reference only — **Decided** |

Do not create another Supabase project. Do not create another database. Do not
build D1 persistence; `db/schema.ts` and `drizzle/` are kept solely as a shape
reference for the Supabase schema.

`eu-west-1` (Ireland) keeps the primary project data inside the EU and is the
correct data-residency choice for Cyprus customer records. It does not by itself
make the app GDPR compliant — that depends on the wider application, its
policies, and the data-processing setup, including any third party the data
reaches (see ADR-005). A Supabase project's region cannot be changed after
creation, so the region itself is settled and not worth revisiting.

Access Supabase over HTTPS via `@supabase/supabase-js` (PostgREST). This is a
deliberate preference, not a platform limitation: Workers do support outbound
TCP and can reach PostgreSQL directly, including through Hyperdrive. We choose
PostgREST because it carries the signed-in user's JWT, so RLS applies naturally
without us hand-rolling connection-level auth.

Ireland adds roughly 70 ms round trip from Cyprus. Design for **one round trip
per screen**, not N+1: use PostgREST embedded resources
(`/customers?select=*,vehicles(*,jobs(*))`) rather than a list query followed by
a query per row.

### ADR-003 — Plans and cost

| | |
| --- | --- |
| Cloudflare | Free — **Decided for now.** Measure real CPU before upgrading. |
| Supabase | Free during development — **Temporary** |

Do not assume Cloudflare Paid. Workers Free allows 100,000 requests/day, but the
binding constraint is **10 ms CPU per request**, and `/api/scan` parses a
base64 image out of a JSON body. Optimise and measure first; upgrade only if
measurement shows it is necessary.

CPU metrics are not visible while hosted on OpenAI Sites. Measure locally with
`wrangler dev`, or after the move to our own Cloudflare account.

Exit condition for Supabase Pro: production traffic, or the moment real customer
records need backups. **Supabase Free includes no backups and no
point-in-time recovery.** Losing a garage's customer history is not recoverable,
so backups — not the 500 MB limit — are what will justify Pro.

### ADR-004 — Images and storage

| | |
| --- | --- |
| Scan images | **Never stored automatically** — Decided |
| Storage provider | Supabase Storage now, R2 a future option — Decided |

A scan photo exists to produce plate, make and model. It is discarded after the
result. A vehicle photo is stored **only** on an explicit "save vehicle photo"
action by the mechanic.

Keep storage provider-neutral:

- The database stores **paths**, never permanent provider URLs. Convention:
  `garages/{garage_id}/vehicles/{vehicle_id}/{filename}`.
- All uploads and downloads go through a thin storage adapter interface.
  Swapping to R2 must change only the adapter implementation, never the schema.

Resize and compress client-side before upload. Store two files per photo — a
display image and a thumbnail — and load only thumbnails in list views, to
protect the 5 GB egress allowance. Delete orphaned photos when a vehicle is
deleted.

### ADR-005 — AI provider

| | |
| --- | --- |
| Scan | Gemini Flash, server-side only — Decided |
| Gemini Free tier | Development and test data only — **Temporary** |

Google's free tier terms permit using submitted data to improve their products;
the paid tier does not. **Recheck the data policy and move to a paid tier before
any real customer data reaches Gemini.**

`store: false` on the request prevents Google retaining the interaction. It does
**not** opt you out of the free-tier data policy. These are separate things and
must not be conflated.

API keys stay server-side. Never ship one to the browser, commit one, or print
one in logs or diagnostics.

### ADR-006 — Framework

| | |
| --- | --- |
| vinext | Stays — **Temporary**, audit required before production |

Do not rewrite the framework layer. `vinext` is currently at version **0.0.50**,
a pre-1.0 dependency underneath an app that will hold customer records. This is
accepted for now and must be explicitly reviewed before production, not
discovered later.

### ADR-007 — Product principle: minimum mechanic input

The mechanic is working with dirty hands on a phone. Every screen should prefer
**camera, AI, sensible defaults and one-tap confirmation** over forms and
typing.

The intended flow is:

```
SCAN → VEHICLE MATCH → CUSTOMER → JOB → HISTORY
```

Typing is a fallback, not the primary path. When adding a feature, the question
is not "where does the form go" but "what can be inferred, and what single tap
confirms it". Preserve the existing UI and interaction design; do not rewrite
working frontend code without cause.

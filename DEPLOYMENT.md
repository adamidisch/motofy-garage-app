# Motofy deployment and release workflow

This file is the operational source of truth for where Motofy code lives, what is live, and how changes move between environments.

## Canonical sources

| Item | Canonical source |
| --- | --- |
| Source code | GitHub `adamidisch/motofy-garage-app` |
| Current app version | `v2.3.1` · Unified |
| Stable development code | `main` branch |
| Development live site | https://motofy-garage-revamp.johnstaf.chatgpt.site/ |
| Development hosting | OpenAI Sites — temporary |
| Future production hosting | User-owned Cloudflare account |
| Database/Auth | Existing Supabase project `Garage-App`, `eu-west-1` |
| D1/Drizzle | Reference only, never the production persistence layer |
| Vercel | Used by the separate shared Platform Foundation AI Search service; Motofy itself is not hosted on Vercel |

## Critical rule: GitHub main is not the live site

A merge to `main` changes the canonical source code only.

The OpenAI Sites URL may continue serving an older deployment until a new Sites build is explicitly published. Never assume that the live URL contains the current `main` commit.

When debugging, always identify both:

1. the GitHub `main` commit being tested
2. the deployment that is actually live

If those are not known to match, a live-site failure does not prove the current GitHub code is broken.

## Release procedure

For every functional release:

1. Make the change on a branch.
2. Run the relevant tests.
3. Merge the validated branch to `main`.
4. Record the final `main` commit SHA.
5. Publish/redeploy that exact `main` state to the development site.
6. Open the live URL and run a smoke test.
7. Only then mark the feature as LIVE.

Do not call a change "live" merely because it was merged to GitHub.

## Repository snapshot — 2026-09-26

### GitHub baseline

Functional code baseline before this state-cleanup: `e517b0967d369c12c6f0ef62f9e63bdf87d6af9c` — **Connect Motofy to Platform Foundation AI Search**.

For the actual current `main` SHA, read GitHub directly rather than treating the baseline SHA in this document as permanently current.

The application version declared in `app/page.tsx` is `2.3.1` with release label `Unified`. Keep the package metadata aligned with the app version.

Current implementation confirmed in the source:

- Supabase Auth and Worker-mediated `garage_state` snapshot sync are present. The UI data repository still uses browser storage; migration to normalized relational Supabase reads and writes is not complete.
- The vehicle-record v2 workspace is the active vehicle record.
- The AI Name Normalizer is wired through `POST /api/name`.
- Platform Foundation AI Search is called through `worker/ai-search.ts`, which signs the server-side request. The shared Platform Foundation service currently uses Vercel; Motofy itself does not.
- The demo fixture contains 10 vehicles, 7 customers and 20 jobs.
- D1/Drizzle files and the D1 hosting binding are legacy/reference scaffolding, not Motofy's active persistence layer.

### Development live site

URL: https://motofy-garage-revamp.johnstaf.chatgpt.site/

The deployment SHA and freshness against current `main` have not been verified in this snapshot. Do not infer live status from the GitHub commit.

## Current release checks

For code changes, use the relevant checks in this order: React Doctor → Playwright → Knip → Lighthouse CI. Add Serwist only when PWA work is actually in scope. Prefer focused checks for focused changes; documentation and package-metadata-only updates do not need a full site build.

Before calling a release LIVE, verify the deployed commit and smoke-test the live URL.

## Supabase auth and state sync

The application keeps the compact mechanic login (`name` + optional four-digit
PIN) but does not trust either value in the browser. The worker derives a
stable hidden Supabase Auth identity, creates or signs it in server-side and
stores the access and refresh tokens in HttpOnly cookies. The browser never
receives the Supabase service key.

The worker requires these production runtime secrets before normal account
login can be enabled:

- `SUPABASE_URL` — `https://oafwriftgqzoaeantdtp.supabase.co`
- `SUPABASE_ANON_KEY` — the project's publishable/anon key
- `SUPABASE_SECRET_KEY` — preferred secret key, server-side only
- `MOTOFY_AUTH_PEPPER` — a random long secret used for identity derivation

`SUPABASE_SERVICE_ROLE_KEY` remains accepted only as a legacy fallback.

The `public.garage_state` table stores the current repository snapshot while
the relational repository migration is completed. It has RLS and only an
authenticated garage member can read or write its row. Demo remains local and
does not require Supabase credentials.

The live `Garage-App` Supabase project currently records **6 applied migrations**, while this repository contains **2 migration files** under `supabase/migrations/`. This is a migration-history mismatch that must be reconciled deliberately before the repository can be treated as a complete record of the live Supabase migration history. Do not infer that the two repo files represent every applied database change.


## v0.2.2 live scan experiment

Development-only dual-engine scan flow:

1. Plate Recognizer Snapshot Cloud reads the Cyprus plate first via `/api/scan/plate`.
2. Gemini runs in parallel via `/api/scan/vehicle` for vehicle make/model and remains a plate fallback.
3. The UI exposes stage-based progress and actual engine completion instead of the obsolete Base/Contrast/Sharp/Vote labels.
4. If Gemini fails but Plate Recognizer returned a plate, the scan still succeeds with the plate-only result.
5. `PLATE_RECOGNIZER_TOKEN` and `GEMINI_API_KEY` are server-side secrets only.

This is a development benchmark architecture. Provider selection is not final production architecture.

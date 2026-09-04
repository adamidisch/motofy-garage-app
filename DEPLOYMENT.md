# Motofy deployment and release workflow

This file is the operational source of truth for where Motofy code lives, what is live, and how changes move between environments.

## Canonical sources

| Item | Canonical source |
| --- | --- |
| Source code | GitHub `adamidisch/motofy-garage-app` |\n| Current app version | `v0.2.2` · Phase 1 |
| Stable development code | `main` branch |
| Development live site | https://motofy-garage-revamp.johnstaf.chatgpt.site/ |
| Development hosting | OpenAI Sites — temporary |
| Future production hosting | User-owned Cloudflare account |
| Database/Auth | Existing Supabase project `Garage-App`, `eu-west-1` |
| D1/Drizzle | Reference only, never the production persistence layer |
| Vercel | Not part of the Motofy plan |

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

## Current release status — 2026-09-04

### GitHub main

Phase 1 Gemini scan correctness fix is merged.

Validated behavior:
- real test image: `PYZ 824`
- make: `Land Rover`
- model: `Range Rover`
- confidence: `high`
- direct Gemini probe: PASS
- parser target: `steps[] -> model_output -> content[] -> text`
- backend timeout: 30s
- frontend timeout: 35s
- diagnostic probe timeout: 60s
- Gemini thinking level: low (latency patch)
- offline unit tests: 43/43 PASS

Phase 1 code merge:
`5a0dbdd7f9f77d62cb3adfd7511b817dc20435d6`

Architecture docs merge:
`52cbd4cf5ed87e05d03a7905cdef17d37a0af83c`

### Development live site

URL:
https://motofy-garage-revamp.johnstaf.chatgpt.site/

Status:
**Deployment freshness not yet confirmed against the Phase 1 `main` commits.**

The live scan currently showing the old failure should be treated first as a deployment-version mismatch until the site is republished from current `main` and retested.

## Next release gate

Before Phase 2 starts:

- deploy current `main` to the development site
- smoke-test the same `pyz824.png` through the real UI
- confirm the UI returns `PYZ 824 / Land Rover / Range Rover`

Only after that gate passes should Phase 2 begin.

## Phase 2

Phase 2 is Supabase foundation:

1. Supabase client/config
2. garages
3. garage_members
4. customers
5. vehicles
6. jobs
7. scan_events
8. Auth
9. RLS
10. replace hardcoded demo data incrementally

Do not start D1 persistence and do not migrate to Vercel.


## v0.2.2 live scan experiment

Development-only dual-engine scan flow:

1. Plate Recognizer Snapshot Cloud reads the Cyprus plate first via `/api/scan/plate`.
2. Gemini runs in parallel via `/api/scan/vehicle` for vehicle make/model and remains a plate fallback.
3. The UI exposes stage-based progress and actual engine completion instead of the obsolete Base/Contrast/Sharp/Vote labels.
4. If Gemini fails but Plate Recognizer returned a plate, the scan still succeeds with the plate-only result.
5. `PLATE_RECOGNIZER_TOKEN` and `GEMINI_API_KEY` are server-side secrets only.

This is a development benchmark architecture. Provider selection is not final production architecture.

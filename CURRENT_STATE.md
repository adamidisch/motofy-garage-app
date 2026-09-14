# Motofy — Current State

Last reconciled: 2026-09-14

This file is the short operational snapshot for humans and coding agents. Read this before making functional changes.

## Version vocabulary

Motofy currently has two different version numbers that must not be confused:

- **App semantic version:** `v2.2.0`
- **OpenAI Sites deployment revision:** `v75`

`v75` does **not** mean Motofy `v2.75`. It is the Sites deployment revision number.

## Live deployment

- Live URL: `https://motofy-garage-revamp.johnstaf.chatgpt.site/`
- Current verified Sites revision: **v75**
- Deployment status: **succeeded**
- Deployment record source snapshot: `aeed103a956a4e0ad28b8c51dcd7a832568873ae`
- That snapshot identifier does not currently resolve as a normal commit in the GitHub repository. Treat it as a deployment snapshot reference, not as the current GitHub `main` SHA.

Verified v75 behavior:

- AI Name Normalizer using Gemini
- login `antreas` -> `Αντρέα`
- login `kattos` -> `Κάττε`
- name changes from Settings are normalized
- typed name is retained as fallback if Gemini normalization fails
- logout clears the stored greeting correctly
- deploy-74 UI fixes were preserved
- build succeeded
- tests passed: **140/140**

Do not redeploy merely to make documentation match. A new deployment is a separate release action.

## GitHub state

Repository: `adamidisch/motofy-garage-app`

Canonical development branch: `main`

Current functional reference:

- latest known functional UI baseline on `main`: `c5c94476f0e08db32cb5e4fcc2a1a31909d5ea08` — plate-first hierarchy and semantic colors
- newer `main` commits are documentation/repository-hygiene updates unless explicitly described otherwise
- package semantic version is `2.2.0`
- package identity is `motofy-garage-app`
- when an exact current `main` SHA is needed read the branch head directly from GitHub rather than copying an older SHA from this document
- `main` is currently not protected
- current `main` has no authoritative CI status checks configured

### Branch policy after the baseline audit

Use `main` as the only normal development baseline.

Temporary **HOLD** branches with unique work that may still need selective reconciliation:

- `feature/ai-name-normalizer` — contains the verified Name Normalizer implementation work but must not be merged wholesale
- `v2.2.0-audit` — contains unmerged workflow-store hardening/tests and an old audit workflow; review selectively
- `grok/motofy-work` — experimental Grok UI work; do not merge or delete until explicitly reviewed

Older merged/release/diagnostic branches are archive candidates and must not be used as current baselines. They can be deleted after the three HOLD branches above have been reconciled and a final backup point exists.

## Important live/GitHub mismatch

The live v75 deployment contains the AI Name Normalizer behavior listed above while the current GitHub `main` does not presently expose the exact v75 deployment snapshot as a normal commit.

Therefore:

- **Do not assume `main` and live v75 are byte-for-byte identical yet.**
- **Do not overwrite or remove v75 Name Normalizer behavior in a future deploy.**
- Before the next functional release reconcile the verified v75 Name Normalizer behavior into the current `main` baseline and run the relevant tests.

## Code/version cleanup blockers

The baseline audit found these items that must be resolved before calling GitHub `main` a final clean release base:

1. **Missing dependency lockfile.** `package-lock.json` is not committed even though `scripts/install-ci.sh` uses it and runs `npm ci`. A deterministic clean install is not yet proven.
2. **Stale in-code version constant.** `app/page.tsx` still contains `APP_VERSION = "2.1.11"` and `APP_RELEASE = "Phase 1"`. `app/layout.tsx` currently masks that stale text with CSS pseudo-content showing `v2.2.0`. This must be replaced by one real version source rather than a visual override.
3. **Name Normalizer reconciliation.** Current `main` does not contain the clean `/api/name` + client/core/test integration represented by live v75.
4. **Workflow-store audit fixes.** `v2.2.0-audit` contains useful unmerged validation fixes and tests that need targeted review before the branch can be archived.
5. **Remaining legacy scaffold.** The obviously unused ChatGPT starter auth helper and generic starter icons have been removed. The D1/Drizzle reference scaffold remains intentionally until a deterministic clean build proves which hosting/build pieces can be safely isolated or removed.
6. **Dependency pruning.** The dependency list still includes starter-era packages. Do not remove them blindly. Run a static import audit after the lockfile is restored and verify build/tests after pruning.

Do not solve these by wholesale branch merges.

## AI Name Normalizer branch

Development branch:

- branch: `feature/ai-name-normalizer`
- head: `8545c3aae853d49bd0ccd0bc580d01ea1723103a`

That branch contains Name Normalizer work but also diverges from the current UI baseline.

**Never merge this branch wholesale into `main`.**

When reconciling port only the verified Name Normalizer functionality onto the current `main` UI baseline using the smallest safe diff.

## Product rules that must survive reconciliation

- Plate/registration number is the primary vehicle identifier and must be visually first wherever a vehicle is identified.
- Mechanic input must be minimal: camera + voice + OCR/AI + sensible defaults + one-tap confirmation.
- Voice is a planned core input mode but is not assumed implemented unless a task explicitly adds it.
- Preserve the current premium mobile-first UI unless a task explicitly requests a redesign.
- Confirmed Motofy vehicle data wins over new AI scan guesses.

## Hosting state

### OpenAI Sites

OpenAI Sites is the current Motofy development/live-preview host. The existing Motofy URL is the one recorded above.

### Vercel

The connected Vercel account currently contains no Motofy project. Motofy is **not** a Vercel application and Vercel must not be used as a deploy target for this project.

### Future production

The decided future production-hosting target remains the user's own Cloudflare account. Do not migrate hosting during ordinary feature work.

## Supabase state

Supabase project: `Garage-App`
Region: `eu-west-1`
Status at audit: `ACTIVE_HEALTHY`

The project currently has no Auth users and the Motofy application tables contain no production rows. This makes future controlled schema reconciliation easier but it does not justify unreviewed DDL changes.

Current Supabase public tables are legacy/pre-target:

- `garages`
- `garage_members`
- `customers`
- `vehicles`
- `jobs`
- `photos`

A private `vehicle-photos` storage bucket also exists.

The Supabase project currently has **no recorded migration history**, no development database branches and no Edge Functions. The next database changes must start a proper reviewed migration history rather than continuing ad-hoc schema edits.

The target application-domain schema source of truth is:

`lib/data/schema.mjs`

It currently defines the application-domain shape around:

- `garages`
- `customers`
- `vehicles`
- `jobs`
- `notes`

`garage_members`, Auth and storage infrastructure must be reconciled around that target rather than confused with application-domain tables.

### Supabase audit findings to resolve before integration

- all current application tables have RLS enabled
- current RLS policies use garage membership checks but need a final explicit authenticated-role review
- current Data API grants do not yet represent the final app CRUD access model
- security advisors flag publicly executable `SECURITY DEFINER` functions that need grant/search-path hardening
- `path_garage` needs an explicit safe `search_path`
- several composite foreign keys need covering-index review
- the private photo bucket has no explicit MIME-type or file-size restrictions yet
- the existing DB schema does not match `lib/data/schema.mjs`

Do not connect the UI to this schema until a reviewed Supabase migration/security plan is prepared and verified.

## API state

### Vehicle scan on current GitHub `main`

- `POST /api/scan/plate` — Plate Recognizer Snapshot Cloud
- `POST /api/scan/vehicle` — Gemini vehicle recognition
- `POST /api/scan` — vehicle-scan compatibility alias

Secrets remain server-side only.

At the 2026-09-14 audit the configured providers/API shapes were still current: Gemini `gemini-3.8-flash` through the Interactions API and Plate Recognizer Snapshot Cloud with Cyprus region `cy`.

### Name normalization

Live v75 has the verified Gemini Name Normalizer.
Current GitHub `main` does not yet contain the clean reconciled `/api/name` implementation.

That difference is a release blocker before the next deployment from `main`.

## Agent read order

For normal coding tasks:

1. `CURRENT_STATE.md`
2. `AGENTS.md`
3. only the task-relevant source files
4. `CLAUDE.md` only when deeper historical/architecture context is genuinely needed
5. `DEPLOYMENT.md` only for release/deployment work

Do not reread the whole repository by default.

## Release rule

A GitHub commit or merge is not proof that the Sites deployment changed.

For a functional release always record separately:

- app semantic version
- GitHub `main` SHA
- Sites deployment revision
- live URL
- build/test result
- smoke-test result

Only call a change **LIVE** after the exact intended build has been published and smoke-tested.

## Gate before the next functional release

Do not publish a new Motofy Sites release from `main` until these are complete:

1. reconcile AI Name Normalizer onto current `main` without UI regression
2. review and selectively port valid `v2.2.0-audit` workflow-store fixes/tests
3. restore and commit a deterministic dependency lockfile
4. consolidate the real app version source and remove the CSS version mask
5. run a dependency/import audit and remove confirmed unused starter dependencies/files
6. run targeted tests then full lint/build/test from the reconciled source
7. perform mobile UI smoke testing
8. record the exact final `main` SHA and publish that exact state

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

At the time this snapshot was written:

- `main` head: `07ea600b83fcdc5dd1629a0a3c11c0e183d09656`
- latest functional UI baseline on `main`: `c5c94476f0e08db32cb5e4fcc2a1a31909d5ea08` — plate-first hierarchy and semantic colors
- commits after that functional baseline are documentation-only agent-guidance updates
- package/app semantic version remains `2.2.0`

### Important temporary mismatch

The live v75 deployment contains the AI Name Normalizer behavior listed above, while the current GitHub `main` history does not presently expose the exact v75 deployment snapshot as a normal commit.

Therefore:

- **Do not assume `main` and live v75 are byte-for-byte identical yet.**
- **Do not overwrite or remove v75 Name Normalizer behavior in a future deploy.**
- Before the next functional release, reconcile the verified v75 Name Normalizer behavior into the current `main` baseline and run the full relevant tests.

## AI Name Normalizer branch

A development branch still exists:

- branch: `feature/ai-name-normalizer`
- head: `8545c3aae853d49bd0ccd0bc580d01ea1723103a`

That branch contains Name Normalizer work but also diverges from the current UI baseline and previously reverted deploy-74 UI fixes when used wholesale.

**Never merge this branch wholesale into `main`.**

When reconciling, port only the verified Name Normalizer functionality onto the current `main` UI baseline using the smallest safe diff.

## Product rules that must survive reconciliation

- Plate/registration number is the primary vehicle identifier and must be visually first wherever a vehicle is identified.
- Mechanic input must be minimal: camera + voice + OCR/AI + sensible defaults + one-tap confirmation.
- Voice is a planned core input mode but is not assumed implemented unless a task explicitly adds it.
- Preserve the current premium mobile-first UI unless a task explicitly requests a redesign.
- Confirmed Motofy vehicle data wins over new AI scan guesses.

## Data and Supabase

Supabase project: `Garage-App`
Region: `eu-west-1`

The existing Supabase public schema predates parts of the current Motofy domain model.

The target domain-schema source of truth is:

`lib/data/schema.mjs`

Do not reshape the application to fit legacy Supabase columns. Supabase must be migrated deliberately to the target schema when that integration task begins.

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

For a functional release, always record separately:

- app semantic version
- GitHub `main` SHA
- Sites deployment revision
- live URL
- build/test result
- smoke-test result

Only call a change **LIVE** after the exact intended build has been published and smoke-tested.

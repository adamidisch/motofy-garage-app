# Motofy Garage — Agent Instructions

This file is the default operating guide for any coding agent working on Motofy.
`CLAUDE.md` remains in the repository as a fuller historical/reference document.

## Current source of truth

- Repository: `adamidisch/motofy-garage-app`
- Canonical development branch: `main`
- Current app line: Motofy v2.2.0
- GitHub `main` is the code source of truth.
- A merge to GitHub is not proof that the OpenAI Sites deployment was refreshed.
- Deployment details and release procedure: `DEPLOYMENT.md`.
- Do not use old Vercel deployments as the Motofy test target.

## Product principle

Motofy is a mobile-first garage workspace designed for a mechanic working on a phone, often with dirty hands and little patience for data entry.

Prefer:
- camera
- voice
- OCR / AI
- sensible defaults
- automation
- one-tap confirmation

Avoid asking the mechanic to type, configure or navigate unless necessary.

Primary flow:

`SCAN → VEHICLE MATCH → CUSTOMER → JOB → HISTORY`

Typing is a fallback, not the primary path.

### Plate-first vehicle identity

The vehicle registration plate is the mechanic's fastest primary identifier and must be visually prioritised wherever a vehicle is shown.

- Show the plate first and make it immediately scannable in vehicle lists, work/job lists, search results, reminders, vehicle records and other vehicle-related UI.
- Do not bury the plate below customer name, make/model or job text.
- Customer name, make/model, status and other metadata are secondary to the plate in vehicle-identification contexts.
- Preserve this hierarchy unless a specific screen has a strong reason not to and the user explicitly approves the exception.

### Planned voice input

Voice is a planned core input mode for Motofy alongside camera, OCR and AI. It should reduce typing for actions such as notes, job updates, parts information and other garage workflow input.

Voice must remain optional and should not create a separate complicated interaction model. Prefer short natural commands or dictation that map into existing Motofy actions and fields.

For critical structured data or actions, show the interpreted result visually and require a simple confirmation before saving or executing it. Never silently commit uncertain speech recognition.

## UI direction

Preserve the existing product unless a task explicitly asks for redesign.

The UI should remain:
- premium and iPhone-like
- clean and professional
- mobile-first
- compact and readable
- refined in spacing and hierarchy
- production-ready

Avoid:
- oversized typography
- gamer-style controls
- unnecessary cards or decoration
- unrelated visual rewrites
- native file-input UI as the visible primary scan control

Menus, popovers and sheets must close on outside tap and Escape where relevant.

## Locked architecture decisions

Do not reopen these decisions unless the user explicitly asks.

- **Database / auth / RLS:** Supabase
- **Supabase project:** existing `Garage-App`, region `eu-west-1`
- **D1 / Drizzle:** reference only, not the persistence target
- **Hosting target:** own Cloudflare account later
- **Current development hosting:** OpenAI Sites
- **Vercel:** not part of the plan
- **Scan AI:** Gemini Flash, server-side only
- **Framework:** keep the current vinext setup for now
- **Scan images:** never stored automatically
- **Vehicle photos:** stored only after explicit save action

If more architectural history is needed for a task, consult `CLAUDE.md` selectively rather than reading it by default.

## Data rules

- Every read and write must be scoped by `garage_id`.
- The UI currently works against the repository layer in `lib/data/`.
- **`lib/data/schema.mjs` is the target Motofy domain schema and the source of truth for the shape the UI is being built against.**
- The existing Supabase `Garage-App` public schema predates parts of the current repository schema and must not be treated as the final domain model merely because tables already exist there.
- Do not reshape the app to fit legacy Supabase columns. Reconcile Supabase to the target repository schema through an explicit reviewed migration when that integration phase begins.
- Supabase should replace the repository implementation without forcing UI rewrites.
- `jobs` and `notes` belong to a vehicle. Do not duplicate `customer_id` there.
- Stored mileage is numeric (`mileage_km`).
- Plates are unique per garage using the normalized/folded plate key.
- Repository callers should receive safe copies rather than mutable stored objects.
- Undo belongs in the repository/data layer, not only inside a component.

### Scan conflict rule

A confirmed Motofy record wins over an AI scan.

If a known plate is scanned again:
- never silently overwrite confirmed `make` or `model`
- keep scan readings separately
- surface conflicts to the UI for confirmation

## Scan path

`POST /api/scan` receives:

```json
{ "imageData": "...", "mimeType": "..." }
```

The scan path is camera-first:

photo → identify plate / vehicle → mechanic confirms → open or create vehicle record

Never substitute a hard-coded vehicle result.
If recognition is uncertain or unavailable, show a clear retry or confirmation state.

Secrets and customer data rules:
- API keys are server-side only
- never commit secrets or `.env`
- never print API keys in logs
- never commit customer photos

## Agent workflow — token and credit efficiency

Use targeted inspection. Do not reread the whole repository for every task.

For each task:

1. Read the task and identify the smallest likely file set.
2. Read only those files and their direct dependencies.
3. Check this `AGENTS.md` first.
4. Open `CLAUDE.md` only if the task touches architecture, deployment, scan internals or historical decisions not covered here.
5. Preserve existing working behavior unless the task explicitly changes it.
6. Make the smallest safe diff.
7. Do not perform unrelated refactors, renames, dependency upgrades or formatting sweeps.
8. Reuse previous findings when the baseline has not changed.
9. Run targeted checks first. Run broader checks only when justified by the change.
10. Before finishing, inspect the actual diff for accidental changes.

If the baseline changed since the previous task, verify the relevant files again rather than assuming old context is current.

## Do not do without explicit instruction

- Do not redesign the whole app.
- Do not rewrite the scanner.
- Do not create another database or Supabase project.
- Do not migrate to Vercel.
- Do not change framework architecture.
- Do not merge or deploy unrelated work.
- Do not expose secrets to the browser.
- Do not replace real data paths with hard-coded demo results.

## Verification

At minimum, use the checks relevant to the files changed.

Repository-wide verification when justified:

```bash
npm run lint
npm run build
```

For mobile/UI changes, verify the affected flow on an iPhone-sized viewport.
For scan changes, verify success, cancel/retry and API failure states.
For overlays, verify outside-tap and Escape behavior where applicable.

## Completion format for agents

Return a concise report with:

- files changed
- what changed
- regression risk
- checks/tests run
- any unresolved issue that blocks confidence

Do not produce a long repository recap unless requested.

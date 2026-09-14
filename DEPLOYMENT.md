# Motofy deployment and release workflow

This file is the operational source of truth for how Motofy moves from GitHub to the live development Site.
For the concise current snapshot, read `CURRENT_STATE.md` first.

## Current deployment state

| Item | Current state |
| --- | --- |
| Repository | `adamidisch/motofy-garage-app` |
| Development branch | `main` |
| App semantic version | `v2.2.0` |
| Live Sites revision | **v75** |
| Live URL | `https://motofy-garage-revamp.johnstaf.chatgpt.site/` |
| Development hosting | OpenAI Sites — temporary |
| Future production hosting | User-owned Cloudflare account |
| Database/Auth target | Existing Supabase project `Garage-App`, `eu-west-1` |
| D1/Drizzle | Reference only |
| Vercel | Not part of the Motofy plan |

## Version terminology

Keep these identifiers separate:

- `v2.2.0` = Motofy application/package semantic version
- `v75` = OpenAI Sites deployment revision
- Git SHA = GitHub source revision

A Sites revision is not an application semantic version.

## Current live release — Sites v75

Status: **deployed successfully**

Deployment record source snapshot:

`aeed103a956a4e0ad28b8c51dcd7a832568873ae`

That snapshot identifier does not currently resolve as a normal commit in the GitHub repository. Treat it as the recorded Sites source snapshot reference rather than the current GitHub `main` SHA.

Verified v75 behavior:

- AI Name Normalizer via Gemini
- `antreas` -> `Αντρέα`
- `kattos` -> `Κάττε`
- Settings name changes use normalization
- typed name remains the fallback when Gemini fails
- logout clears the greeting correctly
- deploy-74 UI fixes remain intact
- build succeeded
- tests: **140/140 passed**

## GitHub/live reconciliation status

The latest known functional UI baseline on `main` is:

`c5c94476f0e08db32cb5e4fcc2a1a31909d5ea08`

This is the plate-first hierarchy and semantic-colors baseline. Newer `main` commits may be documentation-only and should not be mistaken for new functional releases.

The branch:

`feature/ai-name-normalizer`

currently points to:

`8545c3aae853d49bd0ccd0bc580d01ea1723103a`

It contains the Name Normalizer work but diverges from the current UI baseline and previously reverted deploy-74 UI fixes when used wholesale.

### Reconciliation rule

Before the next functional release:

1. Start from current `main`.
2. Port only the verified AI Name Normalizer functionality from the feature work.
3. Preserve the current plate-first/UI baseline.
4. Do not merge `feature/ai-name-normalizer` wholesale.
5. Run the relevant targeted tests and then the complete test suite.
6. Compare the final diff for accidental UI changes.
7. Only after the GitHub source represents the intended live feature set should the next release be published.

Until that reconciliation is completed, do not assume `main` and live v75 are byte-for-byte identical.

## Critical rule: GitHub main is not the live site

A merge or commit to `main` changes GitHub only.

It does **not** prove that OpenAI Sites has been rebuilt or republished.

When debugging or releasing, identify separately:

1. application semantic version
2. GitHub `main` SHA
3. Sites deployment revision
4. live URL
5. test result
6. smoke-test result

If GitHub and the live deployment are not known to match, a live-site issue does not prove that current GitHub code is broken and a GitHub fix does not prove the live Site contains it.

## Release procedure

For every functional release:

1. Make the smallest safe change from the current reconciled `main` baseline.
2. Run targeted tests for the changed feature.
3. Run repository-wide verification when justified:

```bash
npm run lint
npm run build
npm test
```

4. Review the actual diff for unintended changes.
5. Merge validated work to `main`.
6. Record the final GitHub SHA.
7. Publish/redeploy that exact intended source state to the existing Motofy Site.
8. Record the new Sites revision.
9. Smoke-test the live URL on a mobile-sized viewport and the affected flow.
10. Only then call the change **LIVE**.

## Deployment safety

- Do not use old Vercel deployments as Motofy test targets.
- Do not create a second production database or Supabase project.
- Do not expose API keys or secrets to the browser.
- Do not deploy experimental branches over the existing live Site merely for preview.
- Use a separate preview environment when a branch must be visually checked before merge.
- Preserve the existing live URL unless the user explicitly requests otherwise.

## Supabase note

The existing Supabase public schema predates parts of the current Motofy repository schema.

Target domain schema:

`lib/data/schema.mjs`

Supabase migration must reconcile the database to that target model. Do not redesign the application around legacy Supabase columns merely because they already exist.

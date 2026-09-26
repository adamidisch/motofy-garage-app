# Motofy Garage — agent rules

Read this file and [CURRENT_STATE.md](CURRENT_STATE.md) before changing the project. Check [CLAUDE.md](CLAUDE.md) for product and architecture decisions and [DEPLOYMENT.md](DEPLOYMENT.md) for release handling. User instructions take precedence.

## Product and interface

- Keep the mechanic workflow plate-first.
- Prefer camera, voice, AI, sensible defaults and one-tap confirmation to typing.
- Use a premium, compact, mobile-first interface with familiar platform patterns.
- Confirmed vehicle data always wins over AI scan guesses. Never silently overwrite confirmed make, model, plate or mileage with scan output.
- Preserve existing functionality and behavior while making requested changes.

## Architecture

- GitHub `main` is the canonical code source. Work on a focused branch.
- Supabase project `Garage-App` is the chosen database and auth service. Supabase Auth and Worker-mediated `garage_state` snapshot sync already exist. The full normalized relational repository migration remains incomplete.
- D1/Drizzle and the D1 hosting binding are legacy/reference scaffolding. Do not make them the active persistence layer.
- Motofy is currently developed through OpenAI Sites hosting. GitHub and live deployment are separate: a commit or merge does not prove the live site was redeployed.
- Platform Foundation AI Search is a separate shared service. Motofy calls it through the signed server-side adapter in `worker/ai-search.ts`; its shared service currently uses Vercel. Motofy itself is not hosted on Vercel.
- The AI Name Normalizer is already part of `main` through `POST /api/name`.

## Change discipline

- Make small, targeted diffs. Avoid wholesale merges and unrelated cleanup.
- Do not reset or force-push branches. Do not publish or redeploy unless the user asks.
- Preserve secrets server-side. Never put keys in client bundles, committed files or logs.
- Treat demo reset and seed behavior as garage-scoped; never erase real garage data.

## Verification

- For product/code changes, use the relevant quality steps in this order: **React Doctor → Playwright → Knip → Lighthouse CI**.
- Add **Serwist only when PWA work is in scope**; do not add PWA infrastructure prematurely.
- Match verification to the diff. Use focused checks for small changes and avoid unnecessary full builds or repeated test runs.
- A change is not LIVE until the actual deployed version is verified and smoke-tested.

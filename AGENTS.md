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
- Platform Foundation AI Search is a separate shared service. Motofy already calls it through the signed server-side adapter in `worker/ai-search.ts`; its shared service currently uses Vercel. Motofy itself is not hosted on Vercel.
- The AI Name Normalizer is already part of `main` through `POST /api/name`.

### Platform Foundation AI Search contract

Platform Foundation provides one shared AI service for multiple projects, but the active project owns the data boundary and the execution boundary.

- Every project uses its own `app_id`, server-side secret, project context and allowlisted capabilities/actions.
- Motofy may provide only Motofy context. Never mix or expose data from another project.
- The shared AI service must not connect directly to the Motofy database. Motofy decides what limited context is sent.
- For project-data questions, Motofy resolves the relevant local/project data and supplies only the context required for the request.
- For commands such as “add a new vehicle”, AI may identify an intent/action, but Motofy must execute the existing native Motofy flow rather than letting the shared service mutate application state directly.
- For write operations such as adding a note, the target entity must be resolved first. If the vehicle, job or other target is ambiguous, ask for clarification rather than guessing or writing to the wrong record.
- General questions may be answered as general AI requests without unnecessary project-data lookup or mutation.
- Camera, voice and AI Search should converge on the same intent/action layer where practical so the mechanic has to type as little as possible.
- Treat the intent/action model as an architecture contract unless a capability is explicitly confirmed as implemented in `CURRENT_STATE.md`; do not assume every planned action already exists.

**Core rule:** AI may interpret and propose; the active project owns data access and execution.

## Change discipline

- Make small, targeted diffs. Avoid wholesale merges and unrelated cleanup.
- Do not reset or force-push branches. Do not publish or redeploy unless the user asks.
- Preserve secrets server-side. Never put keys in client bundles, committed files or logs.
- Treat demo reset and seed behavior as garage-scoped; never erase real garage data.

## Verification

- For product/code changes, use the relevant quality steps in this order: **React Doctor → Playwright → Knip → Lighthouse CI**.
- **React Doctor is a read-only audit** before significant React changes or a full audit. Confirm every finding against the actual code before acting on it, never auto-apply all findings and never let the audit itself change live or production state.
- Add **Serwist only when PWA work is in scope**; do not add PWA infrastructure prematurely.
- Match verification to the diff. Use focused checks for small changes and avoid unnecessary full builds or repeated test runs.
- A change is not LIVE until the actual deployed version is verified and smoke-tested.

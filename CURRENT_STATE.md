# Motofy Garage — current state

**Snapshot date:** 2026-09-26  
**Repository:** `adamidisch/motofy-garage-app`  
**Canonical branch:** `main`  
**Functional code baseline before this state-cleanup:** `e517b0967d369c12c6f0ef62f9e63bdf87d6af9c` — Connect Motofy to Platform Foundation AI Search  
**Application version on this preview branch:** `2.4.0` · release label `Mini AI Preview`

For the actual current `main` SHA, read GitHub directly rather than treating a SHA in this document as permanently current.

## Current implementation

- Preview branch `feat/mini-ai-preview-v2.4.0` adds an inline Mini AI field on Home. Deterministic commands cover existing Add Vehicle, plate lookup, completed oil-change jobs, today's jobs, a monthly make filter and note preparation through the existing creation flow. Voice fills the same text field when the browser supports recognition.
- The signed adapter sends a fixed capability list for Platform Foundation v1.2 interpretation. General AI questions send empty app context. The shared provider path requires the Platform Foundation v1.2 deployment, Neon quota setup and deliberate provider configuration. The local flows work without those services.
- This preview is **not merged to main or verified live**. Browser/mobile visual testing remains a release gate.

- The dashboard polish and redesigned vehicle-record v2 workspace are in `main`.
- Demo data is seeded from `lib/data/seed.mjs`: 10 vehicles, 7 customers and 20 jobs.
- The AI Name Normalizer is implemented through the Worker route `POST /api/name`.
- Supabase Auth and the Worker-mediated `public.garage_state` snapshot sync are implemented. Auth tokens are held in HttpOnly cookies and the browser does not receive the Supabase secret key.
- The UI repository still reads and writes a garage-scoped browser-storage dataset and syncs its snapshot to Supabase for authenticated users. The full migration to normalized relational Supabase reads and writes is not complete.
- Platform Foundation AI Search is implemented through `worker/ai-search.ts` and `POST /api/ai-search`. Motofy signs requests server-side using the app secret. The shared Platform Foundation service currently uses Vercel; Motofy itself uses OpenAI Sites hosting, not Vercel.
- D1/Drizzle schema, migrations and the D1 hosting binding remain legacy/reference scaffolding.

## Platform Foundation AI Search contract

The current signed `/api/ai-search` integration is the implemented transport to the shared Platform Foundation AI service. The broader intent/action behavior below is the architecture contract and should not be treated as fully implemented unless the relevant Motofy capability is confirmed in source.

- Platform Foundation is one shared AI service that can serve multiple projects.
- Each project has its own `app_id`, server-side secret, project context and allowlisted capabilities/actions.
- Motofy supplies only Motofy context. Project data must remain isolated from every other app using the shared service.
- The shared AI service does not own Motofy's database access. Motofy selects the limited context that may be sent and retains control of reads and writes.
- A Motofy command such as “add a new vehicle” should resolve to an intent/action that opens or invokes the existing Motofy vehicle-creation flow.
- A write request such as adding a note must first resolve the intended vehicle, job or other entity. If the target is ambiguous, clarification is required before any write.
- General questions may be answered as general AI requests without unnecessary Motofy data access or mutation.
- Camera, voice and AI Search should share the same intent/action layer where practical to minimize mechanic typing.

**Core rule:** AI may interpret and propose; the active project owns data access and execution.

## Deployment status

The development URL recorded in deployment docs is https://motofy-garage-revamp.johnstaf.chatgpt.site/. Its deployed commit and freshness against the functional code baseline recorded above are **not verified here**. GitHub and the live deployment must be checked separately.

## Decisions and working rules

- GitHub `main` is canonical for source code.
- Keep the workflow plate-first and minimize typing with camera, voice, AI, sensible defaults and one-tap confirmation.
- Confirmed vehicle data outranks AI scan output.
- Keep UI premium, compact and mobile-first.
- Prefer small, targeted diffs; avoid wholesale merges.
- Keep D1/Drizzle as reference only while Supabase remains the chosen backend.
- Follow the verification order in `AGENTS.md`: React Doctor → Playwright → Knip → Lighthouse CI. Use Serwist only once PWA work begins.
- Keep the optional ChatGPT Sign-In helper documented and unchanged until its future use is decided.


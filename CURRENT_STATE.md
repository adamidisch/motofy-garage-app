# Motofy Garage — current state

**Snapshot date:** 2026-09-26  
**Repository:** `adamidisch/motofy-garage-app`  
**Canonical branch:** `main`  
**Snapshot commit:** `e517b0967d369c12c6f0ef62f9e63bdf87d6af9c` — Connect Motofy to Platform Foundation AI Search  
**Application version:** `2.3.1` · release label `Unified`

## Current implementation

- The dashboard polish and redesigned vehicle-record v2 workspace are in `main`.
- Demo data is seeded from `lib/data/seed.mjs`: 10 vehicles, 7 customers and 20 jobs.
- The AI Name Normalizer is implemented through the Worker route `POST /api/name`.
- Supabase Auth and the Worker-mediated `public.garage_state` snapshot sync are implemented. Auth tokens are held in HttpOnly cookies and the browser does not receive the Supabase secret key.
- The UI repository still reads and writes a garage-scoped browser-storage dataset and syncs its snapshot to Supabase for authenticated users. The full migration to normalized relational Supabase reads and writes is not complete.
- Platform Foundation AI Search is implemented through `worker/ai-search.ts` and `POST /api/ai-search`. Motofy signs requests server-side using the app secret. The shared Platform Foundation service currently uses Vercel; Motofy itself uses OpenAI Sites hosting, not Vercel.
- D1/Drizzle schema, migrations and the D1 hosting binding remain legacy/reference scaffolding.

## Deployment status

The development URL recorded in deployment docs is https://motofy-garage-revamp.johnstaf.chatgpt.site/. Its deployed commit and freshness against this `main` snapshot are **not verified here**. GitHub and the live deployment must be checked separately.

## Decisions and working rules

- GitHub `main` is canonical for source code.
- Keep the workflow plate-first and minimize typing with camera, voice, AI, sensible defaults and one-tap confirmation.
- Confirmed vehicle data outranks AI scan output.
- Keep UI premium, compact and mobile-first.
- Prefer small, targeted diffs; avoid wholesale merges.
- Keep D1/Drizzle as reference only while Supabase remains the chosen backend.
- Follow the verification order in `AGENTS.md`: React Doctor → Playwright → Knip → Lighthouse CI. Use Serwist only once PWA work begins.
- Keep the optional ChatGPT Sign-In helper documented and unchanged until its future use is decided.


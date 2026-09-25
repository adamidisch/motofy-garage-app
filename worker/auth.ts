import { buildAuthIdentity } from "../lib/auth-core.mjs";

export interface AuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  MOTOFY_AUTH_PEPPER?: string;
}

const ACCESS_COOKIE = "motofy-access";
const REFRESH_COOKIE = "motofy-refresh";
const GARAGE_COOKIE = "motofy-garage";
const MAX_STATE_BYTES = 2_000_000;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type Session = { access_token: string; refresh_token: string; expires_in?: number };
type CreateAuthUserResult = "created" | "existing" | "error";

function json(data: unknown, status = 200, extraHeaders: Array<[string, string]> = []) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const [name, value] of extraHeaders) headers.append(name, value);
  return Response.json(data, { status, headers });
}

function config(env: AuthEnv) {
  const url = env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !env.SUPABASE_ANON_KEY || !secret || !env.MOTOFY_AUTH_PEPPER) return null;
  return { url, anon: env.SUPABASE_ANON_KEY, service: secret, pepper: env.MOTOFY_AUTH_PEPPER };
}

function adminHeaders(serviceKey: string, contentType = false) {
  const headers: Record<string, string> = { apikey: serviceKey };
  if (serviceKey.startsWith("eyJ")) headers.Authorization = `Bearer ${serviceKey}`;
  if (contentType) headers["content-type"] = "application/json";
  return headers;
}

function cookieFlags(request: Request, maxAge = SESSION_MAX_AGE) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function setAuthCookies(request: Request, session: Session, garageId: string) {
  return [
      ["Set-Cookie", `${ACCESS_COOKIE}=${encodeURIComponent(session.access_token)}; ${cookieFlags(request)}`],
      ["Set-Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(session.refresh_token)}; ${cookieFlags(request)}`],
      ["Set-Cookie", `${GARAGE_COOKIE}=${encodeURIComponent(garageId)}; ${cookieFlags(request)}`],
  ] as Array<[string, string]>;
}

function clearAuthCookies(request: Request) {
  const flags = cookieFlags(request, 0);
  return [ACCESS_COOKIE, REFRESH_COOKIE, GARAGE_COOKIE]
    .map((name) => ["Set-Cookie", `${name}=; ${flags}`] as [string, string]);
}

function readCookies(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const values: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try { values[key] = decodeURIComponent(value); } catch { values[key] = value; }
  }
  return {
    accessToken: values[ACCESS_COOKIE] ?? "",
    refreshToken: values[REFRESH_COOKIE] ?? "",
    garageId: values[GARAGE_COOKIE] ?? "",
  };
}

async function parseBody<T>(request: Request): Promise<T | null> {
  try { return await request.json() as T; } catch { return null; }
}

async function createAuthUser(cfg: ReturnType<typeof config>, identity: Awaited<ReturnType<typeof buildAuthIdentity>>): Promise<CreateAuthUserResult> {
  if (!cfg || !identity.ok || !("email" in identity)) return "error";
  const response = await fetch(`${cfg.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(cfg.service, true),
    body: JSON.stringify({ email: identity.email, password: identity.password, email_confirm: true, user_metadata: { motofy_name: identity.nameKey } }),
  });
  if (response.ok) return "created";
  if (response.status === 422) return "existing";
  return "error";
}

async function signIn(cfg: ReturnType<typeof config>, email: string, password: string): Promise<Session | null> {
  if (!cfg) return null;
  const response = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anon, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return null;
  const value = await response.json() as Partial<Session>;
  if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string") return null;
  return { access_token: value.access_token, refresh_token: value.refresh_token, expires_in: value.expires_in };
}

async function refreshSession(cfg: ReturnType<typeof config>, refreshToken: string): Promise<Session | null> {
  if (!cfg || !refreshToken) return null;
  const response = await fetch(`${cfg.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: cfg.anon, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) return null;
  const value = await response.json() as Partial<Session>;
  if (typeof value.access_token !== "string" || typeof value.refresh_token !== "string") return null;
  return { access_token: value.access_token, refresh_token: value.refresh_token, expires_in: value.expires_in };
}

async function ensureGarage(cfg: ReturnType<typeof config>, session: Session, displayName: string): Promise<string | null> {
  if (!cfg) return null;
  const response = await fetch(`${cfg.url}/rest/v1/rpc/ensure_garage`, {
    method: "POST",
    headers: {
      apikey: cfg.anon,
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_name: displayName.slice(0, 120) || "Garage" }),
  });
  if (!response.ok) return null;
  const value = await response.json() as unknown;
  return typeof value === "string" && value ? value : null;
}

async function restRequest(cfg: ReturnType<typeof config>, token: string, path: string, init: RequestInit = {}) {
  if (!cfg) return null;
  return fetch(`${cfg.url}${path}`, {
    ...init,
    headers: { apikey: cfg.anon, Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
}

export async function login(request: Request, env: AuthEnv) {
  const cfg = config(env);
  const body = await parseBody<{ name?: string; pin?: string }>(request);
  if (!cfg) return json({ error: "Η σύνδεση βάσης δεν είναι ρυθμισμένη." }, 503);
  if (!body?.name?.trim()) return json({ error: "Γράψε το όνομά σου." }, 400);

  const identity = await buildAuthIdentity({ name: body.name, pin: body.pin ?? "", pepper: cfg.pepper });
  if (!identity.ok || !("email" in identity)) return json({ error: "Το PIN πρέπει να έχει τέσσερα ψηφία ή να μείνει κενό." }, 400);

  const createResult = await createAuthUser(cfg, identity);
  if (createResult === "error") return json({ error: "Δεν δημιουργήθηκε η σύνδεση." }, 503);

  const session = await signIn(cfg, identity.email, identity.password);
  if (!session) return json({ error: "Το όνομα ή το PIN δεν έγινε δεκτό." }, 401);

  const garageId = await ensureGarage(cfg, session, body.name.trim());
  if (!garageId) return json({ error: "Δεν ολοκληρώθηκε η δημιουργία του garage. Δοκίμασε ξανά." }, 503);

  const created = createResult === "created";
  return json({ ok: true, garageId, created }, created ? 201 : 200, setAuthCookies(request, session, garageId));
}

export async function logout(request: Request) {
  return json({ ok: true }, 200, clearAuthCookies(request));
}

async function authenticatedRequest(request: Request, env: AuthEnv) {
  const cfg = config(env);
  const cookies = readCookies(request);
  if (!cfg || !cookies.accessToken) return { cfg, cookies, response: null, token: "" };
  return { cfg, cookies, response: null, token: cookies.accessToken };
}

export async function getAuthenticatedUserId(request: Request, env: AuthEnv): Promise<string | null> {
  const auth = await authenticatedRequest(request, env);
  if (!auth.cfg || !auth.token) return null;

  try {
    const response = await restRequest(auth.cfg, auth.token, "/auth/v1/user");
    if (!response?.ok) return null;

    const value = await response.json().catch(() => ({})) as { id?: unknown };
    return typeof value.id === "string" && value.id ? value.id : null;
  } catch {
    return null;
  }
}

export async function getState(request: Request, env: AuthEnv) {
  const auth = await authenticatedRequest(request, env);
  if (!auth.cfg || !auth.token) return json({ error: "Η σύνδεση έληξε." }, 401, clearAuthCookies(request));
  let response = await restRequest(auth.cfg, auth.token, "/rest/v1/garage_state?select=garage_id,schema_version,payload&limit=1");
  let cookies = setAuthCookies(request, { access_token: auth.token, refresh_token: auth.cookies.refreshToken }, auth.cookies.garageId);
  if (response?.status === 401 && auth.cookies.refreshToken) {
    const refreshed = await refreshSession(auth.cfg, auth.cookies.refreshToken);
    if (refreshed) {
      response = await restRequest(auth.cfg, refreshed.access_token, "/rest/v1/garage_state?select=garage_id,schema_version,payload&limit=1");
      cookies = setAuthCookies(request, refreshed, auth.cookies.garageId);
    }
  }
  if (!response) return json({ error: "Η βάση δεν είναι διαθέσιμη." }, 503);
  if (!response.ok) return json({ error: "Δεν διαβάστηκαν τα δεδομένα του garage." }, response.status, cookies);
  const rows = await response.json() as Array<{ garage_id: string; schema_version: number; payload: unknown }>;
  return json({ garageId: auth.cookies.garageId, payload: rows[0]?.payload ?? null }, 200, cookies);
}

export async function putState(request: Request, env: AuthEnv) {
  const auth = await authenticatedRequest(request, env);
  if (!auth.cfg || !auth.token || !auth.cookies.garageId) return json({ error: "Η σύνδεση έληξε." }, 401, clearAuthCookies(request));
  const body = await parseBody<{ payload?: unknown }>(request);
  if (!body || !body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) return json({ error: "Μη έγκυρα δεδομένα." }, 400);
  const serialized = JSON.stringify(body.payload);
  if (serialized.length > MAX_STATE_BYTES) return json({ error: "Τα δεδομένα είναι πολύ μεγάλα." }, 413);
  const response = await restRequest(auth.cfg, auth.token, "/rest/v1/garage_state?on_conflict=garage_id", {
    method: "POST",
    headers: { "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ garage_id: auth.cookies.garageId, schema_version: 1, payload: body.payload, updated_at: new Date().toISOString() }),
  });
  if (!response) return json({ error: "Η βάση δεν είναι διαθέσιμη." }, 503);
  if (!response.ok) return json({ error: "Δεν αποθηκεύτηκαν τα δεδομένα του garage." }, response.status);
  return json({ ok: true });
}

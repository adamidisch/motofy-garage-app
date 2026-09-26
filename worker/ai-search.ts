import { getAuthenticatedUserId, type AuthEnv } from "./auth";

export interface AiSearchEnv extends AuthEnv {
  PLATFORM_FOUNDATION_URL?: string;
  PLATFORM_FOUNDATION_APP_ID?: string;
  PLATFORM_FOUNDATION_APP_SECRET?: string;
}

type AiSearchPayload = {
  message?: unknown;
  context?: unknown;
  fallback_answer?: unknown;
  local_first?: unknown;
  mode?: unknown;
  scope?: unknown;
};

const MINI_AI_CAPABILITIES = ["open_add_vehicle", "open_vehicle", "show_jobs", "prepare_vehicle_note"] as const;

const DEFAULT_SERVICE_URL = "https://platform-foundation-delta.vercel.app/api/ai-search";
const MAX_MESSAGE_CHARS = 1600;
const MAX_CONTEXT_CHARS = 10000;
const MAX_FALLBACK_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 12000;

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function text(value: unknown, maxChars: number) {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function serviceUrl(value?: string) {
  const configured = value?.trim().replace(/\/$/, "");
  if (!configured) return DEFAULT_SERVICE_URL;
  return configured.endsWith("/api/ai-search") ? configured : `${configured}/api/ai-search`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function signEnvelope(raw: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serialisedContext(value: unknown) {
  if (value === undefined) return "{}";
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === "string" ? encoded : "";
  } catch {
    return "";
  }
}

export async function aiSearch(request: Request, env: AiSearchEnv) {
  let payload: AiSearchPayload;
  try {
    const parsed = await request.json();
    payload = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as AiSearchPayload
      : {};
  } catch {
    return json({ ok: false, error: "Η ερώτηση δεν διαβάστηκε." }, 400);
  }

  const message = text(payload.message, MAX_MESSAGE_CHARS);
  if (!message) return json({ ok: false, error: "Γράψε πρώτα την ερώτησή σου." }, 400);
  const mode = payload.mode === "interpret" ? "interpret" : "answer";
  const scope = mode === "answer" && payload.scope === "general" ? "general" : "app_data";

  const selectedContext = mode === "interpret" || scope === "general" ? {} : payload.context;
  const context = serialisedContext(selectedContext);
  if (!context || new TextEncoder().encode(context).length > MAX_CONTEXT_CHARS) {
    return json({ ok: false, error: "Τα δεδομένα αναζήτησης είναι πολύ μεγάλα." }, 413);
  }

  const fallback = mode === "answer" && scope === "app_data" ? text(payload.fallback_answer, MAX_FALLBACK_CHARS) : "";
  const userId = await getAuthenticatedUserId(request, env);
  if (!userId) return json({ ok: false, error: "Η σύνδεση έληξε. Συνδέσου ξανά." }, 401);

  const secret = env.PLATFORM_FOUNDATION_APP_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return json({ ok: false, error: "Η αναζήτηση AI δεν έχει ρυθμιστεί." }, 503);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const envelope = {
    v: 1,
    issued_at: issuedAt,
    expires_at: issuedAt + 60,
    app: { id: env.PLATFORM_FOUNDATION_APP_ID?.trim() || "motofy" },
    request: {
      user_id: userId,
      message,
      context: selectedContext ?? {},
      fallback_answer: fallback,
      local_first: mode === "answer" && scope === "app_data" && payload.local_first === true,
      mode,
      scope,
      ...(mode === "interpret" ? { capabilities: MINI_AI_CAPABILITIES } : {}),
    },
  };

  const encoded = bytesToBase64(new TextEncoder().encode(JSON.stringify(envelope)));
  const signature = await signEnvelope(encoded, secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const upstream = await fetch(serviceUrl(env.PLATFORM_FOUNDATION_URL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: encoded, signature }),
      signal: controller.signal,
    });
    const result = await upstream.json().catch(() => ({ ok: false, error: "Η αναζήτηση δεν είναι διαθέσιμη τώρα." }));
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 503;
      return json(result, status);
    }
    return json(result, 200);
  } catch {
    return json(
      fallback
        ? { ok: true, answer: fallback, provider: "local" }
        : { ok: false, error: "Η αναζήτηση δεν είναι διαθέσιμη τώρα." },
      fallback ? 200 : 503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

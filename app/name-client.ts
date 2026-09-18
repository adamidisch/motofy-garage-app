"use client";

export const GREET_KEY = "motofy-greet-name";
export const SESSION_KEY = "motofy-session";
export const GARAGE_ID_KEY = "motofy-garage-id";
export const AI_STATUS_KEY = "motofy-ai-name-status";

export type RemoteState = {
  garageId: string;
  payload: Record<string, unknown> | null;
};

export function readAIStatus(): "ok" | "unavailable" | "unknown" {
  try {
    const value = globalThis.localStorage?.getItem(AI_STATUS_KEY);
    return value === "ok" || value === "unavailable" ? value : "unknown";
  } catch { return "unknown"; }
}

function writeAIStatus(status: "ok" | "unavailable") {
  try { localStorage.setItem(AI_STATUS_KEY, status); } catch {}
}

export async function requestNormalizedName(name: string, lang: "el" | "en" = "el"): Promise<string> {
  const typed = name.trim();
  if (!typed) return typed;
  try {
    const response = await fetch("/api/name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: typed, lang }),
    });
    if (!response.ok) { writeAIStatus("unavailable"); return typed; }
    const data = await response.json() as { greeting?: string };
    const greeting = typeof data.greeting === "string" ? data.greeting.trim() : "";
    if (!greeting || greeting.length > 40) { writeAIStatus("unavailable"); return typed; }
    writeAIStatus("ok");
    return greeting.replace(/^(καλημέρα|καλησπέρα|good morning|good evening)[,:\s]+/i, "");
  } catch {
    writeAIStatus("unavailable");
    return typed;
  }
}

export function readGreetName(session: string, demoSession: string): string {
  if (session === demoSession) return "Demo";
  try {
    const stored = globalThis.localStorage?.getItem(GREET_KEY)?.trim();
    if (stored) return stored;
  } catch {}
  return session;
}

export function storeGreeting(original: string, greeting: string) {
  localStorage.setItem(SESSION_KEY, original);
  localStorage.setItem(GREET_KEY, greeting);
  localStorage.setItem("motofy-user-name", original);
}

export function clearGreeting() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(GREET_KEY);
  localStorage.removeItem(GARAGE_ID_KEY);
}

export async function loginWithPIN(name: string, pin: string): Promise<{ garageId: string }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: name.trim(), pin }),
  });
  const data = await response.json().catch(() => ({})) as { garageId?: string; error?: string };
  if (!response.ok || typeof data.garageId !== "string") {
    throw new Error(data.error || "Η σύνδεση δεν ολοκληρώθηκε.");
  }
  return { garageId: data.garageId };
}

export async function loadRemoteState(): Promise<RemoteState> {
  const response = await fetch("/api/data", { cache: "no-store" });
  const data = await response.json().catch(() => ({})) as { garageId?: string; payload?: Record<string, unknown> | null; error?: string };
  if (!response.ok || typeof data.garageId !== "string") throw new Error(data.error || "Τα δεδομένα δεν φορτώθηκαν.");
  return { garageId: data.garageId, payload: data.payload ?? null };
}

export function syncRemoteState(payload: Record<string, unknown>): void {
  void fetch("/api/data", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload }),
    keepalive: true,
  }).catch(() => {});
}

export function logoutRemote(): void {
  void fetch("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
}

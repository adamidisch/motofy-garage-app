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

function syncDemoDashboardCopy(isDemo: boolean) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.requestAnimationFrame(() => {
    const copy = document.querySelector<HTMLElement>(".intro-row .intro-copy");
    if (!copy) return;
    if (isDemo) {
      const lang = localStorage.getItem("motofy-language") === "en" ? "en" : "el";
      copy.textContent = lang === "en" ? "Demo data" : "Δεδομένα επίδειξης";
      copy.dataset.motofyDemoCopy = "1";
    } else if (copy.dataset.motofyDemoCopy === "1") {
      delete copy.dataset.motofyDemoCopy;
    }
  });
}

export function readGreetName(session: string, demoSession: string): string {
  try {
    const storedSession = globalThis.localStorage?.getItem(SESSION_KEY)?.trim() ?? "";
    const isDemo = session === demoSession || !storedSession;
    syncDemoDashboardCopy(isDemo);
    if (isDemo) return "Demo";

    const stored = globalThis.localStorage?.getItem(GREET_KEY)?.trim();
    if (stored) return stored;
  } catch {
    if (session === demoSession) return "Demo";
  }
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
  localStorage.removeItem("motofy-user-name");
}

function showAccountCreatedNotice() {
  if (typeof document === "undefined") return;
  document.getElementById("motofy-account-created-notice")?.remove();

  const notice = document.createElement("div");
  notice.id = "motofy-account-created-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  Object.assign(notice.style, {
    position: "fixed",
    left: "50%",
    top: "20px",
    transform: "translate(-50%, -10px)",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    gap: "11px",
    width: "min(360px, calc(100vw - 28px))",
    padding: "12px 14px",
    border: "1px solid rgba(30, 88, 71, .16)",
    borderRadius: "16px",
    background: "rgba(249, 253, 251, .97)",
    color: "#17362d",
    boxShadow: "0 18px 44px rgba(34, 68, 92, .16), 0 2px 8px rgba(34, 68, 92, .08)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    fontFamily: "inherit",
    opacity: "0",
    transition: "opacity .2s ease, transform .24s ease",
  });

  const icon = document.createElement("span");
  icon.textContent = "✓";
  Object.assign(icon.style, {
    display: "grid",
    placeItems: "center",
    flex: "0 0 28px",
    width: "28px",
    height: "28px",
    borderRadius: "9px",
    background: "#e5f5ef",
    color: "#14785f",
    fontSize: "15px",
    fontWeight: "700",
  });

  const copy = document.createElement("div");
  copy.style.minWidth = "0";
  const title = document.createElement("div");
  title.textContent = "Ο λογαριασμός δημιουργήθηκε";
  Object.assign(title.style, { fontSize: "13px", fontWeight: "650", lineHeight: "1.25" });
  const subtitle = document.createElement("div");
  subtitle.textContent = "Καλώς ήρθες στο Motofy.";
  Object.assign(subtitle.style, { marginTop: "2px", fontSize: "12px", lineHeight: "1.3", color: "#607c73" });
  copy.append(title, subtitle);
  notice.append(icon, copy);
  document.body.appendChild(notice);

  requestAnimationFrame(() => {
    notice.style.opacity = "1";
    notice.style.transform = "translate(-50%, 0)";
  });
  window.setTimeout(() => {
    notice.style.opacity = "0";
    notice.style.transform = "translate(-50%, -8px)";
    window.setTimeout(() => notice.remove(), 260);
  }, 3200);
}

export async function loginWithPIN(name: string, pin: string): Promise<{ garageId: string; created: boolean }> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: name.trim(), pin }),
  });
  const data = await response.json().catch(() => ({})) as { garageId?: string; created?: boolean; error?: string };
  if (!response.ok || typeof data.garageId !== "string") {
    throw new Error(data.error || "Η σύνδεση δεν ολοκληρώθηκε.");
  }
  const created = data.created === true;
  if (created) showAccountCreatedNotice();
  return { garageId: data.garageId, created };
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

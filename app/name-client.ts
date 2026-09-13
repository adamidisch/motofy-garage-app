"use client";

export const GREET_KEY = "motofy-greet-name";
export const SESSION_KEY = "motofy-session";

export async function requestNormalizedName(name: string, lang: "el" | "en" = "el"): Promise<string> {
  const typed = name.trim();
  if (!typed) return typed;
  try {
    const response = await fetch("/api/name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: typed, lang }),
    });
    if (!response.ok) return typed;
    const data = await response.json() as { greeting?: string };
    const greeting = typeof data.greeting === "string" ? data.greeting.trim() : "";
    if (!greeting || greeting.length > 40) return typed;
    return greeting.replace(/^(καλημέρα|καλησπέρα|good morning|good evening)[,:\s]+/i, "");
  } catch {
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
}

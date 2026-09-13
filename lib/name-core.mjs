/**
 * Motofy AI name normalizer.
 *
 * Server-side only. Uses GEMINI_API_KEY through the worker. The browser never
 * sees the key. There is no name dictionary in this module — Gemini decides.
 * Callers must fall back to the typed name when this throws or returns empty.
 */

import {
  GEMINI_INTERACTIONS_URL,
  ScanError,
  extractInteractionText,
  parseLooseJson,
} from "./scan-core.mjs";

export const NAME_MODEL = "gemini-2.5-flash-lite";

export const NAME_PROMPT =
  "Normalize a Cyprus garage user's first name for a Greek greeting. " +
  "Input may be Latin, Greeklish, or Greek. Reply with JSON only: {\"greeting\":\"...\"}. " +
  "greeting is the name only — no Καλημέρα, no quotes, no explanation. " +
  "Use Greek letters. Use the vocative when speaking to the person (Αντρέα, not Ανδρέας). " +
  "Keep nicknames when that is how people address them. " +
  "If you cannot tell, return the input unchanged.";

export const NAME_SCHEMA = {
  type: "object",
  properties: { greeting: { type: "string" } },
  required: ["greeting"],
};

export function firstName(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  return text.split(" ")[0];
}

export function cleanGreeting(raw, fallback) {
  const fallbackName = String(fallback ?? "").trim();
  if (raw === null || raw === undefined) return fallbackName;
  let text = String(raw).trim().replace(/^["'«»]+|["'«»]+$/g, "");
  text = text.replace(/^(καλημέρα|καλησπέρα|good morning|good evening|hello|hi)[,:\s]+/i, "");
  text = text.split(/[\n,]/)[0].trim();
  if (!text || text.length > 40) return fallbackName;
  return text;
}

export function buildNameRequestBody({ name, lang, model = NAME_MODEL }) {
  const language = lang === "en" ? "en" : "el";
  return {
    model,
    store: false,
    input: [
      {
        type: "text",
        text: `${NAME_PROMPT}\n\nlanguage: ${language}\nname: ${String(name ?? "").trim()}`,
      },
    ],
    generation_config: {
      thinking_level: "low",
      thinking_summaries: "none",
    },
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: NAME_SCHEMA,
    },
  };
}

function mockSteps(text) {
  return { steps: [{ type: "model_output", content: [{ type: "text", text }] }] };
}

export async function runNameNormalize({
  apiKey,
  name,
  lang = "el",
  model = NAME_MODEL,
  fetchImpl = fetch,
  log = () => {},
}) {
  const typed = String(name ?? "").trim();
  if (!typed) throw new ScanError(400, "Γράψε ένα όνομα.", "empty name");
  if (!apiKey) throw new ScanError(503, "Το AI όνομα δεν είναι διαθέσιμο.", "GEMINI_API_KEY is not set");

  let response;
  try {
    response = await fetchImpl(GEMINI_INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(buildNameRequestBody({ name: typed, lang, model })),
    });
  } catch (error) {
    log("name normalize network", error);
    throw new ScanError(502, "Δεν ολοκληρώθηκε η προσαρμογή ονόματος.", "network");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    log("name normalize rejected", response.status, detail);
    throw new ScanError(502, "Δεν ολοκληρώθηκε η προσαρμογή ονόματος.", detail.slice(0, 400));
  }

  const payload = await response.json().catch(() => mockSteps(""));
  const rawText = extractInteractionText(payload);
  const parsed = parseLooseJson(rawText) ?? {};
  const greeting = cleanGreeting(parsed.greeting, firstName(typed) || typed);
  return { greeting, source: "ai" };
}

export async function requestNormalizedName(name, lang = "el", fetchImpl = fetch) {
  const typed = String(name ?? "").trim();
  if (!typed) return typed;
  try {
    const response = await fetchImpl("/api/name", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: typed, lang: lang === "en" ? "en" : "el" }),
    });
    if (!response.ok) return typed;
    const data = await response.json();
    return cleanGreeting(data?.greeting, typed);
  } catch {
    return typed;
  }
}

/**
 * Motofy vehicle scan core.
 *
 * Deliberately framework-agnostic: no Cloudflare, Next.js or Node built-ins.
 * It takes a `fetch` implementation and plain data, so the exact same module
 * backs the Cloudflare Worker today and a Next.js route handler on Vercel
 * later (Phase 6) with no rewrite.
 *
 * Gemini Interactions API notes (verified against the May 2026 breaking-change
 * guide): the legacy `outputs` schema was removed on 2026-06-08 and the
 * `Api-Revision` header is now ignored, so we do not send it. REST responses
 * carry text at `steps[] -> {type: "model_output"} -> content[] -> {type:
 * "text", text}`. `output_text` is SDK-only sugar and never appears in raw
 * REST JSON — relying on it was the original bug.
 */

export const GEMINI_INTERACTIONS_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

export const DEFAULT_MODEL = "gemini-3.8-flash";

export const SCAN_PROMPT =
  "You are a cautious vehicle scan assistant for a Cyprus garage. Inspect this single photo. " +
  "Read a visible registration plate only if clearly legible. Identify make and model only from " +
  "visual evidence. Do not use external knowledge or invent missing information. Return JSON with " +
  "exactly: plate (string or null, the characters exactly as printed on the plate), make (string or " +
  "null), model (string or null), confidence (high, medium, or low). If unsure, use null and low " +
  "confidence.";

/**
 * JSON Schema for the structured output.
 *
 * Uses `type: ["string", "null"]` rather than the OpenAPI-style
 * `nullable: true`, which is not valid JSON Schema.
 */
export const SCAN_SCHEMA = {
  type: "object",
  properties: {
    plate: { type: ["string", "null"] },
    make: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: ["plate", "make", "model", "confidence"],
};

/* ------------------------------------------------------------------ */
/* Plate normalisation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Greek and Cyrillic capitals that are visually identical to Latin capitals.
 *
 * Cyprus plates are printed in Latin characters, but OCR (and Greek-language
 * data entry) routinely produces the Greek codepoint instead. `ΚΒΥ 328` and
 * `KBY 328` look the same and must normalise to the same value.
 *
 * Only unambiguous homoglyphs are mapped. Letters with no Latin lookalike
 * (Γ, Δ, Λ, Π, Σ, Φ, Ψ, Ω) are left alone so a genuine mis-read stays visible
 * instead of being silently rewritten.
 */
const HOMOGLYPHS = {
  // Greek
  Α: "A", Β: "B", Ε: "E", Ζ: "Z", Η: "H", Ι: "I", Κ: "K", Μ: "M",
  Ν: "N", Ο: "O", Ρ: "P", Τ: "T", Υ: "Y", Χ: "X",
  // Cyrillic
  А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P",
  С: "C", Т: "T", У: "Y", Х: "X",
};

/** Strip separators, uppercase, and fold homoglyphs to Latin. */
export function canonicalisePlateChars(value) {
  if (value === null || value === undefined) return "";
  let out = "";
  for (const char of String(value).normalize("NFKC").toUpperCase()) {
    const mapped = HOMOGLYPHS[char] ?? char;
    if (/[A-Z0-9]/.test(mapped)) out += mapped;
  }
  return out;
}

/**
 * Normalise a recognised plate to `LETTERS DIGITS`.
 *
 * Cyprus civilian plates are predominantly three letters plus three digits,
 * but older, trade, taxi and government series vary in length. This is
 * deliberately permissive: the goal is to tidy formatting, never to reject a
 * plate that was read correctly. Anything that survives cleaning but does not
 * match a known shape is returned as-is rather than discarded.
 *
 * @returns {string | null} formatted plate, or null only when there is nothing usable
 */
export function normalisePlate(value) {
  const clean = canonicalisePlateChars(value);
  if (!clean) return null;

  // Whole string is letters-then-digits, e.g. "ABC123", "KBY328", "AB1234".
  const exact = clean.match(/^([A-Z]{1,3})(\d{1,4})$/);
  if (exact) return `${exact[1]} ${exact[2]}`;

  // Plate embedded in surrounding noise, e.g. "CYABC123EU".
  const embedded = clean.match(/([A-Z]{2,3})(\d{2,4})/);
  if (embedded) return `${embedded[1]} ${embedded[2]}`;

  // Digits-only series (trade / temporary plates).
  if (/^\d{2,6}$/.test(clean)) return clean;

  // Recognised something plate-shaped we do not have a rule for. Keep it —
  // a mechanic can read it, and dropping it would be worse than showing it.
  if (clean.length >= 2 && clean.length <= 10) return clean;

  return null;
}

/* ------------------------------------------------------------------ */
/* Response parsing                                                    */
/* ------------------------------------------------------------------ */

function textFromContentArray(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((part) => part && typeof part === "object" && typeof part.text === "string")
    .filter((part) => part.type === undefined || part.type === "text")
    .map((part) => part.text);
}

/**
 * Pull the model's text out of an Interactions API response.
 *
 * Handles, in priority order:
 *   1. current `steps[]` schema, preferring `model_output` steps
 *   2. any other step that carries text content
 *   3. legacy `outputs[]` schema (pre-2026-06-08 deployments)
 *   4. `output_text` sugar, in case an SDK response object is passed in
 *
 * @returns {string | null}
 */
export function extractInteractionText(payload) {
  if (!payload || typeof payload !== "object") return null;

  if (Array.isArray(payload.steps)) {
    const modelOutput = payload.steps
      .filter((step) => step && step.type === "model_output")
      .flatMap((step) => textFromContentArray(step.content));
    if (modelOutput.length) return modelOutput.join("");

    // Some step types (e.g. a plain text step) still carry usable content.
    const anyStep = payload.steps.flatMap((step) =>
      step && typeof step === "object"
        ? [...textFromContentArray(step.content), ...(typeof step.text === "string" ? [step.text] : [])]
        : [],
    );
    if (anyStep.length) return anyStep.join("");
  }

  if (Array.isArray(payload.outputs)) {
    const legacy = payload.outputs
      .filter((out) => out && typeof out.text === "string" && (out.type === undefined || out.type === "text"))
      .map((out) => out.text);
    if (legacy.length) return legacy.join("");
  }

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  return null;
}

/**
 * Parse JSON that a model may have wrapped in prose or a fenced code block.
 * @returns {Record<string, unknown> | null}
 */
export function parseLooseJson(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!trimmed) return null;

  try {
    const direct = JSON.parse(trimmed);
    return direct && typeof direct === "object" ? direct : null;
  } catch {
    // fall through to brace scanning
  }

  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    if (escaped) { escaped = false; continue; }
    if (char === "\\") { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(trimmed.slice(start, i + 1));
          return parsed && typeof parsed === "object" ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "unknown") return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Shape a raw model object into the contract the frontend expects.
 * @returns {{plate: string|null, make: string|null, model: string|null, confidence: "high"|"medium"|"low", source: "ai"}}
 */
export function toScanResult(raw) {
  const record = raw && typeof raw === "object" ? raw : {};
  const confidence =
    record.confidence === "high" || record.confidence === "medium" ? record.confidence : "low";
  return {
    plate: normalisePlate(record.plate),
    make: cleanString(record.make, 40),
    model: cleanString(record.model, 50),
    confidence,
    source: "ai",
  };
}

/* ------------------------------------------------------------------ */
/* Request                                                             */
/* ------------------------------------------------------------------ */

export function buildScanRequestBody({ imageData, mimeType, model = DEFAULT_MODEL }) {
  return {
    model,
    // Customer vehicle photos: do not let Google retain the interaction.
    store: false,
    input: [
      { type: "text", text: SCAN_PROMPT },
      { type: "image", data: imageData, mime_type: mimeType },
    ],
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: SCAN_SCHEMA,
    },
  };
}

/** Strip a data: URL prefix and any whitespace from base64 image data. */
export function stripDataUrl(value) {
  return String(value ?? "").replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
}

/**
 * Remove secrets from any text that may be logged, echoed in debug mode or
 * printed by the probe script.
 *
 * The API key travels in the `x-goog-api-key` header and Google does not echo
 * it back, so this should never fire. It exists because "should never" is not
 * a guarantee worth betting a credential on: upstream bodies, proxy errors and
 * stack traces are all attacker-adjacent surfaces we do not control.
 *
 * @param {string} text
 * @param {Array<string | undefined>} secrets
 * @returns {string}
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? "");
  for (const secret of secrets) {
    // Ignore short or empty values: redacting those would mangle normal text.
    if (typeof secret !== "string" || secret.length < 8) continue;
    out = out.split(secret).join("[REDACTED]");
  }
  // Catch keys that arrived from somewhere other than our own config.
  out = out.replace(/AIza[0-9A-Za-z_-]{10,}/g, "[REDACTED]");
  out = out.replace(/([?&](?:key|api_key)=)[^&\s"']+/gi, "$1[REDACTED]");
  return out;
}

/**
 * Error thrown when the scan cannot complete. `userMessage` is safe to show
 * to a mechanic; `detail` is for logs only and never reaches the client
 * unless debug mode is explicitly enabled.
 */
export class ScanError extends Error {
  constructor(status, userMessage, detail) {
    super(userMessage);
    this.name = "ScanError";
    this.status = status;
    this.userMessage = userMessage;
    this.detail = detail ?? null;
  }
}

export const MAX_IMAGE_BASE64_LENGTH = 10_000_000;

/**
 * Run one vehicle scan.
 *
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} options.imageData   base64, with or without data: prefix
 * @param {string} [options.mimeType]
 * @param {string} [options.model]
 * @param {number} [options.timeoutMs]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {(msg: string, ...rest: unknown[]) => void} [options.log]
 * @returns {Promise<{result: object, rawText: string, upstream: unknown}>}
 */
export async function runVehicleScan({
  apiKey,
  imageData,
  mimeType = "image/jpeg",
  model = DEFAULT_MODEL,
  timeoutMs = 16_000,
  fetchImpl = fetch,
  log = () => {},
}) {
  if (!apiKey) {
    throw new ScanError(503, "Το AI scan δεν είναι ακόμη διαθέσιμο.", "GEMINI_API_KEY is not set");
  }

  // Every diagnostic string below passes through here before it can reach a
  // log line, a debug response or the probe script's stdout.
  const safe = (text) => redactSecrets(text, [apiKey]);

  const data = stripDataUrl(imageData);
  if (!data) {
    throw new ScanError(400, "Χρειάζεται φωτογραφία αυτοκινήτου.", "empty imageData");
  }
  if (data.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new ScanError(
      400,
      "Χρειάζεται μια μικρότερη φωτογραφία αυτοκινήτου.",
      `imageData length ${data.length} exceeds ${MAX_IMAGE_BASE64_LENGTH}`,
    );
  }

  const safeMime = mimeType === "image/png" || mimeType === "image/webp" ? mimeType : "image/jpeg";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchImpl(GEMINI_INTERACTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify(buildScanRequestBody({ imageData: data, mimeType: safeMime, model })),
    });
  } catch (error) {
    const aborted = error && (error.name === "AbortError" || error.name === "TimeoutError");
    throw new ScanError(
      aborted ? 504 : 502,
      aborted
        ? "Η αναγνώριση άργησε πολύ. Δοκίμασε ξανά με καθαρότερη λήψη."
        : "Δεν μπορέσαμε να συνδεθούμε με το AI. Δοκίμασε ξανά.",
      safe(String((error && error.message) || error)),
    );
  } finally {
    clearTimeout(timer);
  }

  const bodyText = await response.text();

  if (!response.ok) {
    const detail = safe(`upstream ${response.status}: ${bodyText.slice(0, 1200)}`);
    log("gemini scan rejected", response.status, detail);
    throw new ScanError(502, "Το AI δεν δέχτηκε τη φωτογραφία αυτή τη στιγμή. Δοκίμασε ξανά.", detail);
  }

  let upstream;
  try {
    upstream = JSON.parse(bodyText);
  } catch {
    const detail = safe(`non-JSON upstream body: ${bodyText.slice(0, 1200)}`);
    log("gemini scan returned non-JSON", detail);
    throw new ScanError(502, "Δεν πήραμε έγκυρο αποτέλεσμα από τη φωτογραφία.", detail);
  }

  const rawText = extractInteractionText(upstream);
  if (!rawText) {
    const detail = safe(
      `no text found in steps/outputs. status=${upstream?.status}. body=${bodyText.slice(0, 1200)}`,
    );
    log("gemini scan had no text step", detail);
    throw new ScanError(502, "Δεν πήραμε έγκυρο αποτέλεσμα από τη φωτογραφία.", detail);
  }

  const parsed = parseLooseJson(rawText);
  if (!parsed) {
    const detail = safe(`model text was not JSON: ${rawText.slice(0, 600)}`);
    log("gemini scan text was not JSON", detail);
    throw new ScanError(502, "Το AI επέστρεψε αποτέλεσμα που δεν μπορούμε να επιβεβαιώσουμε.", detail);
  }

  return { result: toScanResult(parsed), rawText, upstream };
}

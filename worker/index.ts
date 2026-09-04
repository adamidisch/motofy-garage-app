/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  GEMINI_API_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

type ScanPayload = { imageData?: string; mimeType?: string };

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function normalisePlate(value: unknown) {
  const clean = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = clean.match(/[A-Z]{3}\d{3}/);
  return match ? `${match[0].slice(0, 3)} ${match[0].slice(3)}` : null;
}

function responseText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;
  for (const nested of Object.values(record)) {
    if (typeof nested === "object") {
      const found = responseText(nested);
      if (found) return found;
    }
  }
  return null;
}

async function scanVehicle(request: Request, env: Env) {
  if (!env.GEMINI_API_KEY) return json({ error: "Το AI scan δεν είναι ακόμη διαθέσιμο." }, 503);
  let payload: ScanPayload;
  try { payload = await request.json() as ScanPayload; } catch { return json({ error: "Η φωτογραφία δεν διαβάστηκε." }, 400); }
  const mimeType = payload.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const imageData = String(payload.imageData ?? "").replace(/^data:[^;]+;base64,/, "");
  if (!imageData || imageData.length > 10_000_000) return json({ error: "Χρειάζεται μια μικρότερη φωτογραφία αυτοκινήτου." }, 400);

  const prompt = "You are a cautious vehicle scan assistant for a Cyprus garage. Inspect this single photo. Read a visible registration plate only if clearly legible. Identify make and model only from visual evidence. Do not use external knowledge or invent missing information. Return JSON with exactly: plate (string or null, formatted ABC 123), make (string or null), model (string or null), confidence (high, medium, or low). If unsure, use null and low confidence.";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16_000);
  let upstream: Response;
  try {
    upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    signal: controller.signal,
    body: JSON.stringify({
      model: "gemini-3.8-flash",
      input: [{ type: "text", text: prompt }, { type: "image", data: imageData, mime_type: mimeType }],
      response_format: {
        type: "text", mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            plate: { type: "string", nullable: true }, make: { type: "string", nullable: true }, model: { type: "string", nullable: true },
            confidence: { type: "string", enum: ["high", "medium", "low"] }
          }, required: ["plate", "make", "model", "confidence"]
        }
      }
    })
    });
  } catch {
    return json({ error: "Η αναγνώριση άργησε πολύ. Δοκίμασε ξανά με καθαρότερη λήψη." }, 504);
  } finally {
    clearTimeout(timeout);
  }
  if (!upstream.ok) {
    const errorBody = (await upstream.text()).slice(0, 800);
    console.error("Gemini vehicle scan rejected", upstream.status, errorBody);
    return json({ error: "Το AI δεν δέχτηκε τη φωτογραφία αυτή τη στιγμή. Δοκίμασε ξανά." }, 502);
  }
  const providerResponse = await upstream.json() as unknown;
  const text = responseText(providerResponse);
  if (!text) return json({ error: "Δεν πήραμε έγκυρο αποτέλεσμα από τη φωτογραφία." }, 502);
  try {
    const result = JSON.parse(text) as Record<string, unknown>;
    const plate = normalisePlate(result.plate);
    const make = typeof result.make === "string" && result.make.trim() ? result.make.trim().slice(0, 40) : null;
    const model = typeof result.model === "string" && result.model.trim() ? result.model.trim().slice(0, 50) : null;
    const confidence = result.confidence === "high" || result.confidence === "medium" ? result.confidence : "low";
    return json({ plate, make, model, confidence, source: "ai" });
  } catch { return json({ error: "Το AI επέστρεψε αποτέλεσμα που δεν μπορούμε να επιβεβαιώσουμε." }, 502); }
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/scan") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return scanVehicle(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

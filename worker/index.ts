/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runPlateRecognizerScan, runVehicleScan, ScanError } from "../lib/scan-core.mjs";
import { runNameNormalize } from "../lib/name-core.mjs";
import { getState, login as loginWithPIN, logout as logoutAuth, putState, type AuthEnv } from "./auth";
import { aiSearch, type AiSearchEnv } from "./ai-search";

interface Env extends AuthEnv, AiSearchEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: NonNullable<typeof import("cloudflare:workers").env.DB>;
  GEMINI_API_KEY?: string;
  PLATE_RECOGNIZER_TOKEN?: string;
  /** Set to "1" to expose upstream diagnostics on /api/scan. Never enable in production. */
  SCAN_DEBUG?: string;
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

async function scanPlate(request: Request, env: Env) {
  const startedAt = Date.now();
  let payload: ScanPayload;
  try {
    payload = (await request.json()) as ScanPayload;
  } catch {
    return json({ error: "Η φωτογραφία δεν διαβάστηκε." }, 400);
  }

  try {
    const { result } = await runPlateRecognizerScan({
      apiToken: env.PLATE_RECOGNIZER_TOKEN,
      imageData: payload.imageData,
      mimeType: payload.mimeType,
      region: "cy",
      log: (message, ...rest) => console.error("[plate]", message, ...rest),
    });
    const elapsedMs = Date.now() - startedAt;
    console.log("[plate] completed", elapsedMs, "ms");
    return json({ ...result, provider: "plate-recognizer", elapsedMs });
  } catch (error) {
    if (error instanceof ScanError) {
      console.error("[plate]", error.userMessage, error.detail, `elapsed=${Date.now() - startedAt}ms`);
      return json({ error: error.userMessage }, error.status);
    }
    console.error("[plate] unexpected failure", error, `elapsed=${Date.now() - startedAt}ms`);
    return json({ error: "Δεν ολοκληρώθηκε η ανάγνωση πινακίδας." }, 500);
  }
}

async function scanVehicle(request: Request, env: Env) {
  const startedAt = Date.now();
  const debug = env.SCAN_DEBUG === "1";
  const wantsRaw = debug && new URL(request.url).searchParams.get("raw") === "1";

  let payload: ScanPayload;
  try {
    payload = (await request.json()) as ScanPayload;
  } catch {
    return json({ error: "Η φωτογραφία δεν διαβάστηκε." }, 400);
  }

  try {
    const { result, rawText, upstream } = await runVehicleScan({
      apiKey: env.GEMINI_API_KEY,
      imageData: payload.imageData,
      mimeType: payload.mimeType,
      log: (message, ...rest) => console.error("[scan]", message, ...rest),
    });

    const elapsedMs = Date.now() - startedAt;
    console.log("[scan] completed", elapsedMs, "ms");
    if (wantsRaw) return json({ result, rawText, upstream, debug: { elapsedMs } });
    return json(debug ? { ...result, debug: { rawText, elapsedMs } } : result);
  } catch (error) {
    if (error instanceof ScanError) {
      console.error("[scan]", error.userMessage, error.detail, `elapsed=${Date.now() - startedAt}ms`);
      return json(
        debug ? { error: error.userMessage, debug: { detail: error.detail } } : { error: error.userMessage },
        error.status,
      );
    }
    console.error("[scan] unexpected failure", error, `elapsed=${Date.now() - startedAt}ms`);
    return json({ error: "Δεν ολοκληρώθηκε η αναγνώριση." }, 500);
  }
}

async function normalizeName(request: Request, env: Env) {
  let payload: { name?: string; lang?: string } = {};
  try { payload = (await request.json()) as { name?: string; lang?: string }; }
  catch { return json({ error: "Το όνομα δεν διαβάστηκε." }, 400); }
  try {
    const result = await runNameNormalize({
      apiKey: env.GEMINI_API_KEY,
      name: payload.name,
      lang: payload.lang === "en" ? "en" : "el",
      log: (message: string, ...rest: unknown[]) => console.error("[name]", message, ...rest),
    });
    return json(result);
  } catch (error) {
    if (error instanceof ScanError) return json({ error: error.userMessage }, error.status);
    return json({ error: "Δεν ολοκληρώθηκε η προσαρμογή ονόματος." }, 500);
  }
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

    if (url.pathname === "/api/ai-search") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return aiSearch(request, env);
    }

    if (url.pathname === "/api/name") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return normalizeName(request, env);
    }

    if (url.pathname === "/api/auth/login") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return loginWithPIN(request, env);
    }

    if (url.pathname === "/api/auth/logout") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return logoutAuth(request);
    }

    if (url.pathname === "/api/data") {
      if (request.method === "GET") return getState(request, env);
      if (request.method === "PUT") return putState(request, env);
      return json({ error: "Method not allowed" }, 405);
    }

    if (url.pathname === "/api/scan/plate") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      return scanPlate(request, env);
    }

    if (url.pathname === "/api/scan/vehicle" || url.pathname === "/api/scan") {
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

    const response = await handler.fetch(request, env, ctx);

    // Keep the app fast: only the initial HTML document revalidates.
    // Hashed JS/CSS/assets keep their normal long-lived caching.
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    if (request.method === "GET" && acceptsHtml) {
      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-cache, max-age=0, must-revalidate");
      headers.set("CDN-Cache-Control", "no-cache");
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    return response;
  },
};

export default worker;

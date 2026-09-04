/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runPlateRecognizerScan, runVehicleScan, ScanError } from "../lib/scan-core.mjs";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;

/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { runVehicleScan, ScanError } from "../lib/scan-core.mjs";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  GEMINI_API_KEY?: string;
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

async function scanVehicle(request: Request, env: Env) {
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

    if (wantsRaw) return json({ result, rawText, upstream });
    return json(debug ? { ...result, debug: { rawText } } : result);
  } catch (error) {
    if (error instanceof ScanError) {
      console.error("[scan]", error.userMessage, error.detail);
      return json(
        debug ? { error: error.userMessage, debug: { detail: error.detail } } : { error: error.userMessage },
        error.status,
      );
    }
    console.error("[scan] unexpected failure", error);
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

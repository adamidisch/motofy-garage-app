#!/usr/bin/env node
/**
 * Phase 1 proof script. Two modes:
 *
 *   Upstream (talks to Gemini directly, bypassing the app entirely):
 *     GEMINI_API_KEY=... node scripts/probe-gemini.mjs ./plate.jpg
 *
 *   Endpoint (talks to your running app):
 *     node scripts/probe-gemini.mjs ./plate.jpg --endpoint http://localhost:5173/api/scan
 *
 * Upstream mode prints the complete raw Gemini JSON. That is the artefact to
 * capture if anything still fails — it says exactly what the API objected to,
 * without digging through Worker logs.
 *
 * The image never leaves your machine except to the endpoint you point at.
 */

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { runVehicleScan, buildScanRequestBody, GEMINI_INTERACTIONS_URL, redactSecrets } from "../lib/scan-core.mjs";

const MIME_BY_EXT = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const PROBE_TIMEOUT_MS = 60_000;

/**
 * Hard guarantee that this script cannot print the API key.
 *
 * Rather than auditing each call site, every write to stdout and stderr is
 * filtered. The key is read once here and never echoed, and console output is
 * scrubbed of it plus anything matching a Google API key shape.
 */
const SECRETS = [process.env.GEMINI_API_KEY].filter(Boolean);
for (const stream of ["log", "error", "warn", "info"]) {
  const original = console[stream].bind(console);
  console[stream] = (...args) =>
    original(
      ...args.map((arg) =>
        typeof arg === "string" ? redactSecrets(arg, SECRETS) : redactSecrets(String(arg), SECRETS),
      ),
    );
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const imagePath = args.find((arg) => !arg.startsWith("--"));
const endpointIndex = args.indexOf("--endpoint");
const endpoint = endpointIndex === -1 ? null : args[endpointIndex + 1];

if (!imagePath) fail("Usage: node scripts/probe-gemini.mjs <image> [--endpoint <url>]");

const mimeType = MIME_BY_EXT[extname(imagePath).toLowerCase()];
if (!mimeType) fail(`Unsupported image type: ${extname(imagePath) || "(none)"}. Use jpg, png or webp.`);

const bytes = await readFile(imagePath).catch(() => fail(`Cannot read ${imagePath}`));
const imageData = bytes.toString("base64");

console.log(`\nimage      ${imagePath}`);
console.log(`size       ${(bytes.length / 1024).toFixed(0)} KB  (${imageData.length} base64 chars)`);
console.log(`mime       ${mimeType}`);

if (endpoint) {
  console.log(`mode       endpoint -> ${endpoint}\n`);
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData: `data:${mimeType};base64,${imageData}`, mimeType }),
  });
  const text = await response.text();
  console.log(`status     ${response.status}  (${Date.now() - started} ms)`);
  console.log("\n--- response body ---");
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text.slice(0, 4000));
  }
  console.log("---------------------\n");
  process.exit(response.ok ? 0 : 1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) fail("GEMINI_API_KEY is not set. Export it, or pass --endpoint to test the running app instead.");

console.log(`mode       upstream -> ${GEMINI_INTERACTIONS_URL}`);
console.log(`model      ${buildScanRequestBody({ imageData: "x", mimeType }).model}`);
console.log(`timeout    ${PROBE_TIMEOUT_MS / 1000}s\n`);

const started = Date.now();
try {
  const { result, rawText, upstream } = await runVehicleScan({
    apiKey,
    imageData,
    mimeType,
    timeoutMs: PROBE_TIMEOUT_MS,
    log: (message, ...rest) => console.error("  [log]", message, ...rest),
  });

  console.log("--- raw upstream JSON ---");
  console.log(redactSecrets(JSON.stringify(upstream, null, 2), SECRETS));
  console.log("--- model text ---");
  console.log(redactSecrets(rawText, SECRETS));
  console.log("--- parsed result (what the frontend receives) ---");
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nOK in ${Date.now() - started} ms`);

  if (!result.plate && !result.make) {
    console.log("\nNote: the pipeline worked but the model read nothing from this photo.");
    console.log("That is a photo-quality result, not a bug. Try a closer, sharper shot of the plate.");
  }
} catch (error) {
  console.error(`\nFAILED after ${Date.now() - started} ms`);
  console.error(`status     ${error.status ?? "-"}`);
  console.error(`message    ${error.userMessage ?? error.message}`);
  console.error(`detail     ${error.detail ?? "(none)"}`);
  console.error("\nPaste the detail line above — it contains the upstream response verbatim.\n");
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Diagnostic-only Plate Recognizer benchmark.
 *
 * Usage:
 *   PLATE_RECOGNIZER_TOKEN=... node scripts/probe-plate-recognizer.mjs ./plate.jpg --expect "PYZ 824"
 *
 * Windows PowerShell:
 *   $env:PLATE_RECOGNIZER_TOKEN="..."
 *   npm run plate:probe -- "C:\\Users\\pc10\\Downloads\\pyz824.png" --expect "PYZ 824"
 *
 * The token is read only from the environment and is never printed.
 * The image is sent directly from this script to Plate Recognizer Snapshot Cloud.
 */

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { normalisePlate, redactSecrets } from "../lib/scan-core.mjs";

const API_URL = "https://api.platerecognizer.com/v1/plate-reader/";
const DEFAULT_REGION = "cy";
const TIMEOUT_MS = 15_000;
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const args = process.argv.slice(2);
const imagePath = args.find((arg) => !arg.startsWith("--"));
const expectIndex = args.indexOf("--expect");
const expectedRaw = expectIndex === -1 ? null : args[expectIndex + 1];
const regionIndex = args.indexOf("--region");
const region = regionIndex === -1 ? DEFAULT_REGION : args[regionIndex + 1];

function fail(message) {
  console.error("\n" + message + "\n");
  process.exit(1);
}

if (!imagePath) {
  fail('Usage: node scripts/probe-plate-recognizer.mjs <image> [--expect "PYZ 824"] [--region cy]');
}

if (!region) fail("--region requires a value.");

const token = process.env.PLATE_RECOGNIZER_TOKEN;
if (!token) {
  fail("PLATE_RECOGNIZER_TOKEN is not set. Put it in your local environment; do not paste it into chat or commit it.");
}

const mimeType = MIME_BY_EXT[extname(imagePath).toLowerCase()];
if (!mimeType) fail("Unsupported image type. Use jpg, jpeg, png or webp.");

const bytes = await readFile(imagePath).catch(() => fail("Cannot read " + imagePath));
const form = new FormData();
form.append("upload", new Blob([bytes], { type: mimeType }), basename(imagePath));
form.append("regions", region);

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
const startedAt = performance.now();

let response;
let bodyText;
try {
  response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: "Token " + token,
    },
    body: form,
    signal: controller.signal,
  });
  bodyText = await response.text();
} catch (error) {
  clearTimeout(timer);
  const elapsedMs = Math.round(performance.now() - startedAt);
  if (error instanceof DOMException && error.name === "AbortError") {
    fail("Timed out after " + elapsedMs + " ms.");
  }
  fail("Request failed after " + elapsedMs + " ms: " + String(error));
}
clearTimeout(timer);

const wallMs = Math.round(performance.now() - startedAt);
let payload;
try {
  payload = JSON.parse(bodyText);
} catch {
  fail(
    "Plate Recognizer returned non-JSON HTTP " +
      response.status +
      ": " +
      redactSecrets(bodyText.slice(0, 2000), [token]),
  );
}

if (!response.ok) {
  fail(
    "Plate Recognizer HTTP " +
      response.status +
      ": " +
      redactSecrets(JSON.stringify(payload), [token]),
  );
}

const results = Array.isArray(payload.results) ? payload.results : [];
const top = [...results].sort((a, b) => Number(b?.score ?? 0) - Number(a?.score ?? 0))[0] ?? null;
const rawPlate = typeof top?.plate === "string" ? top.plate : null;
const plate = normalisePlate(rawPlate);
const score = typeof top?.score === "number" ? top.score : null;
const processingSeconds = typeof payload.processing_time === "number" ? payload.processing_time : null;
const apiMs = processingSeconds == null ? null : Math.round(processingSeconds * 1000);
const expected = expectedRaw ? normalisePlate(expectedRaw) : null;
const exactMatch = expected == null ? null : plate === expected;

console.log("");
console.log("Plate Recognizer diagnostic");
console.log("---------------------------");
console.log("image       " + imagePath);
console.log("size        " + Math.round(bytes.length / 1024) + " KB");
console.log("region      " + region);
console.log("HTTP        " + response.status);
console.log("wall time   " + wallMs + " ms");
console.log("API time    " + (apiMs == null ? "not reported" : apiMs + " ms"));
console.log("plate raw   " + (rawPlate ?? "(none)"));
console.log("plate       " + (plate ?? "(none)"));
console.log("confidence  " + (score == null ? "not reported" : (score * 100).toFixed(1) + "%"));
if (expected != null) {
  console.log("expected    " + expected);
  console.log("exact match " + (exactMatch ? "PASS" : "FAIL"));
}
console.log("results     " + results.length);
console.log("");

if (!top) process.exit(2);
if (expected != null && !exactMatch) process.exit(3);

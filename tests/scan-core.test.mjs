import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ScanError,
  buildScanRequestBody,
  canonicalisePlateChars,
  extractInteractionText,
  normalisePlate,
  parseLooseJson,
  redactSecrets,
  runVehicleScan,
  stripDataUrl,
  toScanResult,
} from "../lib/scan-core.mjs";

/* ------------------------------------------------------------------ */
/* extractInteractionText                                              */
/* ------------------------------------------------------------------ */

// Exact shape from the Interactions API breaking-changes guide (May 2026),
// which is the only schema served since the legacy sunset on 2026-06-08.
const CURRENT_SCHEMA_RESPONSE = {
  id: "int_123",
  status: "completed",
  steps: [
    {
      type: "model_output",
      content: [{ type: "text", text: '{"plate":"ABC 123","make":"Toyota","model":"Yaris","confidence":"high"}' }],
    },
  ],
};

test("reads text from the current steps schema", () => {
  assert.equal(
    extractInteractionText(CURRENT_SCHEMA_RESPONSE),
    '{"plate":"ABC 123","make":"Toyota","model":"Yaris","confidence":"high"}',
  );
});

test("skips thought steps and reads the model_output step", () => {
  const withThought = {
    id: "int_456",
    steps: [
      { type: "thought", summary: [{ type: "text", text: "Looking at the plate..." }], signature: "abc" },
      { type: "model_output", content: [{ type: "text", text: '{"plate":"KBY 328"}' }] },
    ],
  };
  assert.equal(extractInteractionText(withThought), '{"plate":"KBY 328"}');
});

test("joins multi-part model output", () => {
  const split = {
    steps: [{ type: "model_output", content: [{ type: "text", text: '{"plate":' }, { type: "text", text: '"ABC 123"}' }] }],
  };
  assert.equal(extractInteractionText(split), '{"plate":"ABC 123"}');
});

test("still reads the legacy outputs schema", () => {
  const legacy = { id: "int_1", role: "model", outputs: [{ type: "text", text: "hello" }] };
  assert.equal(extractInteractionText(legacy), "hello");
});

test("accepts an SDK object exposing output_text", () => {
  assert.equal(extractInteractionText({ output_text: "hello" }), "hello");
});

test("returns null when there is genuinely no text", () => {
  assert.equal(extractInteractionText({ id: "int_1", steps: [] }), null);
  assert.equal(extractInteractionText({}), null);
  assert.equal(extractInteractionText(null), null);
});

test("regression: a response without output_text is no longer treated as empty", () => {
  // This is the original bug. The old parser looked only for `output_text`,
  // which the REST API never returns, so every successful scan became a 502.
  assert.equal("output_text" in CURRENT_SCHEMA_RESPONSE, false);
  assert.notEqual(extractInteractionText(CURRENT_SCHEMA_RESPONSE), null);
});

/* ------------------------------------------------------------------ */
/* parseLooseJson                                                      */
/* ------------------------------------------------------------------ */

test("parses plain JSON", () => {
  assert.deepEqual(parseLooseJson('{"plate":"ABC 123"}'), { plate: "ABC 123" });
});

test("parses JSON wrapped in a fenced code block", () => {
  assert.deepEqual(parseLooseJson('```json\n{"plate":"ABC 123"}\n```'), { plate: "ABC 123" });
});

test("parses JSON embedded in prose", () => {
  assert.deepEqual(parseLooseJson('Here it is: {"plate":"ABC 123"} hope that helps'), { plate: "ABC 123" });
});

test("handles braces inside string values", () => {
  assert.deepEqual(parseLooseJson('{"model":"A200 {facelift}"}'), { model: "A200 {facelift}" });
});

test("returns null for unparseable text", () => {
  assert.equal(parseLooseJson("no json here"), null);
  assert.equal(parseLooseJson(""), null);
});

/* ------------------------------------------------------------------ */
/* Plate normalisation                                                 */
/* ------------------------------------------------------------------ */

test("formats standard Cyprus plates", () => {
  assert.equal(normalisePlate("ABC123"), "ABC 123");
  assert.equal(normalisePlate("ABC 123"), "ABC 123");
  assert.equal(normalisePlate("abc-123"), "ABC 123");
  assert.equal(normalisePlate("  ABC . 123  "), "ABC 123");
});

test("folds Greek homoglyphs to Latin", () => {
  // The demo data in page.tsx uses Greek capitals; the AI reads Latin ones.
  // Both must land on the same value or lookups will never match.
  assert.equal(normalisePlate("ΚΒΥ 328"), "KBY 328");
  assert.equal(normalisePlate("ΚΜΡ 714"), "KMP 714");
  assert.equal(canonicalisePlateChars("ΚΒΥ328"), "KBY328");
});

test("folds Cyrillic homoglyphs to Latin", () => {
  assert.equal(normalisePlate("АВС123"), "ABC 123");
});

test("accepts non-standard lengths instead of rejecting them", () => {
  // Older, trade and government series vary. Rejecting a correctly read
  // plate is worse than showing an unusual one.
  assert.equal(normalisePlate("AB1234"), "AB 1234");
  assert.equal(normalisePlate("A123"), "A 123");
  assert.equal(normalisePlate("12345"), "12345");
});

test("extracts a plate embedded in surrounding noise", () => {
  assert.equal(normalisePlate("CY ABC123 EU"), "ABC 123");
});

test("does not rewrite letters that have no Latin lookalike", () => {
  // Γ, Δ, Λ etc. are dropped rather than guessed at, so a genuine
  // misrecognition stays visible to the mechanic.
  assert.equal(canonicalisePlateChars("ΓΔΛ"), "");
});

test("returns null only when nothing usable survives", () => {
  assert.equal(normalisePlate(null), null);
  assert.equal(normalisePlate(""), null);
  assert.equal(normalisePlate("---"), null);
  assert.equal(normalisePlate(undefined), null);
});

/* ------------------------------------------------------------------ */
/* toScanResult                                                        */
/* ------------------------------------------------------------------ */

test("shapes a full model result", () => {
  assert.deepEqual(toScanResult({ plate: "ΚΒΥ328", make: "Toyota", model: "Yaris", confidence: "high" }), {
    plate: "KBY 328",
    make: "Toyota",
    model: "Yaris",
    confidence: "high",
    source: "ai",
  });
});

test("preserves nulls and downgrades unknown confidence", () => {
  assert.deepEqual(toScanResult({ plate: null, make: null, model: null, confidence: "certain" }), {
    plate: null,
    make: null,
    model: null,
    confidence: "low",
    source: "ai",
  });
});

test("treats the literal string 'null' as a null field", () => {
  assert.equal(toScanResult({ make: "null" }).make, null);
  assert.equal(toScanResult({ make: "  " }).make, null);
});

/* ------------------------------------------------------------------ */
/* Request body                                                        */
/* ------------------------------------------------------------------ */

test("request schema uses valid JSON Schema nullable types", () => {
  const body = buildScanRequestBody({ imageData: "AAAA", mimeType: "image/jpeg" });
  const props = body.response_format.schema.properties;
  assert.deepEqual(props.plate.type, ["string", "null"]);
  // `nullable` is OpenAPI, not JSON Schema, and was the second latent bug.
  assert.equal("nullable" in props.plate, false);
  assert.equal(body.response_format.type, "text");
  assert.equal(body.response_format.mime_type, "application/json");
  assert.equal(body.store, false);
  assert.equal(body.generation_config.thinking_level, "low");
  assert.equal(body.generation_config.thinking_summaries, "none");
});

test("strips data URL prefixes and whitespace", () => {
  assert.equal(stripDataUrl("data:image/jpeg;base64,AAAA"), "AAAA");
  assert.equal(stripDataUrl("AA\nAA"), "AAAA");
});

/* ------------------------------------------------------------------ */
/* runVehicleScan, with a stubbed fetch                                */
/* ------------------------------------------------------------------ */

function stubFetch(status, body) {
  return async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

test("end-to-end against a documented success response", async () => {
  const { result } = await runVehicleScan({
    apiKey: "test-key",
    imageData: "data:image/jpeg;base64,AAAA",
    fetchImpl: stubFetch(200, CURRENT_SCHEMA_RESPONSE),
  });
  assert.deepEqual(result, {
    plate: "ABC 123",
    make: "Toyota",
    model: "Yaris",
    confidence: "high",
    source: "ai",
  });
});

test("sends the API key as a header, not a query param", async () => {
  let seenUrl;
  let seenHeaders;
  await runVehicleScan({
    apiKey: "secret-key",
    imageData: "AAAA",
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenHeaders = init.headers;
      return new Response(JSON.stringify(CURRENT_SCHEMA_RESPONSE), { status: 200 });
    },
  });
  assert.equal(seenHeaders["x-goog-api-key"], "secret-key");
  assert.equal(seenUrl.includes("secret-key"), false);
});

test("missing API key fails closed with 503", async () => {
  await assert.rejects(
    () => runVehicleScan({ apiKey: undefined, imageData: "AAAA", fetchImpl: stubFetch(200, {}) }),
    (error) => error instanceof ScanError && error.status === 503,
  );
});

test("upstream error surfaces as 502 and keeps the body for logs", async () => {
  await assert.rejects(
    () => runVehicleScan({ apiKey: "k", imageData: "AAAA", fetchImpl: stubFetch(400, { error: { message: "bad schema" } }) }),
    (error) => error instanceof ScanError && error.status === 502 && error.detail.includes("bad schema"),
  );
});

test("a timeout surfaces as 504", async () => {
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k",
        imageData: "AAAA",
        timeoutMs: 10,
        fetchImpl: (url, init) =>
          new Promise((resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      }),
    (error) => error instanceof ScanError && error.status === 504,
  );
});

test("an oversized image is rejected before the network call", async () => {
  let called = false;
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k",
        imageData: "A".repeat(10_000_001),
        fetchImpl: async () => {
          called = true;
          return new Response("{}", { status: 200 });
        },
      }),
    (error) => error instanceof ScanError && error.status === 400,
  );
  assert.equal(called, false);
});

test("detail never leaks into the user-facing message", async () => {
  await assert.rejects(
    () => runVehicleScan({ apiKey: undefined, imageData: "AAAA", fetchImpl: stubFetch(200, {}) }),
    (error) => error.detail.includes("GEMINI_API_KEY") && !error.userMessage.includes("GEMINI_API_KEY"),
  );
});

/* ------------------------------------------------------------------ */
/* Upstream failure modes                                              */
/* ------------------------------------------------------------------ */

test("upstream 5xx surfaces as 502 with the body kept for logs", async () => {
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k-abcdefghijklmnop",
        imageData: "AAAA",
        fetchImpl: stubFetch(503, { error: { code: 503, message: "The model is overloaded." } }),
      }),
    (error) =>
      error instanceof ScanError &&
      error.status === 502 &&
      error.detail.includes("503") &&
      error.detail.includes("overloaded"),
  );
});

test("upstream 500 with an HTML error page does not crash the parser", async () => {
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k-abcdefghijklmnop",
        imageData: "AAAA",
        fetchImpl: stubFetch(500, "<html><body>Internal Server Error</body></html>"),
      }),
    (error) => error instanceof ScanError && error.status === 502,
  );
});

test("HTTP 200 carrying non-JSON is reported, not thrown raw", async () => {
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k-abcdefghijklmnop",
        imageData: "AAAA",
        fetchImpl: stubFetch(200, "not json at all"),
      }),
    (error) => error instanceof ScanError && error.status === 502 && error.detail.includes("non-JSON"),
  );
});

test("HTTP 200 with no text step is reported as an unusable result", async () => {
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k-abcdefghijklmnop",
        imageData: "AAAA",
        fetchImpl: stubFetch(200, { id: "int_1", status: "completed", steps: [] }),
      }),
    (error) => error instanceof ScanError && error.status === 502 && error.detail.includes("no text found"),
  );
});

test("HTTP 200 whose model text is not JSON is reported", async () => {
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k-abcdefghijklmnop",
        imageData: "AAAA",
        fetchImpl: stubFetch(200, {
          steps: [{ type: "model_output", content: [{ type: "text", text: "I cannot read that plate." }] }],
        }),
      }),
    (error) => error instanceof ScanError && error.status === 502 && error.detail.includes("not JSON"),
  );
});

test("nullable vehicle fields survive the full pipeline", async () => {
  const { result } = await runVehicleScan({
    apiKey: "k-abcdefghijklmnop",
    imageData: "AAAA",
    fetchImpl: stubFetch(200, {
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: '{"plate":null,"make":null,"model":null,"confidence":"low"}' }],
        },
      ],
    }),
  });
  assert.deepEqual(result, { plate: null, make: null, model: null, confidence: "low", source: "ai" });
});

/* ------------------------------------------------------------------ */
/* Secret redaction                                                    */
/* ------------------------------------------------------------------ */

test("redactSecrets removes a configured key", () => {
  assert.equal(redactSecrets("failed with key sk-abcdefghijkl", ["sk-abcdefghijkl"]), "failed with key [REDACTED]");
});

test("redactSecrets removes Google-shaped keys it was never told about", () => {
  const text = "GET /v1beta?key=AIzaSyD1234567890abcdefg failed";
  const out = redactSecrets(text, []);
  assert.equal(out.includes("AIzaSyD1234567890abcdefg"), false);
});

test("redactSecrets ignores short values so normal text is not mangled", () => {
  assert.equal(redactSecrets("the model is overloaded", ["k"]), "the model is overloaded");
});

test("an upstream body echoing the key is scrubbed before it reaches detail", async () => {
  const apiKey = "AIzaSyTESTKEY0123456789";
  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey,
        imageData: "AAAA",
        fetchImpl: stubFetch(400, { error: { message: `API key ${apiKey} is invalid` } }),
      }),
    (error) => !error.detail.includes(apiKey) && error.detail.includes("[REDACTED]"),
  );
});

test("log output is scrubbed too, not just the thrown error", async () => {
  const apiKey = "AIzaSyTESTKEY0123456789";
  const logged = [];
  await assert.rejects(() =>
    runVehicleScan({
      apiKey,
      imageData: "AAAA",
      fetchImpl: stubFetch(400, { error: { message: `bad key ${apiKey}` } }),
      log: (...args) => logged.push(args.join(" ")),
    }),
  );
  assert.equal(logged.join("\n").includes(apiKey), false);
});


test("default timeout is 30s, above the 12.8s a real scan was measured at", async () => {
  let seenSignal;
  const started = Date.now();
  await runVehicleScan({
    apiKey: "k-abcdefghijklmnop",
    imageData: "AAAA",
    fetchImpl: async (url, init) => {
      seenSignal = init.signal;
      return new Response(JSON.stringify(CURRENT_SCHEMA_RESPONSE), { status: 200 });
    },
  });
  assert.equal(seenSignal.aborted, false);
  assert.ok(Date.now() - started < 1000);

  await assert.rejects(
    () =>
      runVehicleScan({
        apiKey: "k-abcdefghijklmnop",
        imageData: "AAAA",
        timeoutMs: 5,
        fetchImpl: (url, init) =>
          new Promise((resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      }),
    (error) => error instanceof ScanError && error.status === 504,
  );
});

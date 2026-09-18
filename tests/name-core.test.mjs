import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NAME_MODEL,
  buildNameRequestBody,
  cleanGreeting,
  firstName,
  requestNormalizedName,
  runNameNormalize,
} from "../lib/name-core.mjs";

function geminiOk(greeting) {
  return async () => ({
    ok: true,
    async json() {
      return {
        steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ greeting }) }] }],
      };
    },
    async text() { return ""; },
  });
}

function geminiFail() {
  return async () => ({
    ok: false,
    status: 500,
    async json() { return {}; },
    async text() { return "upstream down"; },
  });
}

test("request body is lite text-only and has no name dictionary", () => {
  const body = buildNameRequestBody({ name: "antreas", lang: "el" });
  assert.equal(body.model, NAME_MODEL);
  assert.equal(body.input.length, 1);
  assert.equal(body.input[0].type, "text");
  assert.equal("NAME_MAP" in body, false);
  assert.match(body.input[0].text, /antreas/);
});

test("antreas normalizes through the Gemini response", async () => {
  const result = await runNameNormalize({
    apiKey: "test-key",
    name: "antreas",
    fetchImpl: geminiOk("Αντρέα"),
  });
  assert.equal(result.greeting, "Αντρέα");
});

test("marios normalizes through the Gemini response", async () => {
  const result = await runNameNormalize({
    apiKey: "test-key",
    name: "marios",
    fetchImpl: geminiOk("Μάριος"),
  });
  assert.equal(result.greeting, "Μάριος");
});

test("kattos normalizes through the Gemini response", async () => {
  const result = await runNameNormalize({
    apiKey: "test-key",
    name: "kattos",
    fetchImpl: geminiOk("Κάττε"),
  });
  assert.equal(result.greeting, "Κάττε");
});

test("unknown name falls back to the typed input when Gemini fails", async () => {
  await assert.rejects(
    () => runNameNormalize({ apiKey: "test-key", name: "xqzt", fetchImpl: geminiFail() }),
  );
  const greeting = await requestNormalizedName("xqzt", "el", geminiFail());
  assert.equal(greeting, "xqzt");
});

test("cleanGreeting never keeps a hello phrase", () => {
  assert.equal(cleanGreeting("Καλημέρα, Αντρέα", "antreas"), "Αντρέα");
  assert.equal(firstName("Andreas Christou"), "Andreas");
});

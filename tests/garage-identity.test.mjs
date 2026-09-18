import assert from "node:assert/strict";
import test from "node:test";
import { deriveGarageId, normaliseGarageName, normalisePin } from "../lib/garage-identity.mjs";

test("the same name and PIN always resolve to the same garage", async () => {
  assert.equal(await deriveGarageId("Kostas", "1111"), await deriveGarageId("  kostas  ", "1111"));
});

test("a PIN garage is different from the same name without a PIN", async () => {
  assert.notEqual(await deriveGarageId("kostas", "1111"), await deriveGarageId("kostas", ""));
});

test("different PINs isolate garages sharing the same display name", async () => {
  assert.notEqual(await deriveGarageId("kostas", "1111"), await deriveGarageId("kostas", "2222"));
});

test("identity input is canonical and the PIN keeps only four digits", () => {
  assert.equal(normaliseGarageName("  ΚΩΣΤΑΣ   Garage "), "κωστας garage");
  assert.equal(normalisePin("11-11-99"), "1111");
});

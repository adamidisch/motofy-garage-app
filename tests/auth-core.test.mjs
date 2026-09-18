import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAuthIdentity,
  canonicalLoginName,
  canonicalLoginPin,
  validateLoginIdentity,
} from "../lib/auth-core.mjs";

test("canonical login identity is stable", async () => {
  assert.equal(canonicalLoginName("  Κώστας   "), "κώστας");
  assert.equal(canonicalLoginPin("1a2b3c4d5"), "1234");
  const a = await buildAuthIdentity({ name: "Kostas", pin: "1111", pepper: "test" });
  const b = await buildAuthIdentity({ name: "  kostas ", pin: "1111", pepper: "test" });
  assert.equal(a.identityKey, b.identityKey);
  assert.equal(a.email, b.email);
  assert.equal(a.password, b.password);
});

test("same name with different PINs is a different identity", async () => {
  const a = await buildAuthIdentity({ name: "Kostas", pin: "1111", pepper: "test" });
  const b = await buildAuthIdentity({ name: "Kostas", pin: "2222", pepper: "test" });
  assert.notEqual(a.identityKey, b.identityKey);
  assert.notEqual(a.password, b.password);
});

test("PIN is optional but must be empty or four digits", () => {
  assert.equal(validateLoginIdentity("Marios", "").ok, true);
  assert.equal(validateLoginIdentity("Marios", "12").ok, false);
  assert.equal(validateLoginIdentity("", "1234").ok, false);
});

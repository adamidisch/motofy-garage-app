import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  addCost,
  addPart,
  cyclePart,
  getJobWorkflow,
  removeCost,
  removePart,
  setCustomerNote,
  setReady,
  totalCost,
  updateJobWorkflow,
} from "../lib/data/workflow-store.mjs";

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
    clear() { map.clear(); },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
});

test("new workflow starts empty", () => {
  assert.deepEqual(getJobWorkflow("job_a"), {
    parts: [], costs: [], ready: false, customerNote: "",
  });
});

test("parts persist, cycle in order and can be removed", () => {
  const added = addPart("job_a", "  Τακάκια εμπρός  ");
  assert.equal(added.parts.length, 1);
  assert.equal(added.parts[0].label, "Τακάκια εμπρός");
  assert.equal(added.parts[0].status, "needed");

  const id = added.parts[0].id;
  assert.equal(cyclePart("job_a", id).parts[0].status, "ordered");
  assert.equal(cyclePart("job_a", id).parts[0].status, "waiting");
  assert.equal(cyclePart("job_a", id).parts[0].status, "arrived");
  assert.equal(cyclePart("job_a", id).parts[0].status, "needed");
  assert.equal(removePart("job_a", id).parts.length, 0);
});

test("empty part labels are ignored", () => {
  addPart("job_a", "   ");
  assert.equal(getJobWorkflow("job_a").parts.length, 0);
});

test("cost rows validate input and calculate total", () => {
  addCost("job_a", "Service", "45.50");
  addCost("job_a", "Filter", "12,25");
  addCost("job_a", "Blank amount", "");
  addCost("job_a", "Negative", -1);
  addCost("job_a", "Bad", "abc");

  const workflow = getJobWorkflow("job_a");
  assert.equal(workflow.costs.length, 2);
  assert.equal(workflow.costs[0].amount, 45.5);
  assert.equal(workflow.costs[1].amount, 12.25);
  assert.equal(totalCost(workflow), 57.75);

  const id = workflow.costs[0].id;
  removeCost("job_a", id);
  assert.equal(totalCost(getJobWorkflow("job_a")), 12.25);
});

test("ready and customer note survive a re-read", () => {
  setReady("job_a", true);
  setCustomerNote("job_a", "  Έτοιμο μετά τις 4.  ");
  const reread = getJobWorkflow("job_a");
  assert.equal(reread.ready, true);
  assert.equal(reread.customerNote, "Έτοιμο μετά τις 4.");
});

test("customer note is capped and malformed storage fails safe", () => {
  setCustomerNote("job_a", "x".repeat(900));
  assert.equal(getJobWorkflow("job_a").customerNote.length, 600);

  globalThis.localStorage.setItem("motofy-v220-workflows", "{broken");
  assert.deepEqual(getJobWorkflow("job_a"), {
    parts: [], costs: [], ready: false, customerNote: "",
  });
});

test("workflow data is isolated by job id", () => {
  addPart("job_a", "A");
  addCost("job_b", "B", 10);
  setReady("job_b", true);

  assert.equal(getJobWorkflow("job_a").parts.length, 1);
  assert.equal(getJobWorkflow("job_a").costs.length, 0);
  assert.equal(getJobWorkflow("job_a").ready, false);
  assert.equal(getJobWorkflow("job_b").parts.length, 0);
  assert.equal(getJobWorkflow("job_b").costs.length, 1);
  assert.equal(getJobWorkflow("job_b").ready, true);
});

test("partial workflow updates are normalized before storage", () => {
  updateJobWorkflow("job_a", { ready: true, customerNote: " hello " });
  assert.deepEqual(getJobWorkflow("job_a"), {
    parts: [], costs: [], ready: true, customerNote: "hello",
  });
});

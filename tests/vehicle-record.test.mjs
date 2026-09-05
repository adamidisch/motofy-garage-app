import { test } from "node:test";
import assert from "node:assert/strict";

import { createMemoryStorage, createRepository } from "../lib/data/repository.mjs";
import {
  buildScanSuggestion,
  buildVehicleListRow,
  buildVehicleRecord,
  compareScanToVehicle,
  formatDate,
  formatMileage,
  formatRelative,
  formatTodayLabel,
  initials,
  lastActivityOf,
  matchesVehicleQuery,
  vehicleSubtitle,
  vehicleTitle,
} from "../lib/data/vehicle-record.mjs";

const FIXED_NOW = new Date("2026-09-05T09:00:00.000Z");

function repo(options = {}) {
  return createRepository({ storage: createMemoryStorage(), now: () => FIXED_NOW, ...options });
}

function record(repository, vehicleId, scan = null) {
  return buildVehicleRecord({ repository, vehicleId, scan });
}

/* ------------------------------------------------------------------ */
/* Opening an existing vehicle                                         */
/* ------------------------------------------------------------------ */

test("opens an existing vehicle by id", () => {
  const r = repo();
  const view = record(r, "veh_yaris");

  assert.ok(view);
  assert.equal(view.vehicle.id, "veh_yaris");
  assert.equal(view.display.plate, "KBY 328");
  assert.equal(view.display.title, "Toyota Yaris");
  assert.equal(view.display.subtitle, "2018 · Ασημί");
  assert.equal(view.display.mileageKm, 86420);
});

test("a scanned plate opens the existing record rather than a second one", () => {
  const r = repo();
  const before = r.listVehicles().length;

  // What the scan flow does: look the plate up, open what it finds.
  const found = r.findVehicleByPlate("ΚΒΥ 328");
  const view = record(r, found.id);

  assert.equal(view.vehicle.id, "veh_yaris");
  assert.equal(r.listVehicles().length, before, "opening a record must not create anything");
});

test("returns null for a vehicle that is not in this garage", () => {
  const r = repo();
  assert.equal(record(r, "veh_nope"), null);
  assert.equal(record(r, ""), null);
  assert.equal(buildVehicleRecord({ repository: r }), null);
  assert.equal(buildVehicleRecord({}), null);
});

test("building a record never writes", () => {
  const r = repo();
  const before = JSON.stringify(r.snapshot());
  record(r, "veh_yaris");
  record(r, "veh_orphan", { make: "Peugeot", model: "208", confidence: "high" });
  assert.equal(JSON.stringify(r.snapshot()), before, "the screen is read-only");
  assert.equal(r.canUndo(), false, "nothing was pushed onto the undo stack");
});

/* ------------------------------------------------------------------ */
/* Customer resolved through customer_id                               */
/* ------------------------------------------------------------------ */

test("resolves the customer through customer_id", () => {
  const r = repo();
  const view = record(r, "veh_yaris");
  assert.equal(view.customer.id, "cus_marios");
  assert.equal(view.customer.name, "Μάριος Παναγή");
  assert.equal(view.customer.phone, "+357 99 412 830");
});

test("the customer tab lists that customer's other vehicles", () => {
  const r = repo();
  const view = record(r, "veh_yaris");
  assert.deepEqual(view.customerVehicles.map((v) => v.plate).sort(), ["KBY 328", "ZKA 517"]);
  assert.deepEqual(view.otherVehicles.map((v) => v.plate), ["ZKA 517"]);
  assert.equal(view.empty.otherVehicles, false);
});

test("namesakes do not share vehicles", () => {
  const r = repo();
  // A second Μιχάλης Σάββα, with his own car.
  const twin = r.createCustomer({ name: "Μιχάλης Σάββα" });
  const twinCar = r.createVehicle({ plate: "TWN 001", make: "Seat", model: "Ibiza", customer_id: twin.id });

  const original = record(r, "veh_fiesta");
  const other = record(r, twinCar.id);

  assert.equal(original.customer.id, "cus_michalis");
  assert.equal(other.customer.id, twin.id);
  assert.notEqual(original.customer.id, other.customer.id);
  assert.deepEqual(original.otherVehicles, [], "the namesake's car must not appear here");
  assert.deepEqual(other.otherVehicles, []);
});

/* ------------------------------------------------------------------ */
/* Jobs and notes through vehicle_id                                   */
/* ------------------------------------------------------------------ */

test("resolves jobs through vehicle_id and splits open from history", () => {
  const r = repo();
  const view = record(r, "veh_yaris");

  assert.equal(view.jobs.all.length, 2);
  for (const job of view.jobs.all) assert.equal(job.vehicle_id, "veh_yaris");
  assert.equal(view.jobs.open.length, 0);
  assert.equal(view.jobs.history.length, 2);
  assert.equal(view.jobs.current, null);
});

test("an in-progress job outranks a scheduled one as the current job", () => {
  const r = repo();
  const bmw = record(r, "veh_bmw");
  assert.equal(bmw.jobs.current.status, "in_progress");
  assert.equal(bmw.jobs.current.title, "Διάγνωση check engine");

  // Adding a scheduled job must not displace the one on the ramp.
  r.createJob({ vehicle_id: "veh_bmw", title: "Ευθυγράμμιση", status: "scheduled" });
  assert.equal(record(r, "veh_bmw").jobs.current.status, "in_progress");
});

test("a cancelled job is history, not an open job", () => {
  const r = repo();
  const view = record(r, "veh_note");
  assert.equal(view.jobs.open.length, 0);
  assert.equal(view.jobs.history.length, 1);
  assert.equal(view.jobs.history[0].status, "cancelled");
  assert.equal(view.empty.openJob, true);
  assert.equal(view.empty.jobs, false);
});

test("resolves notes through vehicle_id, newest first", () => {
  const r = repo();
  const view = record(r, "veh_bmw");
  assert.equal(view.notes.length, 2);
  for (const note of view.notes) assert.equal(note.vehicle_id, "veh_bmw");
  assert.ok(view.notes[0].created_at >= view.notes[1].created_at, "newest note leads");
});

test("a note's photos are paths, and are carried through to the screen", () => {
  const r = repo();
  const view = record(r, "veh_bmw");
  const withPhoto = view.notes.find((note) => note.photo_paths.length > 0);
  assert.ok(withPhoto);
  assert.equal(withPhoto.photo_paths[0].startsWith("http"), false);
});

/* ------------------------------------------------------------------ */
/* Empty states                                                        */
/* ------------------------------------------------------------------ */

test("a vehicle with no customer reports an empty customer state", () => {
  const r = repo();
  const view = record(r, "veh_orphan");
  assert.equal(view.customer, null);
  assert.equal(view.empty.customer, true);
  assert.deepEqual(view.customerVehicles, []);
  assert.deepEqual(view.otherVehicles, []);
});

test("a vehicle with no jobs and no notes reports both empty states", () => {
  const r = repo();
  const bare = r.createVehicle({ plate: "BAR 001" });
  const view = record(r, bare.id);

  assert.deepEqual(view.jobs.all, []);
  assert.deepEqual(view.notes, []);
  assert.equal(view.empty.jobs, true);
  assert.equal(view.empty.openJob, true);
  assert.equal(view.empty.history, true);
  assert.equal(view.empty.notes, true);
  assert.equal(view.empty.details, true, "no make or model confirmed");
  assert.equal(view.empty.mileage, true);
  assert.equal(view.display.title, null, "the screen falls back rather than printing 'null'");
  assert.equal(view.display.subtitle, null);
});

test("a customer with a single vehicle reports no other vehicles", () => {
  const r = repo();
  const view = record(r, "veh_fiesta");
  assert.equal(view.empty.customer, false);
  assert.equal(view.empty.otherVehicles, true);
});

test("mileage and dates degrade to a dash rather than to null or NaN", () => {
  assert.equal(formatMileage(null), "—");
  assert.equal(formatMileage(undefined), "—");
  assert.equal(formatMileage("86.420 km"), "—", "already-formatted text is not a number");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("not a date"), "—");
  assert.equal(formatRelative(null), "—");
  assert.equal(initials(""), "—");
  assert.equal(vehicleTitle(null), null);
  assert.equal(vehicleSubtitle({ year: null, colour: null }), null);
});

/* ------------------------------------------------------------------ */
/* Scan conflicts shown, never applied                                 */
/* ------------------------------------------------------------------ */

test("a disagreeing scan is offered as a suggestion and changes nothing", () => {
  const r = repo();
  const scan = { plate: "KBY 328", make: "Nissan", model: "Micra", confidence: "high", provider: "gemini" };
  const view = record(r, "veh_yaris", scan);

  assert.ok(view.scanSuggestion);
  assert.equal(view.scanSuggestion.applied, false);
  assert.deepEqual(view.scanSuggestion.conflicts, [
    { field: "make", current: "Toyota", scanned: "Nissan" },
    { field: "model", current: "Yaris", scanned: "Micra" },
  ]);

  // The record itself is untouched, in the view model and in storage.
  assert.equal(view.vehicle.make, "Toyota");
  assert.equal(view.vehicle.model, "Yaris");
  assert.equal(r.getVehicle("veh_yaris").make, "Toyota");
  assert.equal(r.getVehicle("veh_yaris").scan_make, null, "nothing was written by viewing");
});

test("an agreeing scan produces no suggestion", () => {
  const r = repo();
  const view = record(r, "veh_yaris", { make: "toyota", model: "YARIS", confidence: "high" });
  assert.equal(view.scanSuggestion, null);
});

test("a vehicle with an unconfirmed reading offers it without conflict", () => {
  const r = repo();
  // Seeded from a scan: make and model present, confirmed_at null.
  const view = record(r, "veh_orphan");
  assert.ok(view.scanSuggestion);
  assert.equal(view.scanSuggestion.unconfirmed, true);
  assert.deepEqual(view.scanSuggestion.conflicts, [], "agreeing with itself is not a conflict");
  assert.equal(view.scanSuggestion.confidence, "medium");
  assert.equal(view.scanSuggestion.provider, "gemini");
});

test("a confirmed vehicle with no reading shows no banner", () => {
  const r = repo();
  assert.equal(record(r, "veh_fiesta").scanSuggestion, null);
});

test("compareScanToVehicle treats a blank field as nothing to say", () => {
  const vehicle = { make: "Toyota", model: "Yaris" };
  assert.deepEqual(compareScanToVehicle(vehicle, { make: null, model: null }), []);
  assert.deepEqual(compareScanToVehicle(vehicle, { make: "Toyota" }), []);
  assert.deepEqual(compareScanToVehicle(null, { make: "X" }), []);
  assert.deepEqual(compareScanToVehicle(vehicle, null), []);
  // An empty record is not in conflict; it is waiting to be filled.
  assert.deepEqual(compareScanToVehicle({ make: null, model: null }, { make: "Kia", model: "Rio" }), []);
});

test("buildScanSuggestion returns null when there is nothing to offer", () => {
  assert.equal(buildScanSuggestion(null), null);
  assert.equal(buildScanSuggestion({ make: "Toyota", confirmed_at: "2026-01-01T00:00:00Z" }), null);
});

/* ------------------------------------------------------------------ */
/* Last activity                                                       */
/* ------------------------------------------------------------------ */

test("last activity picks the most recent event across jobs, notes and scans", () => {
  const r = repo();
  const view = record(r, "veh_bmw");
  assert.ok(view.lastActivity);
  for (const entry of [view.lastActivity]) {
    assert.ok(["note", "job", "job_completed", "scan", "created"].includes(entry.kind));
  }

  const newest = r.createNote({ vehicle_id: "veh_bmw", body: "Τελευταία εξέλιξη." });
  const after = record(r, "veh_bmw");
  assert.equal(after.lastActivity.kind, "note");
  assert.equal(after.lastActivity.note.id, newest.id);
});

test("a vehicle with nothing but its own creation still reports activity", () => {
  const r = repo();
  const bare = r.createVehicle({ plate: "ACT 001" });
  const view = record(r, bare.id);
  assert.equal(view.lastActivity.kind, "created");
  assert.equal(lastActivityOf({}), null);
});

/* ------------------------------------------------------------------ */
/* List rows and search                                                */
/* ------------------------------------------------------------------ */

test("list rows resolve owner and current job through relations", () => {
  const r = repo();
  const row = buildVehicleListRow(r, r.getVehicle("veh_bmw"));
  assert.equal(row.customer.name, "Ανδρέας Χρίστου");
  assert.equal(row.currentJob.status, "in_progress");
  assert.equal(row.title, "BMW 320i");

  const orphanRow = buildVehicleListRow(r, r.getVehicle("veh_orphan"));
  assert.equal(orphanRow.customer, null);
  assert.equal(orphanRow.currentJob, null);
});

test("search matches plate, make, model and owner, in either script", () => {
  const r = repo();
  const row = buildVehicleListRow(r, r.getVehicle("veh_yaris"));
  for (const query of ["", "kby", "KBY 328", "toyota", "Yaris", "μάριος", "ΚΒΥ328"]) {
    assert.equal(matchesVehicleQuery(row, query), true, `failed for ${query}`);
  }
  assert.equal(matchesVehicleQuery(row, "bmw"), false);
});

/* ------------------------------------------------------------------ */
/* Dates come from the clock                                           */
/* ------------------------------------------------------------------ */

test("the today label follows the clock instead of being hardcoded", () => {
  const september = formatTodayLabel(new Date("2026-09-05T09:00:00Z"), "el");
  const march = formatTodayLabel(new Date("2027-03-01T09:00:00Z"), "el");

  assert.notEqual(september, march);
  assert.ok(september.startsWith("ΣΗΜΕΡΑ · "));
  assert.ok(september.includes("5"));
  assert.notEqual(september, "ΣΗΜΕΡΑ · 2 ΣΕΠ", "the old constant is gone");
  assert.ok(formatTodayLabel(new Date("2026-09-05T09:00:00Z"), "en").startsWith("TODAY · "));
});

test("relative times read naturally and fall back to a date when distant", () => {
  const now = new Date("2026-09-05T12:00:00Z");
  assert.equal(typeof formatRelative("2026-09-04T12:00:00Z", now, "el"), "string");
  assert.equal(formatRelative("2026-09-05T10:00:00Z", now, "en"), "2 hours ago");
  // Beyond about six weeks a relative phrase stops being useful.
  assert.equal(formatRelative("2025-01-01T00:00:00Z", now, "en"), formatDate("2025-01-01T00:00:00Z", "en"));
});

test("mileage is formatted for the active language", () => {
  assert.equal(formatMileage(86420, "el"), "86.420 km");
  assert.equal(formatMileage(86420, "en"), "86,420 km");
  assert.equal(formatMileage(0, "el"), "0 km");
});

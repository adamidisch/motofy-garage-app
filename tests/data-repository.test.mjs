import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ConstraintError,
  SCHEMA_VERSION,
  STORAGE_KEY,
  mileage,
  plateKey,
  vehiclePhotoPath,
} from "../lib/data/schema.mjs";
import { DEMO_GARAGE_ID, createSeed } from "../lib/data/seed.mjs";
import { createMemoryStorage, createRepository } from "../lib/data/repository.mjs";

const FIXED_NOW = new Date("2026-09-05T09:00:00.000Z");

/** A repository with its own storage, so no test can affect another. */
function repo(options = {}) {
  return createRepository({ storage: createMemoryStorage(), now: () => FIXED_NOW, ...options });
}

/* ------------------------------------------------------------------ */
/* Plate lookup                                                        */
/* ------------------------------------------------------------------ */

test("finds a vehicle by plate however the plate is written", () => {
  const r = repo();
  const target = r.findVehicleByPlate("KBY 328");
  assert.ok(target, "seeded vehicle should be found");
  assert.equal(target.make, "Toyota");

  // The same car, reached six ways. A camera reading and a hand-typed plate
  // must land on one record or the garage files the car twice.
  for (const written of ["KBY328", "kby 328", "kby-328", "ΚΒΥ 328", "ΚΒΥ328", "  KBY  328  "]) {
    assert.equal(r.findVehicleByPlate(written)?.id, target.id, `failed for ${written}`);
  }
});

test("plate lookup returns null rather than guessing", () => {
  const r = repo();
  assert.equal(r.findVehicleByPlate("ZZZ 999"), null);
  assert.equal(r.findVehicleByPlate(""), null);
  assert.equal(r.findVehicleByPlate(null), null);
});

test("stored plates are normalised to Latin display form", () => {
  const r = repo();
  // Seeded with Greek capitals; stored and shown as Latin.
  assert.equal(r.findVehicleByPlate("ΚΒΥ 328").plate, "KBY 328");
  assert.equal(plateKey("ΚΒΥ 328"), plateKey("KBY328"));
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

test("customer to vehicles relation resolves by id, not by name", () => {
  const r = repo();
  const vehicles = r.listVehiclesByCustomer("cus_marios");
  assert.equal(vehicles.length, 2, "Μάριος owns two vehicles in the seed");
  assert.deepEqual(vehicles.map((v) => v.plate).sort(), ["KBY 328", "ZKA 517"]);
  for (const vehicle of vehicles) assert.equal(vehicle.customer_id, "cus_marios");
});

test("two customers could share a name without merging their vehicles", () => {
  const r = repo();
  const first = r.createCustomer({ name: "Μιχάλης Σάββα", phone: "+357 99 111 111" });
  assert.notEqual(first.id, "cus_michalis");

  const car = r.createVehicle({ plate: "XYZ 111", customer_id: first.id });
  assert.deepEqual(r.listVehiclesByCustomer(first.id).map((v) => v.id), [car.id]);
  // The seeded namesake keeps only their own vehicle.
  assert.deepEqual(r.listVehiclesByCustomer("cus_michalis").map((v) => v.plate), ["KMN 246"]);
});

test("vehicle to jobs and notes relations resolve by id", () => {
  const r = repo();
  const bmw = r.findVehicleByPlate("KMP 714");

  const jobs = r.listJobsByVehicle(bmw.id);
  assert.equal(jobs.length, 2);
  for (const job of jobs) assert.equal(job.vehicle_id, bmw.id);

  const notes = r.listNotesByVehicle(bmw.id);
  assert.equal(notes.length, 2);
  for (const note of notes) assert.equal(note.vehicle_id, bmw.id);
});

test("jobs can be filtered to the open ones and ordered both ways", () => {
  const r = repo();
  const yaris = r.findVehicleByPlate("KBY 328");

  assert.equal(r.listJobsByVehicle(yaris.id, { status: "open" }).length, 0);
  assert.equal(r.listJobsByVehicle(yaris.id, { status: "done" }).length, 2);

  const desc = r.listJobsByVehicle(yaris.id);
  const asc = r.listJobsByVehicle(yaris.id, { order: "asc" });
  assert.deepEqual(desc.map((j) => j.id), [...asc].reverse().map((j) => j.id));

  const open = r.listOpenJobs();
  assert.ok(open.length > 0);
  for (const job of open) assert.ok(["scheduled", "in_progress"].includes(job.status));
});

test("jobs and notes cannot be attached to a vehicle outside the garage", () => {
  const r = repo();
  assert.throws(() => r.createJob({ vehicle_id: "veh_does_not_exist", title: "X" }), ConstraintError);
  assert.throws(() => r.createNote({ vehicle_id: "veh_does_not_exist", body: "X" }), ConstraintError);
  assert.throws(() => r.createVehicle({ plate: "AAA 111", customer_id: "cus_nope" }), ConstraintError);
});

/* ------------------------------------------------------------------ */
/* Persistence and rehydration                                         */
/* ------------------------------------------------------------------ */

test("data survives a reload through the same storage", () => {
  const storage = createMemoryStorage();
  const first = createRepository({ storage, now: () => FIXED_NOW });
  const created = first.createVehicle({ plate: "NEW 001", make: "Skoda", model: "Octavia", mileage_km: 12000 });
  first.createNote({ vehicle_id: created.id, body: "Παραλήφθηκε για έλεγχο." });

  const second = createRepository({ storage, now: () => FIXED_NOW });
  assert.equal(second.status, "loaded");
  const reloaded = second.findVehicleByPlate("NEW001");
  assert.equal(reloaded.id, created.id);
  assert.equal(reloaded.mileage_km, 12000);
  assert.equal(second.listNotesByVehicle(created.id).length, 1);
});

test("a corrupt payload is set aside rather than crashing or vanishing silently", () => {
  const storage = createMemoryStorage({ [STORAGE_KEY]: "{ not json at all" });
  const r = createRepository({ storage, now: () => FIXED_NOW });
  assert.equal(r.status, "reset_unreadable");
  assert.ok(r.listVehicles().length > 0, "falls back to the seed");
  const backups = Object.keys(storage).length;
  assert.ok(storage.getItem(STORAGE_KEY), "a fresh dataset was written");
  assert.equal(typeof backups, "number");
});

test("an unknown schema version is backed up and reset, not parsed hopefully", () => {
  const future = { ...createSeed({ now: FIXED_NOW }), version: SCHEMA_VERSION + 99 };
  const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(future) });
  const r = createRepository({ storage, now: () => FIXED_NOW });
  assert.equal(r.status, "reset_version");
  assert.equal(r.snapshot().version, SCHEMA_VERSION);
});

test("an individual unusable row is dropped without losing the dataset", () => {
  const seed = createSeed({ now: FIXED_NOW });
  seed.vehicles.push({ id: "veh_broken", garage_id: DEMO_GARAGE_ID, plate: "" });
  const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(seed) });
  const r = createRepository({ storage, now: () => FIXED_NOW });
  assert.equal(r.status, "loaded");
  assert.equal(r.getVehicle("veh_broken"), null);
  assert.ok(r.listVehicles().length >= 7);
});

test("callers receive copies, so stored state cannot be mutated by accident", () => {
  const r = repo();
  const vehicle = r.getVehicle("veh_yaris");
  vehicle.make = "TAMPERED";
  assert.equal(r.getVehicle("veh_yaris").make, "Toyota");
});

/* ------------------------------------------------------------------ */
/* Duplicate plate prevention                                          */
/* ------------------------------------------------------------------ */

test("a duplicate plate is refused, including across scripts and formatting", () => {
  const r = repo();
  for (const written of ["KBY 328", "kby328", "ΚΒΥ-328"]) {
    assert.throws(
      () => r.createVehicle({ plate: written }),
      (error) => error instanceof ConstraintError && error.code === "duplicate_plate",
      `should have refused ${written}`,
    );
  }
  assert.equal(r.listVehicles().filter((v) => v.plate === "KBY 328").length, 1);
});

test("updating a plate onto an existing one is refused", () => {
  const r = repo();
  const fresh = r.createVehicle({ plate: "QQQ 777" });
  assert.throws(
    () => r.updateVehicle(fresh.id, { plate: "KBY 328" }),
    (error) => error instanceof ConstraintError && error.code === "duplicate_plate",
  );
  assert.equal(r.getVehicle(fresh.id).plate, "QQQ 777");
});

test("a vehicle cannot be created without a readable plate", () => {
  const r = repo();
  assert.throws(() => r.createVehicle({ plate: "" }));
  assert.throws(() => r.createVehicle({ plate: "---" }));
});

/* ------------------------------------------------------------------ */
/* Existing record wins over a new scan                                */
/* ------------------------------------------------------------------ */

test("an existing vehicle is not overwritten by a disagreeing scan", () => {
  const r = repo();
  const before = r.findVehicleByPlate("KBY 328");

  const outcome = r.applyScanResult({
    plate: "ΚΒΥ 328",
    make: "Nissan",
    model: "Micra",
    confidence: "high",
    provider: "gemini",
  });

  assert.equal(outcome.created, false);
  assert.equal(outcome.vehicle.id, before.id);
  // Confirmed columns untouched.
  assert.equal(outcome.vehicle.make, "Toyota");
  assert.equal(outcome.vehicle.model, "Yaris");
  // The reading is kept, separately, so the UI can offer it.
  assert.equal(outcome.vehicle.scan_make, "Nissan");
  assert.equal(outcome.vehicle.scan_model, "Micra");
  assert.ok(outcome.vehicle.scanned_at);
  assert.deepEqual(outcome.conflicts, [
    { field: "make", current: "Toyota", scanned: "Nissan" },
    { field: "model", current: "Yaris", scanned: "Micra" },
  ]);
  // Nothing new was filed.
  assert.equal(r.listVehicles().filter((v) => v.plate_key === before.plate_key).length, 1);
});

test("an agreeing scan reports no conflict", () => {
  const r = repo();
  const outcome = r.applyScanResult({ plate: "KBY 328", make: "toyota", model: "YARIS", confidence: "high" });
  assert.deepEqual(outcome.conflicts, []);
  assert.equal(outcome.vehicle.make, "Toyota");
});

test("an unknown plate creates a record and opens it as new", () => {
  const r = repo();
  const outcome = r.applyScanResult({
    plate: "PYZ 824",
    make: "Land Rover",
    model: "Range Rover",
    confidence: "high",
    provider: "plate-recognizer",
  });
  assert.equal(outcome.created, true);
  assert.equal(outcome.vehicle.plate, "PYZ 824");
  assert.equal(outcome.vehicle.make, "Land Rover");
  assert.equal(outcome.vehicle.customer_id, null, "customer is left for the mechanic to attach");
  assert.equal(outcome.vehicle.confirmed_at, null, "not confirmed until a human says so");
  assert.equal(r.findVehicleByPlate("pyz824").id, outcome.vehicle.id);
});

test("confirming promotes the scan reading into the confirmed columns", () => {
  const r = repo();
  r.applyScanResult({ plate: "KBY 328", make: "Nissan", model: "Micra", confidence: "high" });
  const confirmed = r.confirmScannedDetails("veh_yaris");
  assert.equal(confirmed.make, "Nissan");
  assert.equal(confirmed.model, "Micra");
  assert.ok(confirmed.confirmed_at, "confirmation is recorded");
});

test("a scan without a readable plate is rejected", () => {
  const r = repo();
  assert.throws(() => r.applyScanResult({ plate: null, make: "Toyota" }));
});

/* ------------------------------------------------------------------ */
/* Undo                                                                */
/* ------------------------------------------------------------------ */

test("creating a vehicle can be undone", () => {
  const r = repo();
  const count = r.listVehicles().length;
  const created = r.createVehicle({ plate: "UND 001", make: "Kia" });

  assert.equal(r.canUndo(), true);
  assert.equal(r.peekUndo().label, "create_vehicle");

  const undone = r.undo();
  assert.equal(undone.label, "create_vehicle");
  assert.equal(r.getVehicle(created.id), null);
  assert.equal(r.listVehicles().length, count);
  // The plate is free again, so a corrected retry is possible.
  assert.doesNotThrow(() => r.createVehicle({ plate: "UND 001", make: "Kia" }));
});

test("linking a customer can be undone back to unassigned", () => {
  const r = repo();
  const orphan = r.findVehicleByPlate("TPH 059");
  assert.equal(orphan.customer_id, null);

  r.linkVehicleToCustomer(orphan.id, "cus_georgia");
  assert.equal(r.getVehicle(orphan.id).customer_id, "cus_georgia");

  r.undo();
  assert.equal(r.getVehicle(orphan.id).customer_id, null);
  assert.deepEqual(r.listUnassignedVehicles().map((v) => v.id), [orphan.id]);
});

test("undo works for jobs and notes and unwinds in order", () => {
  const r = repo();
  const vehicle = r.findVehicleByPlate("KMN 246");
  const job = r.createJob({ vehicle_id: vehicle.id, title: "Έλεγχος φρένων" });
  const note = r.createNote({ vehicle_id: vehicle.id, body: "Ο πελάτης περιμένει." });

  r.undo();
  assert.equal(r.listNotesByVehicle(vehicle.id).some((n) => n.id === note.id), false);
  assert.ok(r.getJob(job.id), "only the most recent operation was reversed");

  r.undo();
  assert.equal(r.getJob(job.id), null);
});

test("undo persists, so it is not lost on reload", () => {
  const storage = createMemoryStorage();
  const first = createRepository({ storage, now: () => FIXED_NOW });
  const created = first.createVehicle({ plate: "TMP 500" });
  first.undo();

  const second = createRepository({ storage, now: () => FIXED_NOW });
  assert.equal(second.getVehicle(created.id), null);
});

test("undo on an empty stack is a no-op", () => {
  const r = repo();
  assert.equal(r.canUndo(), false);
  assert.equal(r.undo(), null);
  assert.equal(r.peekUndo(), null);
});

/* ------------------------------------------------------------------ */
/* Garage scoping                                                      */
/* ------------------------------------------------------------------ */

test("a repository never returns another garage's rows", () => {
  const storage = createMemoryStorage();
  const mine = createRepository({ storage, now: () => FIXED_NOW });
  mine.createVehicle({ plate: "MIN 100", make: "Fiat" });

  // Same storage, different garage. This is what RLS will enforce server-side;
  // the demo repository has to behave the same way or the UI will be written
  // against filters that do not exist.
  const theirs = createRepository({ storage, garageId: "gar_other", now: () => FIXED_NOW, seedWhenEmpty: false });
  assert.equal(theirs.findVehicleByPlate("MIN 100"), null);
  assert.equal(theirs.listVehicles().length, 0);
  assert.equal(theirs.listCustomers().length, 0);
  assert.equal(theirs.listOpenJobs().length, 0);
  assert.equal(theirs.getVehicle("veh_yaris"), null);
});

test("every seeded record carries the garage id", () => {
  const seed = createSeed({ now: FIXED_NOW });
  for (const table of ["customers", "vehicles", "jobs", "notes"]) {
    assert.ok(seed[table].length > 0, `${table} should not be empty`);
    for (const row of seed[table]) {
      assert.equal(row.garage_id, DEMO_GARAGE_ID, `${table} row ${row.id} is missing garage_id`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* Field shapes                                                        */
/* ------------------------------------------------------------------ */

test("mileage is always a number or null, never a formatted string", () => {
  const r = repo();
  for (const vehicle of r.listVehicles()) {
    assert.ok(vehicle.mileage_km === null || typeof vehicle.mileage_km === "number", vehicle.plate);
  }
  // Legacy Greek formatting is parsed rather than stored as text.
  assert.equal(mileage("86.420 km"), 86420);
  assert.equal(mileage(86420), 86420);
  assert.equal(mileage(""), null);
  assert.equal(mileage(null), null);

  const created = r.createVehicle({ plate: "FMT 001", mileage_km: "104.909 km" });
  assert.equal(created.mileage_km, 104909);
});

test("seeded dates follow the current date rather than being hardcoded", () => {
  const anchorA = new Date("2026-09-05T09:00:00.000Z");
  const anchorB = new Date("2027-03-01T09:00:00.000Z");
  const a = createSeed({ now: anchorA });
  const b = createSeed({ now: anchorB });

  // The same record, seeded six months apart, must not carry the same date.
  assert.notEqual(a.vehicles[0].created_at, b.vehicles[0].created_at);

  // Nothing may be dated in the future relative to its own anchor, and the
  // whole dataset must sit within roughly the preceding two years.
  for (const seed of [{ data: a, anchor: anchorA }, { data: b, anchor: anchorB }]) {
    const horizon = new Date(seed.anchor.getTime() + 30 * 86_400_000);
    const floor = new Date(seed.anchor.getTime() - 800 * 86_400_000);
    for (const table of ["customers", "vehicles", "jobs", "notes"]) {
      for (const row of seed.data[table]) {
        const created = new Date(row.created_at);
        assert.ok(created <= horizon, `${row.id} created_at is beyond the anchor`);
        assert.ok(created >= floor, `${row.id} created_at is implausibly old`);
        if (row.completed_at) {
          assert.ok(new Date(row.completed_at) <= horizon, `${row.id} completed in the future`);
        }
      }
    }
  }
});

test("every record has the timestamps and identifiers the schema promises", () => {
  const r = repo();
  const vehicle = r.getVehicle("veh_yaris");
  for (const field of ["id", "garage_id", "created_at", "updated_at", "plate", "plate_key"]) {
    assert.ok(vehicle[field], `vehicle is missing ${field}`);
  }
  const job = r.listJobsByVehicle("veh_yaris")[0];
  for (const field of ["id", "garage_id", "vehicle_id", "created_at", "updated_at", "status"]) {
    assert.ok(job[field], `job is missing ${field}`);
  }
  // Jobs reach the owner through the vehicle rather than duplicating the link.
  assert.equal("customer_id" in job, false);
});

test("note photos are stored as paths, not provider URLs", () => {
  const r = repo();
  const withPhoto = r.listNotesByVehicle("veh_bmw").find((n) => n.photo_paths.length > 0);
  assert.ok(withPhoto);
  for (const path of withPhoto.photo_paths) {
    assert.equal(path.startsWith("http"), false, "ADR-004 requires paths, not URLs");
    assert.ok(path.startsWith(`garages/${DEMO_GARAGE_ID}/vehicles/`));
  }
  assert.equal(
    vehiclePhotoPath("gar_x", "veh_y", "photo.webp"),
    "garages/gar_x/vehicles/veh_y/photo.webp",
  );
});

test("completing a job records a completion time and reopening clears it", () => {
  const r = repo();
  const job = r.listJobsByVehicle("veh_fiesta")[0];
  assert.equal(job.completed_at, null);

  const done = r.updateJob(job.id, { status: "done" });
  assert.equal(done.status, "done");
  assert.ok(done.completed_at);

  const reopened = r.updateJob(job.id, { status: "in_progress" });
  assert.equal(reopened.completed_at, null, "a reopened job must not keep a stale completion time");
});

test("reset restores the seed and clears undo", () => {
  const r = repo();
  r.createVehicle({ plate: "GON 001" });
  r.reset();
  assert.equal(r.findVehicleByPlate("GON 001"), null);
  assert.equal(r.canUndo(), false);
  assert.ok(r.listVehicles().length > 0);
});

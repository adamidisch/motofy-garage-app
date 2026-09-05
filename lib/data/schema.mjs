/**
 * Motofy domain schema.
 *
 * This is the shape the UI is built against today and the shape Supabase will
 * expose tomorrow. It is deliberately relational: identifiers and foreign keys,
 * never names or formatted strings standing in for a relation. Getting this
 * wrong is what forces a UI rewrite when the real database lands, so the demo
 * repository is treated as the schema decision, not as scaffolding.
 *
 * Every row carries `garage_id`. Nothing is ever read or written without it,
 * which makes the demo repository behave the way RLS will (see ADR-002) rather
 * than only pretending to.
 *
 * Postgres mapping, for when the Supabase migration is written:
 *
 *   garages    id text pk · name text · created_at timestamptz · updated_at timestamptz
 *   customers  id text pk · garage_id text fk->garages · name text · phone text null
 *              · email text null · created_at · updated_at
 *   vehicles   id text pk · garage_id text fk->garages
 *              · customer_id text null fk->customers
 *              · plate text · plate_key text · make text null · model text null
 *              · year int null · mileage_km int null · colour text null
 *              · scan_make text null · scan_model text null · scan_confidence text null
 *              · scan_provider text null · scanned_at timestamptz null
 *              · confirmed_at timestamptz null · created_at · updated_at
 *              · unique (garage_id, plate_key)
 *   jobs       id text pk · garage_id text fk->garages · vehicle_id text fk->vehicles
 *              · title text · description text null · status text
 *              · mileage_km int null · scheduled_for timestamptz null
 *              · completed_at timestamptz null · created_at · updated_at
 *   notes      id text pk · garage_id text fk->garages · vehicle_id text fk->vehicles
 *              · body text · author text null · photo_paths text[] · created_at · updated_at
 *
 * `jobs` and `notes` deliberately do not carry `customer_id`. The owner is
 * reached through the vehicle. Duplicating it would let the two disagree, which
 * is the precise defect this schema replaces.
 *
 * `photo_paths` holds storage paths, never provider URLs, per ADR-004.
 */

import { canonicalisePlateChars, normalisePlate } from "../scan-core.mjs";

/**
 * Bumped whenever a persisted shape changes incompatibly. Anything stored under
 * a different version is set aside rather than parsed optimistically.
 */
export const SCHEMA_VERSION = 1;

/** localStorage key holding the whole dataset. */
export const STORAGE_KEY = "motofy-data";

/** Prefix for the copy kept when unreadable data is found. */
export const BACKUP_KEY_PREFIX = "motofy-data-backup-";

export const JOB_STATUSES = ["scheduled", "in_progress", "done", "cancelled"];

export const OPEN_JOB_STATUSES = ["scheduled", "in_progress"];

export const SCAN_CONFIDENCES = ["high", "medium", "low"];

/** Tables in dependency order, so a reset or import can walk them safely. */
export const TABLES = ["garages", "customers", "vehicles", "jobs", "notes"];

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

const ID_PREFIXES = {
  garages: "gar",
  customers: "cus",
  vehicles: "veh",
  jobs: "job",
  notes: "not",
};

/**
 * Generate a stable identifier for a table.
 *
 * Text ids rather than integers, so the demo repository and Postgres can hold
 * the exact same values and seeded records keep their ids across a reset.
 *
 * @param {string} table
 * @param {() => string} [random]
 * @returns {string}
 */
export function createId(table, random) {
  const prefix = ID_PREFIXES[table] ?? "rec";
  if (typeof random === "function") return `${prefix}_${random()}`;
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Field coercion                                                      */
/* ------------------------------------------------------------------ */

/** Trim to null. Empty, whitespace and the literal "null" all become null. */
export function text(value, maxLength = 200) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed.slice(0, maxLength);
}

/**
 * Coerce mileage to a whole number of kilometres, or null.
 *
 * Accepts the formatted strings the old demo data used ("86.420 km") so a
 * hand-edited or legacy value cannot reintroduce a string into a numeric field.
 * Greek formatting uses `.` as the thousands separator, so all separators are
 * simply dropped rather than treated as a decimal point.
 *
 * @returns {number | null}
 */
export function mileage(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  }
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Coerce a model year, or null. Rejects values outside a plausible range. */
export function year(value) {
  if (value === null || value === undefined || value === "") return null;
  const digits = String(value).replace(/[^\d]/g, "");
  const parsed = Number.parseInt(digits, 10);
  if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2100) return null;
  return parsed;
}

/**
 * Uniqueness key for a plate within a garage.
 *
 * Folds Greek and Cyrillic homoglyphs to Latin and strips separators, reusing
 * the same logic the scanner uses. "ΚΒΥ 328" typed by hand and "KBY328" read by
 * the camera must collide, or the same car is filed twice.
 *
 * @returns {string | null}
 */
export function plateKey(value) {
  const key = canonicalisePlateChars(value);
  return key || null;
}

/** Display form of a plate: "KBY 328". */
export function plateDisplay(value) {
  return normalisePlate(value);
}

function timestamp(value, fallback) {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Record factories                                                    */
/* ------------------------------------------------------------------ */

/**
 * Each factory returns a complete record with every column present, so no
 * consumer has to guard against a missing field and a persisted row never
 * changes shape between versions.
 */

export function makeGarage(input = {}, at = new Date().toISOString()) {
  return {
    id: input.id ?? createId("garages"),
    name: text(input.name, 120) ?? "Συνεργείο",
    created_at: timestamp(input.created_at, at),
    updated_at: timestamp(input.updated_at, at),
  };
}

export function makeCustomer(input = {}, at = new Date().toISOString()) {
  if (!input.garage_id) throw new SchemaError("customer requires garage_id");
  return {
    id: input.id ?? createId("customers"),
    garage_id: input.garage_id,
    name: text(input.name, 120) ?? "Νέος πελάτης",
    phone: text(input.phone, 40),
    email: text(input.email, 160),
    created_at: timestamp(input.created_at, at),
    updated_at: timestamp(input.updated_at, at),
  };
}

export function makeVehicle(input = {}, at = new Date().toISOString()) {
  if (!input.garage_id) throw new SchemaError("vehicle requires garage_id");
  // Derived from `plate` first. Taking `plate_key` in preference would let an
  // update change the visible plate while leaving the old key in place, so the
  // record would still answer to its previous plate and slip past the
  // uniqueness check. `plate_key` is only a fallback for a row that somehow has
  // a key but no plate.
  const key = plateKey(input.plate ?? input.plate_key);
  if (!key) throw new SchemaError("vehicle requires a readable plate");
  return {
    id: input.id ?? createId("vehicles"),
    garage_id: input.garage_id,
    customer_id: input.customer_id ?? null,
    plate: plateDisplay(input.plate) ?? key,
    plate_key: key,
    make: text(input.make, 60),
    model: text(input.model, 80),
    year: year(input.year),
    mileage_km: mileage(input.mileage_km),
    colour: text(input.colour, 40),
    // Kept apart from the confirmed columns above so a fresh AI reading can be
    // shown and offered without silently overwriting what a human confirmed.
    scan_make: text(input.scan_make, 60),
    scan_model: text(input.scan_model, 80),
    scan_confidence: SCAN_CONFIDENCES.includes(input.scan_confidence) ? input.scan_confidence : null,
    scan_provider: text(input.scan_provider, 40),
    scanned_at: input.scanned_at ?? null,
    confirmed_at: input.confirmed_at ?? null,
    created_at: timestamp(input.created_at, at),
    updated_at: timestamp(input.updated_at, at),
  };
}

export function makeJob(input = {}, at = new Date().toISOString()) {
  if (!input.garage_id) throw new SchemaError("job requires garage_id");
  if (!input.vehicle_id) throw new SchemaError("job requires vehicle_id");
  return {
    id: input.id ?? createId("jobs"),
    garage_id: input.garage_id,
    vehicle_id: input.vehicle_id,
    title: text(input.title, 160) ?? "Εργασία",
    description: text(input.description, 2000),
    status: JOB_STATUSES.includes(input.status) ? input.status : "scheduled",
    mileage_km: mileage(input.mileage_km),
    scheduled_for: input.scheduled_for ?? null,
    completed_at: input.completed_at ?? null,
    created_at: timestamp(input.created_at, at),
    updated_at: timestamp(input.updated_at, at),
  };
}

export function makeNote(input = {}, at = new Date().toISOString()) {
  if (!input.garage_id) throw new SchemaError("note requires garage_id");
  if (!input.vehicle_id) throw new SchemaError("note requires vehicle_id");
  return {
    id: input.id ?? createId("notes"),
    garage_id: input.garage_id,
    vehicle_id: input.vehicle_id,
    body: text(input.body, 4000) ?? "",
    author: text(input.author, 120),
    // Storage paths, never provider URLs, so the storage backend stays
    // swappable (ADR-004).
    photo_paths: Array.isArray(input.photo_paths)
      ? input.photo_paths.filter((p) => typeof p === "string" && p).slice(0, 12)
      : [],
    created_at: timestamp(input.created_at, at),
    updated_at: timestamp(input.updated_at, at),
  };
}

export const FACTORIES = {
  garages: makeGarage,
  customers: makeCustomer,
  vehicles: makeVehicle,
  jobs: makeJob,
  notes: makeNote,
};

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Thrown when a record cannot be built because required fields are absent. */
export class SchemaError extends Error {
  constructor(message) {
    super(message);
    this.name = "SchemaError";
  }
}

/** Thrown when an operation would break a constraint the database will enforce. */
export class ConstraintError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ConstraintError";
    this.code = code ?? "constraint_violation";
  }
}

/** Storage path for a vehicle photo. Mirrors the convention fixed in ADR-004. */
export function vehiclePhotoPath(garageId, vehicleId, filename) {
  return `garages/${garageId}/vehicles/${vehicleId}/${filename}`;
}

/** An empty dataset, ready to be filled by a seed or an import. */
export function emptyDataset() {
  return {
    version: SCHEMA_VERSION,
    garages: [],
    customers: [],
    vehicles: [],
    jobs: [],
    notes: [],
  };
}

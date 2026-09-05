/**
 * Motofy demo repository.
 *
 * The whole point of this module is that the UI never learns where data lives.
 * Screens call `getVehicle`, `findVehicleByPlate`, `listJobsByVehicle` and so
 * on; today those read a localStorage-backed dataset, tomorrow they read
 * Supabase over PostgREST. Swapping the backend should mean reimplementing this
 * interface, not touching a single component.
 *
 * Two design rules follow from that, and both matter more than they look:
 *
 * Every read and write is scoped by `garage_id`. Not because a demo with one
 * garage needs it, but because RLS will enforce it later (ADR-002). Building
 * against an unscoped repository would mean discovering every missing filter
 * the day the policies go live.
 *
 * Nothing is returned by reference. Callers get deep copies, so a component
 * cannot mutate stored state by accident and produce a bug that survives a
 * reload but vanishes on reset.
 */

import {
  BACKUP_KEY_PREFIX,
  ConstraintError,
  FACTORIES,
  JOB_STATUSES,
  OPEN_JOB_STATUSES,
  SCHEMA_VERSION,
  STORAGE_KEY,
  SchemaError,
  TABLES,
  emptyDataset,
  plateKey,
} from "./schema.mjs";
import { DEMO_GARAGE_ID, createSeed } from "./seed.mjs";

/* ------------------------------------------------------------------ */
/* Storage adapters                                                    */
/* ------------------------------------------------------------------ */

/**
 * In-memory storage. Used by tests and by any server-side render, where
 * `localStorage` does not exist.
 */
export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
  };
}

/**
 * Browser storage, falling back to memory when unavailable.
 *
 * Safari in private mode and a storage quota that is already full both throw on
 * write rather than returning an error, so the fallback keeps the app usable
 * instead of crashing on the first save.
 */
export function createBrowserStorage() {
  try {
    const probe = "__motofy_probe__";
    globalThis.localStorage.setItem(probe, "1");
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

/* ------------------------------------------------------------------ */
/* Migration                                                           */
/* ------------------------------------------------------------------ */

/**
 * Migrations keyed by the version being upgraded from.
 *
 * Empty at version 1, but the mechanism exists now so the first real schema
 * change has somewhere to go other than wiping a mechanic's day of work.
 */
export const MIGRATIONS = {};

function migrate(dataset) {
  let current = dataset;
  let guard = 0;
  while (current.version !== SCHEMA_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step || (guard += 1) > 50) return null;
    current = step(current);
  }
  return current;
}

/* ------------------------------------------------------------------ */
/* Repository                                                          */
/* ------------------------------------------------------------------ */

const clone = (value) =>
  typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));

/**
 * @param {object} [options]
 * @param {string} [options.garageId]
 * @param {{getItem:Function,setItem:Function,removeItem:Function}} [options.storage]
 * @param {() => Date} [options.now]
 * @param {(table: string) => string} [options.generateId]
 * @param {boolean} [options.seedWhenEmpty]
 */
export function createRepository({
  garageId = DEMO_GARAGE_ID,
  storage = createMemoryStorage(),
  now = () => new Date(),
  generateId,
  seedWhenEmpty = true,
} = {}) {
  /** @type {ReturnType<typeof emptyDataset>} */
  let data;
  /** How the current dataset came to be, for diagnostics and tests. */
  let loadStatus = "loaded";
  /** Inverse operations, most recent last. */
  const undoStack = [];

  const stamp = () => now().toISOString();

  function build(table, input) {
    const at = stamp();
    const record = FACTORIES[table]({ ...input, garage_id: input.garage_id ?? garageId }, at);
    if (!record.id && generateId) record.id = generateId(table);
    return record;
  }

  /* -------------------- persistence -------------------- */

  function persist() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // A full quota must not take the app down mid-job. The in-memory dataset
      // stays correct for this session; only durability is lost.
      loadStatus = "write_failed";
    }
  }

  function backup(raw, reason) {
    try {
      storage.setItem(`${BACKUP_KEY_PREFIX}${Date.now()}`, String(raw).slice(0, 2_000_000));
    } catch {
      /* a backup that cannot be written must not block recovery */
    }
    loadStatus = reason;
  }

  /** Rebuild every record through its factory so a stored row is never trusted blindly. */
  function rehydrate(parsed) {
    const next = emptyDataset();
    for (const table of TABLES) {
      const rows = Array.isArray(parsed[table]) ? parsed[table] : [];
      for (const row of rows) {
        try {
          next[table].push(FACTORIES[table](row, row?.created_at ?? stamp()));
        } catch {
          // Drop an individual unusable row rather than discarding the dataset.
        }
      }
    }
    return next;
  }

  function load() {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      data = seedWhenEmpty ? createSeed({ now: now(), garageId }) : emptyDataset();
      loadStatus = seedWhenEmpty ? "seeded" : "empty";
      persist();
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      backup(raw, "reset_unreadable");
      data = seedWhenEmpty ? createSeed({ now: now(), garageId }) : emptyDataset();
      persist();
      return;
    }

    if (parsed?.version !== SCHEMA_VERSION) {
      const migrated = parsed && typeof parsed === "object" ? migrate(parsed) : null;
      if (!migrated) {
        // No path from that version, most often because the stored data came
        // from a newer build. Keep a copy rather than destroying it silently.
        backup(raw, "reset_version");
        data = seedWhenEmpty ? createSeed({ now: now(), garageId }) : emptyDataset();
        persist();
        return;
      }
      data = rehydrate(migrated);
      loadStatus = "migrated";
      persist();
      return;
    }

    data = rehydrate(parsed);
    loadStatus = "loaded";
  }

  /* -------------------- scoped access -------------------- */

  const rows = (table) => data[table].filter((row) => table === "garages" || row.garage_id === garageId);
  const find = (table, id) => rows(table).find((row) => row.id === id) ?? null;
  const out = (row) => (row ? clone(row) : null);
  const outList = (list) => list.map(clone);

  const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
  const byOldest = (a, b) => String(a.created_at).localeCompare(String(b.created_at));
  const ordered = (list, order) => [...list].sort(order === "asc" ? byOldest : byNewest);

  function insert(table, record, label) {
    data[table].push(record);
    undoStack.push({
      label,
      table,
      id: record.id,
      revert: () => {
        const index = data[table].findIndex((row) => row.id === record.id);
        if (index !== -1) data[table].splice(index, 1);
      },
    });
    persist();
    return out(record);
  }

  function patch(table, id, changes, label) {
    const index = data[table].findIndex((row) => row.id === id && row.garage_id === garageId);
    if (index === -1) return null;
    const before = clone(data[table][index]);
    data[table][index] = { ...data[table][index], ...changes, updated_at: stamp() };
    undoStack.push({
      label,
      table,
      id,
      revert: () => {
        const at = data[table].findIndex((row) => row.id === id);
        if (at !== -1) data[table][at] = before;
      },
    });
    persist();
    return out(data[table][index]);
  }

  load();

  /* -------------------- public interface -------------------- */

  return {
    garageId,

    /** How the dataset was obtained: loaded, seeded, migrated or reset_*. */
    get status() {
      return loadStatus;
    },

    getGarage() {
      return out(data.garages.find((row) => row.id === garageId) ?? null);
    },

    /* ---- customers ---- */

    listCustomers() {
      return outList([...rows("customers")].sort((a, b) => a.name.localeCompare(b.name, "el")));
    },

    getCustomer(id) {
      return out(find("customers", id));
    },

    createCustomer(input = {}) {
      return insert("customers", build("customers", input), "create_customer");
    },

    updateCustomer(id, changes = {}) {
      return patch("customers", id, {
        ...(changes.name !== undefined ? { name: FACTORIES.customers({ garage_id: garageId, name: changes.name }).name } : {}),
        ...(changes.phone !== undefined ? { phone: FACTORIES.customers({ garage_id: garageId, phone: changes.phone }).phone } : {}),
        ...(changes.email !== undefined ? { email: FACTORIES.customers({ garage_id: garageId, email: changes.email }).email } : {}),
      }, "update_customer");
    },

    /* ---- vehicles ---- */

    listVehicles() {
      return outList(ordered(rows("vehicles")));
    },

    getVehicle(id) {
      return out(find("vehicles", id));
    },

    /**
     * Look a vehicle up by plate, however it was written.
     *
     * The lookup runs on the folded key, so a plate typed with Greek letters
     * finds the record the camera created with Latin ones.
     */
    findVehicleByPlate(plate) {
      const key = plateKey(plate);
      if (!key) return null;
      return out(rows("vehicles").find((row) => row.plate_key === key) ?? null);
    },

    listVehiclesByCustomer(customerId) {
      if (!customerId) return [];
      return outList(ordered(rows("vehicles").filter((row) => row.customer_id === customerId)));
    },

    /** Vehicles not yet linked to anyone, which the UI has to offer to connect. */
    listUnassignedVehicles() {
      return outList(ordered(rows("vehicles").filter((row) => row.customer_id === null)));
    },

    createVehicle(input = {}) {
      const record = build("vehicles", input);
      const clash = rows("vehicles").find((row) => row.plate_key === record.plate_key);
      if (clash) {
        throw new ConstraintError(
          `A vehicle with plate ${clash.plate} already exists in this garage`,
          "duplicate_plate",
        );
      }
      if (record.customer_id && !find("customers", record.customer_id)) {
        throw new ConstraintError("customer_id does not belong to this garage", "foreign_key");
      }
      return insert("vehicles", record, "create_vehicle");
    },

    updateVehicle(id, changes = {}) {
      const current = find("vehicles", id);
      if (!current) return null;
      const merged = FACTORIES.vehicles({ ...current, ...changes, garage_id: garageId, id }, stamp());
      if (merged.plate_key !== current.plate_key) {
        const clash = rows("vehicles").find((row) => row.plate_key === merged.plate_key && row.id !== id);
        if (clash) {
          throw new ConstraintError(
            `A vehicle with plate ${clash.plate} already exists in this garage`,
            "duplicate_plate",
          );
        }
      }
      if (merged.customer_id && !find("customers", merged.customer_id)) {
        throw new ConstraintError("customer_id does not belong to this garage", "foreign_key");
      }
      const { id: _id, garage_id: _g, created_at: _c, ...rest } = merged;
      return patch("vehicles", id, rest, "update_vehicle");
    },

    /** Link, or unlink with null. Separate from updateVehicle so undo reads clearly. */
    linkVehicleToCustomer(vehicleId, customerId) {
      if (customerId && !find("customers", customerId)) {
        throw new ConstraintError("customer_id does not belong to this garage", "foreign_key");
      }
      return patch("vehicles", vehicleId, { customer_id: customerId ?? null }, "link_vehicle_customer");
    },

    /**
     * Record a scan result against the garage's data.
     *
     * The confirmed record wins. When the plate is already known, make and model
     * are left exactly as they are and the reading is stored in the `scan_*`
     * columns instead, with any disagreement reported so the UI can offer the
     * change rather than perform it. An AI guess must never quietly rewrite what
     * a mechanic entered.
     *
     * @returns {{vehicle: object, created: boolean, conflicts: Array<{field:string,current:unknown,scanned:unknown}>}}
     */
    applyScanResult(scan = {}) {
      const key = plateKey(scan.plate);
      if (!key) throw new SchemaError("scan result has no readable plate");

      const scanFields = {
        scan_make: scan.make ?? null,
        scan_model: scan.model ?? null,
        scan_confidence: scan.confidence ?? null,
        scan_provider: scan.provider ?? null,
        scanned_at: stamp(),
      };

      const existing = rows("vehicles").find((row) => row.plate_key === key);
      if (existing) {
        const conflicts = [];
        for (const [field, scanned] of [["make", scan.make], ["model", scan.model]]) {
          const current = existing[field];
          if (scanned && current && String(scanned).toLowerCase() !== String(current).toLowerCase()) {
            conflicts.push({ field, current, scanned });
          }
        }
        const vehicle = patch("vehicles", existing.id, scanFields, "record_scan");
        return { vehicle, created: false, conflicts };
      }

      const vehicle = insert(
        "vehicles",
        build("vehicles", {
          plate: scan.plate,
          make: scan.make ?? null,
          model: scan.model ?? null,
          confirmed_at: null,
          ...scanFields,
        }),
        "create_vehicle_from_scan",
      );
      return { vehicle, created: true, conflicts: [] };
    },

    /** Promote the stored scan reading into the confirmed columns. One tap, per ADR-007. */
    confirmScannedDetails(vehicleId) {
      const current = find("vehicles", vehicleId);
      if (!current) return null;
      return patch("vehicles", vehicleId, {
        make: current.scan_make ?? current.make,
        model: current.scan_model ?? current.model,
        confirmed_at: stamp(),
      }, "confirm_scan");
    },

    /* ---- jobs ---- */

    getJob(id) {
      return out(find("jobs", id));
    },

    createJob(input = {}) {
      const record = build("jobs", input);
      if (!find("vehicles", record.vehicle_id)) {
        throw new ConstraintError("vehicle_id does not belong to this garage", "foreign_key");
      }
      return insert("jobs", record, "create_job");
    },

    updateJob(id, changes = {}) {
      const current = find("jobs", id);
      if (!current) return null;
      const next = {};
      if (changes.title !== undefined) next.title = FACTORIES.jobs({ garage_id: garageId, vehicle_id: current.vehicle_id, title: changes.title }).title;
      if (changes.description !== undefined) next.description = FACTORIES.jobs({ garage_id: garageId, vehicle_id: current.vehicle_id, description: changes.description }).description;
      if (changes.status !== undefined && JOB_STATUSES.includes(changes.status)) {
        next.status = changes.status;
        // Completion time is derived, so a done job always has one and a
        // reopened job never keeps a stale one.
        next.completed_at = changes.status === "done" ? (changes.completed_at ?? stamp()) : null;
      }
      if (changes.mileage_km !== undefined) next.mileage_km = FACTORIES.jobs({ garage_id: garageId, vehicle_id: current.vehicle_id, mileage_km: changes.mileage_km }).mileage_km;
      if (changes.scheduled_for !== undefined) next.scheduled_for = changes.scheduled_for ?? null;
      return patch("jobs", id, next, "update_job");
    },

    listJobsByVehicle(vehicleId, { order = "desc", status } = {}) {
      let list = rows("jobs").filter((row) => row.vehicle_id === vehicleId);
      if (status === "open") list = list.filter((row) => OPEN_JOB_STATUSES.includes(row.status));
      else if (status) list = list.filter((row) => row.status === status);
      return outList(ordered(list, order));
    },

    /** Every open job in the garage, for the home screen. */
    listOpenJobs() {
      return outList(ordered(rows("jobs").filter((row) => OPEN_JOB_STATUSES.includes(row.status))));
    },

    /* ---- notes ---- */

    createNote(input = {}) {
      const record = build("notes", input);
      if (!find("vehicles", record.vehicle_id)) {
        throw new ConstraintError("vehicle_id does not belong to this garage", "foreign_key");
      }
      return insert("notes", record, "create_note");
    },

    listNotesByVehicle(vehicleId, { order = "desc" } = {}) {
      return outList(ordered(rows("notes").filter((row) => row.vehicle_id === vehicleId), order));
    },

    /* ---- undo ---- */

    canUndo() {
      return undoStack.length > 0;
    },

    /** Label of the operation `undo()` would reverse, for the toast. */
    peekUndo() {
      const top = undoStack[undoStack.length - 1];
      return top ? { label: top.label, table: top.table, id: top.id } : null;
    },

    /**
     * Reverse the most recent mutation.
     *
     * A mechanic working one-handed with dirty hands will mis-tap. Undo belongs
     * here rather than in a component so it survives navigation and covers
     * every write path uniformly.
     */
    undo() {
      const top = undoStack.pop();
      if (!top) return null;
      top.revert();
      persist();
      return { label: top.label, table: top.table, id: top.id };
    },

    /* ---- maintenance ---- */

    /** Discard everything and reseed. Used by the settings screen and by tests. */
    reset() {
      data = seedWhenEmpty ? createSeed({ now: now(), garageId }) : emptyDataset();
      undoStack.length = 0;
      loadStatus = "seeded";
      persist();
    },

    /** Full dataset copy, for debugging and for the eventual Supabase import. */
    snapshot() {
      return clone(data);
    },
  };
}

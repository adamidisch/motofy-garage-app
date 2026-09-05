/**
 * View model for the vehicle record screen.
 *
 * Everything the screen needs is assembled here, as plain data, with no React
 * and no DOM. That keeps the interesting logic — which customer owns this car,
 * which job is current, whether a scan disagrees with the record — testable
 * with `node --test`, and leaves the component doing nothing but rendering.
 *
 * Two rules this module exists to enforce:
 *
 * Relations are resolved through `customer_id` and `vehicle_id`, never by
 * matching a customer's name. Two people called Μιχάλης Σάββα must not share a
 * car.
 *
 * A scan never overwrites the record. Disagreements are returned as
 * `scanSuggestion.conflicts` for the screen to offer, and the confirmed columns
 * are reported unchanged alongside them.
 */

import { canonicalisePlateChars } from "../scan-core.mjs";

const LOCALES = { el: "el-GR", en: "en-GB" };

const locale = (lang) => LOCALES[lang] ?? LOCALES.el;

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "86.420 km" in Greek, "86,420 km" in English. Null mileage renders as a dash. */
export function formatMileage(km, lang = "el") {
  if (typeof km !== "number" || !Number.isFinite(km)) return "—";
  return `${km.toLocaleString(locale(lang))} km`;
}

/** Short date, e.g. "5 Σεπ 2026". */
export function formatDate(iso, lang = "el") {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale(lang), { day: "numeric", month: "short", year: "numeric" });
}

/** Short date with time, for job and note timelines. */
export function formatDateTime(iso, lang = "el") {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale(lang), { day: "numeric", month: "short" }) +
    " · " +
    date.toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit" });
}

/**
 * The dashboard eyebrow, derived from the clock rather than hardcoded.
 *
 * The previous build shipped "ΣΗΜΕΡΑ · 2 ΣΕΠ" as a constant, which was wrong
 * every day but one.
 */
export function formatTodayLabel(now = new Date(), lang = "el") {
  const date = now instanceof Date ? now : new Date(now);
  const today = lang === "el" ? "ΣΗΜΕΡΑ" : "TODAY";
  const day = date.toLocaleDateString(locale(lang), { day: "numeric" });
  const month = date.toLocaleDateString(locale(lang), { month: "short" }).replace(".", "");
  return `${today} · ${day} ${month.toUpperCase()}`;
}

/** "πριν 3 ημέρες" / "3 days ago", falling back to a plain date when far off. */
export function formatRelative(iso, now = new Date(), lang = "el") {
  if (!iso) return "—";
  const then = new Date(iso);
  const base = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(then.getTime())) return "—";

  const days = Math.round((then.getTime() - base.getTime()) / 86_400_000);
  if (Math.abs(days) > 45) return formatDate(iso, lang);

  const relative = new Intl.RelativeTimeFormat(locale(lang), { numeric: "auto" });
  if (Math.abs(days) >= 1) return relative.format(days, "day");

  const hours = Math.round((then.getTime() - base.getTime()) / 3_600_000);
  if (Math.abs(hours) >= 1) return relative.format(hours, "hour");
  return relative.format(Math.round((then.getTime() - base.getTime()) / 60_000), "minute");
}

/** Two-letter monogram for a customer avatar. */
export function initials(name) {
  if (typeof name !== "string" || !name.trim()) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]).join("").toUpperCase();
}

/** "Toyota Yaris", or just the make, or null when nothing is confirmed. */
export function vehicleTitle(vehicle) {
  if (!vehicle) return null;
  const title = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return title || null;
}

/** "2018 · Ασημί", omitting whatever is missing. */
export function vehicleSubtitle(vehicle) {
  if (!vehicle) return null;
  const parts = [vehicle.year ? String(vehicle.year) : null, vehicle.colour].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/* ------------------------------------------------------------------ */
/* Scan comparison                                                     */
/* ------------------------------------------------------------------ */

const OPEN_STATUSES = ["scheduled", "in_progress"];

/**
 * Compare a reading against the confirmed record.
 *
 * Read-only by construction: it takes two objects and returns a description of
 * the difference. Nothing here can write, which is why the screen can display a
 * suggestion with no risk of an accidental overwrite.
 *
 * @returns {Array<{field: "make"|"model", current: string|null, scanned: string|null}>}
 */
export function compareScanToVehicle(vehicle, scan) {
  if (!vehicle || !scan) return [];
  const conflicts = [];
  for (const field of ["make", "model"]) {
    const current = vehicle[field];
    const scanned = scan[field];
    if (!scanned) continue;
    // A vehicle with nothing confirmed yet is not in conflict; it is simply
    // waiting for someone to accept the reading.
    if (!current) continue;
    if (String(scanned).trim().toLowerCase() !== String(current).trim().toLowerCase()) {
      conflicts.push({ field, current, scanned });
    }
  }
  return conflicts;
}

/**
 * The suggestion banner's data, or null when there is nothing to suggest.
 *
 * Built from whichever reading is available: one passed in from a scan that has
 * just finished, or the last reading stored on the record.
 */
export function buildScanSuggestion(vehicle, scan = null) {
  if (!vehicle) return null;
  const reading = scan ?? {
    make: vehicle.scan_make,
    model: vehicle.scan_model,
    confidence: vehicle.scan_confidence,
    provider: vehicle.scan_provider,
    scanned_at: vehicle.scanned_at,
  };
  if (!reading.make && !reading.model) return null;

  const conflicts = compareScanToVehicle(vehicle, reading);
  // Nothing confirmed yet, but a reading exists to accept.
  const unconfirmed = !vehicle.confirmed_at && Boolean(reading.make || reading.model);
  if (!conflicts.length && !unconfirmed) return null;

  return {
    conflicts,
    unconfirmed,
    make: reading.make ?? null,
    model: reading.model ?? null,
    confidence: reading.confidence ?? null,
    provider: reading.provider ?? null,
    scannedAt: reading.scanned_at ?? null,
    // Stated explicitly so a reader of this object cannot mistake it for a
    // pending write.
    applied: false,
  };
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

/**
 * The most recent thing that happened to this vehicle, across jobs, notes and
 * scans. Powers the "last activity" line on the overview.
 */
export function lastActivityOf({ vehicle, jobs = [], notes = [] }) {
  const candidates = [];
  if (vehicle?.created_at) candidates.push({ kind: "created", at: vehicle.created_at });
  if (vehicle?.scanned_at) candidates.push({ kind: "scan", at: vehicle.scanned_at });
  for (const job of jobs) {
    candidates.push({ kind: job.completed_at ? "job_completed" : "job", at: job.completed_at ?? job.created_at, job });
  }
  for (const note of notes) candidates.push({ kind: "note", at: note.created_at, note });

  const dated = candidates.filter((entry) => entry.at);
  if (!dated.length) return null;
  return dated.reduce((latest, entry) => (String(entry.at) > String(latest.at) ? entry : latest));
}

/* ------------------------------------------------------------------ */
/* Record                                                              */
/* ------------------------------------------------------------------ */

/**
 * Assemble the whole vehicle record.
 *
 * @param {object} options
 * @param {import("./repository.d.mts").Repository} options.repository
 * @param {string} options.vehicleId
 * @param {object} [options.scan] a reading that has just come back, if any
 * @returns {object | null} null when the vehicle is not in this garage
 */
export function buildVehicleRecord({ repository, vehicleId, scan = null } = {}) {
  if (!repository || !vehicleId) return null;
  const vehicle = repository.getVehicle(vehicleId);
  if (!vehicle) return null;

  // Resolved by id. Matching on a customer's name would merge namesakes.
  const customer = vehicle.customer_id ? repository.getCustomer(vehicle.customer_id) : null;
  const customerVehicles = customer ? repository.listVehiclesByCustomer(customer.id) : [];
  const otherVehicles = customerVehicles.filter((row) => row.id !== vehicle.id);

  const allJobs = repository.listJobsByVehicle(vehicle.id);
  const open = allJobs.filter((job) => OPEN_STATUSES.includes(job.status));
  const history = allJobs.filter((job) => !OPEN_STATUSES.includes(job.status));
  // In progress outranks scheduled, so the mechanic sees what is on the ramp.
  const current =
    open.find((job) => job.status === "in_progress") ?? open[0] ?? null;

  const notes = repository.listNotesByVehicle(vehicle.id);

  return {
    vehicle,
    display: {
      title: vehicleTitle(vehicle),
      subtitle: vehicleSubtitle(vehicle),
      plate: vehicle.plate,
      mileageKm: vehicle.mileage_km,
    },
    customer,
    customerVehicles,
    otherVehicles,
    jobs: { all: allJobs, open, history, current },
    notes,
    lastActivity: lastActivityOf({ vehicle, jobs: allJobs, notes }),
    scanSuggestion: buildScanSuggestion(vehicle, scan),
    // Explicit rather than derived at the call site, so a screen cannot forget
    // an empty state and render a bare panel.
    empty: {
      customer: customer === null,
      otherVehicles: otherVehicles.length === 0,
      jobs: allJobs.length === 0,
      openJob: current === null,
      history: history.length === 0,
      notes: notes.length === 0,
      details: !vehicle.make && !vehicle.model,
      mileage: vehicle.mileage_km === null,
    },
  };
}

/**
 * Rows for the vehicles list, resolved through the repository so the customer
 * name and current job come from real relations rather than from strings
 * stored alongside the car.
 */
export function buildVehicleListRow(repository, vehicle) {
  const customer = vehicle.customer_id ? repository.getCustomer(vehicle.customer_id) : null;
  const open = repository.listJobsByVehicle(vehicle.id, { status: "open" });
  const current = open.find((job) => job.status === "in_progress") ?? open[0] ?? null;
  return {
    vehicle,
    customer,
    currentJob: current,
    title: vehicleTitle(vehicle),
    subtitle: vehicleSubtitle(vehicle),
  };
}

/**
 * Case-insensitive match across plate, make, model and owner name.
 *
 * The query is also folded the way plates are, so someone typing ΚΒΥ328 on a
 * Greek keyboard finds the record stored as KBY 328. Lowercasing alone does not
 * do this: Greek and Latin capitals that look identical are different
 * codepoints.
 */
export function matchesVehicleQuery(row, query) {
  const raw = String(query ?? "").trim();
  if (!raw) return true;

  const haystack = [
    row.vehicle.plate,
    row.vehicle.plate_key,
    row.vehicle.make,
    row.vehicle.model,
    row.customer?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (haystack.includes(raw.toLowerCase())) return true;

  const folded = canonicalisePlateChars(raw);
  return Boolean(folded) && String(row.vehicle.plate_key ?? "").includes(folded);
}

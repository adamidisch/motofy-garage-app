import type { Customer, Job, Note, Vehicle } from "./schema.d.mts";
import type { Repository } from "./repository.d.mts";

export type Lang = "el" | "en";

export interface ScanConflict {
  field: "make" | "model";
  current: string | null;
  scanned: string | null;
}

export interface ScanSuggestion {
  conflicts: ScanConflict[];
  unconfirmed: boolean;
  make: string | null;
  model: string | null;
  confidence: string | null;
  provider: string | null;
  scannedAt: string | null;
  /** Always false. The suggestion is informational; nothing has been written. */
  applied: false;
}

export interface ActivityEntry {
  kind: "created" | "scan" | "job" | "job_completed" | "note";
  at: string;
  job?: Job;
  note?: Note;
}

export interface VehicleRecord {
  vehicle: Vehicle;
  display: { title: string | null; subtitle: string | null; plate: string; mileageKm: number | null };
  customer: Customer | null;
  customerVehicles: Vehicle[];
  otherVehicles: Vehicle[];
  jobs: { all: Job[]; open: Job[]; history: Job[]; current: Job | null };
  notes: Note[];
  lastActivity: ActivityEntry | null;
  scanSuggestion: ScanSuggestion | null;
  empty: {
    customer: boolean;
    otherVehicles: boolean;
    jobs: boolean;
    openJob: boolean;
    history: boolean;
    notes: boolean;
    details: boolean;
    mileage: boolean;
  };
}

export interface VehicleListRow {
  vehicle: Vehicle;
  customer: Customer | null;
  currentJob: Job | null;
  title: string | null;
  subtitle: string | null;
}

export declare function formatMileage(km: unknown, lang?: Lang): string;
export declare function formatDate(iso: string | null, lang?: Lang): string;
export declare function formatDateTime(iso: string | null, lang?: Lang): string;
export declare function formatTodayLabel(now?: Date | string, lang?: Lang): string;
export declare function formatRelative(iso: string | null, now?: Date | string, lang?: Lang): string;
export declare function initials(name: unknown): string;
export declare function vehicleTitle(vehicle: Vehicle | null): string | null;
export declare function vehicleSubtitle(vehicle: Vehicle | null): string | null;
export declare function compareScanToVehicle(vehicle: Vehicle | null, scan: unknown): ScanConflict[];
export declare function buildScanSuggestion(vehicle: Vehicle | null, scan?: unknown): ScanSuggestion | null;
export declare function lastActivityOf(input: { vehicle?: Vehicle; jobs?: Job[]; notes?: Note[] }): ActivityEntry | null;
export declare function buildVehicleRecord(options: {
  repository: Repository;
  vehicleId: string;
  scan?: unknown;
}): VehicleRecord | null;
export declare function buildVehicleListRow(repository: Repository, vehicle: Vehicle): VehicleListRow;
export declare function matchesVehicleQuery(row: VehicleListRow, query: string): boolean;

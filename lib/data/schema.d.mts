export type JobStatus = "scheduled" | "in_progress" | "done" | "cancelled";
export type ScanConfidence = "high" | "medium" | "low";
export type TableName = "garages" | "customers" | "vehicles" | "jobs" | "notes";

export interface Timestamped { created_at: string; updated_at: string }
export interface Owned extends Timestamped { id: string; garage_id: string }

export interface Garage extends Timestamped { id: string; name: string }

export interface Customer extends Owned {
  name: string;
  phone: string | null;
  email: string | null;
}

export interface Vehicle extends Owned {
  customer_id: string | null;
  plate: string;
  plate_key: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage_km: number | null;
  colour: string | null;
  scan_make: string | null;
  scan_model: string | null;
  scan_confidence: ScanConfidence | null;
  scan_provider: string | null;
  scanned_at: string | null;
  confirmed_at: string | null;
}

export interface Job extends Owned {
  vehicle_id: string;
  title: string;
  description: string | null;
  status: JobStatus;
  mileage_km: number | null;
  scheduled_for: string | null;
  completed_at: string | null;
}

export interface Note extends Owned {
  vehicle_id: string;
  body: string;
  author: string | null;
  photo_paths: string[];
}

export interface Dataset {
  version: number;
  garages: Garage[];
  customers: Customer[];
  vehicles: Vehicle[];
  jobs: Job[];
  notes: Note[];
}

export declare const SCHEMA_VERSION: number;
export declare const STORAGE_KEY: string;
export declare const BACKUP_KEY_PREFIX: string;
export declare const JOB_STATUSES: JobStatus[];
export declare const OPEN_JOB_STATUSES: JobStatus[];
export declare const SCAN_CONFIDENCES: ScanConfidence[];
export declare const TABLES: TableName[];

export declare class SchemaError extends Error {}
export declare class ConstraintError extends Error { code: string }

export declare function createId(table: TableName, random?: () => string): string;
export declare function text(value: unknown, maxLength?: number): string | null;
export declare function mileage(value: unknown): number | null;
export declare function year(value: unknown): number | null;
export declare function plateKey(value: unknown): string | null;
export declare function plateDisplay(value: unknown): string | null;
export declare function vehiclePhotoPath(garageId: string, vehicleId: string, filename: string): string;
export declare function emptyDataset(): Dataset;

export declare function makeGarage(input?: Partial<Garage>, at?: string): Garage;
export declare function makeCustomer(input?: Partial<Customer>, at?: string): Customer;
export declare function makeVehicle(input?: Partial<Vehicle> & { plate?: string }, at?: string): Vehicle;
export declare function makeJob(input?: Partial<Job>, at?: string): Job;
export declare function makeNote(input?: Partial<Note>, at?: string): Note;
export declare const FACTORIES: Record<TableName, (input?: Record<string, unknown>, at?: string) => unknown>;

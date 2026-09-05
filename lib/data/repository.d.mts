import type { Customer, Dataset, Job, JobStatus, Note, Vehicle, Garage, TableName } from "./schema.d.mts";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ScanInput {
  plate?: string | null;
  make?: string | null;
  model?: string | null;
  confidence?: string | null;
  provider?: string | null;
}

export interface ScanOutcome {
  vehicle: Vehicle;
  created: boolean;
  conflicts: Array<{ field: string; current: unknown; scanned: unknown }>;
}

export interface UndoEntry { label: string; table: TableName; id: string }

export interface Repository {
  readonly garageId: string;
  readonly status: string;

  getGarage(): Garage | null;

  listCustomers(): Customer[];
  getCustomer(id: string): Customer | null;
  createCustomer(input?: Partial<Customer>): Customer;
  updateCustomer(id: string, changes?: Partial<Customer>): Customer | null;

  listVehicles(): Vehicle[];
  getVehicle(id: string): Vehicle | null;
  findVehicleByPlate(plate: unknown): Vehicle | null;
  listVehiclesByCustomer(customerId: string | null): Vehicle[];
  listUnassignedVehicles(): Vehicle[];
  createVehicle(input?: Partial<Vehicle> & { plate: string }): Vehicle;
  updateVehicle(id: string, changes?: Partial<Vehicle>): Vehicle | null;
  linkVehicleToCustomer(vehicleId: string, customerId: string | null): Vehicle | null;
  applyScanResult(scan?: ScanInput): ScanOutcome;
  confirmScannedDetails(vehicleId: string): Vehicle | null;

  getJob(id: string): Job | null;
  createJob(input?: Partial<Job> & { vehicle_id: string }): Job;
  updateJob(id: string, changes?: Partial<Job>): Job | null;
  listJobsByVehicle(vehicleId: string, options?: { order?: "asc" | "desc"; status?: JobStatus | "open" }): Job[];
  listOpenJobs(): Job[];

  createNote(input?: Partial<Note> & { vehicle_id: string }): Note;
  listNotesByVehicle(vehicleId: string, options?: { order?: "asc" | "desc" }): Note[];

  canUndo(): boolean;
  peekUndo(): UndoEntry | null;
  undo(): UndoEntry | null;

  reset(): void;
  snapshot(): Dataset;
}

export declare function createMemoryStorage(initial?: Record<string, string>): StorageAdapter;
export declare function createBrowserStorage(): StorageAdapter;
export declare const MIGRATIONS: Record<number, (dataset: Dataset) => Dataset>;
export declare function createRepository(options?: {
  garageId?: string;
  storage?: StorageAdapter;
  now?: () => Date;
  generateId?: (table: TableName) => string;
  seedWhenEmpty?: boolean;
}): Repository;

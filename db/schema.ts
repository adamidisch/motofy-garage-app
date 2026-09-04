import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes").notNull().default(""),
  createdAt,
  updatedAt,
}, (table) => [index("idx_customers_name").on(table.fullName)]);

export const vehicles = sqliteTable("vehicles", {
  id: text("id").primaryKey(),
  plate: text("plate").notNull(),
  make: text("make"),
  model: text("model"),
  year: integer("year"),
  mileageKm: integer("mileage_km"),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  photoKey: text("photo_key"),
  createdAt,
  updatedAt,
}, (table) => [uniqueIndex("uq_vehicles_plate").on(table.plate), index("idx_vehicles_customer_id").on(table.customerId)]);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  vehicleId: text("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status", { enum: ["scheduled", "active", "done", "cancelled"] }).notNull().default("scheduled"),
  scheduledFor: text("scheduled_for"),
  completedAt: text("completed_at"),
  notes: text("notes").notNull().default(""),
  createdAt,
  updatedAt,
}, (table) => [index("idx_jobs_vehicle_id").on(table.vehicleId), index("idx_jobs_status_scheduled_for").on(table.status, table.scheduledFor)]);

export const vehicleNotes = sqliteTable("vehicle_notes", {
  id: text("id").primaryKey(),
  vehicleId: text("vehicle_id").notNull().references(() => vehicles.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt,
}, (table) => [index("idx_vehicle_notes_vehicle_created").on(table.vehicleId, table.createdAt)]);

export const scanEvents = sqliteTable("scan_events", {
  id: text("id").primaryKey(),
  vehicleId: text("vehicle_id").references(() => vehicles.id, { onDelete: "set null" }),
  plateCandidate: text("plate_candidate"),
  makeCandidate: text("make_candidate"),
  modelCandidate: text("model_candidate"),
  confidence: text("confidence", { enum: ["high", "medium", "low"] }).notNull().default("low"),
  source: text("source").notNull().default("ai"),
  createdAt,
}, (table) => [index("idx_scan_events_vehicle_created").on(table.vehicleId, table.createdAt)]);

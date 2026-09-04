CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`email` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_customers_name` ON `customers` (`full_name`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`scheduled_for` text,
	`completed_at` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_vehicle_id` ON `jobs` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status_scheduled_for` ON `jobs` (`status`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `scan_events` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text,
	`plate_candidate` text,
	`make_candidate` text,
	`model_candidate` text,
	`confidence` text DEFAULT 'low' NOT NULL,
	`source` text DEFAULT 'ai' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_scan_events_vehicle_created` ON `scan_events` (`vehicle_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `vehicle_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_vehicle_notes_vehicle_created` ON `vehicle_notes` (`vehicle_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`plate` text NOT NULL,
	`make` text,
	`model` text,
	`year` integer,
	`mileage_km` integer,
	`customer_id` text,
	`photo_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_vehicles_plate` ON `vehicles` (`plate`);--> statement-breakpoint
CREATE INDEX `idx_vehicles_customer_id` ON `vehicles` (`customer_id`);
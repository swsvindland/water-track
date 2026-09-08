CREATE TABLE `drinks` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`volume_ml` real NOT NULL,
	`caffeine_mg` real DEFAULT 0 NOT NULL,
	`abv` real DEFAULT 0 NOT NULL,
	`consumed_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`synced_revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `preferences` (
	`id` integer PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`units` text NOT NULL,
	`goal_ml` real DEFAULT 2500 NOT NULL,
	`default_ml` real DEFAULT 250 NOT NULL,
	`presets` text NOT NULL,
	`weight_kg` real,
	`body_water_ratio` real,
	`health_enabled` integer DEFAULT false NOT NULL,
	`last_sync` integer
);

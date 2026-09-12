PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_preferences` (
	`id` integer PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`appearance` text DEFAULT 'system' NOT NULL,
	`units` text NOT NULL,
	`goal_ml` real DEFAULT 2500 NOT NULL,
	`default_ml` real DEFAULT 250 NOT NULL,
	`quick_ml` real,
	`favorites` text DEFAULT '[{"id":"water","kind":"water","name":"","ml":250,"caffeine":0,"abv":0},{"id":"energy","kind":"energy","name":"","ml":473,"caffeine":160,"abv":0},{"id":"coffee","kind":"coffee","name":"","ml":240,"caffeine":95,"abv":0},{"id":"tea","kind":"tea","name":"","ml":240,"caffeine":40,"abv":0}]' NOT NULL,
	`weight_kg` real,
	`body_water_ratio` real DEFAULT 0.55,
	`health_enabled` integer DEFAULT false NOT NULL,
	`last_sync` integer,
	`health_weight_kg` real,
	`health_weight_at` integer,
	`health_error` text,
	`health_bac_fingerprint` text
);
--> statement-breakpoint
INSERT INTO `__new_preferences`("id", "language", "appearance", "units", "goal_ml", "default_ml", "quick_ml", "favorites", "weight_kg", "body_water_ratio", "health_enabled", "last_sync", "health_weight_kg", "health_weight_at", "health_error", "health_bac_fingerprint") SELECT "id", "language", "appearance", "units", "goal_ml", "default_ml", "quick_ml", "favorites", "weight_kg", "body_water_ratio", "health_enabled", "last_sync", "health_weight_kg", "health_weight_at", "health_error", "health_bac_fingerprint" FROM `preferences`;--> statement-breakpoint
DROP TABLE `preferences`;--> statement-breakpoint
ALTER TABLE `__new_preferences` RENAME TO `preferences`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
UPDATE `preferences` SET `body_water_ratio` = 0.55, `health_bac_fingerprint` = NULL WHERE `body_water_ratio` IS NULL;

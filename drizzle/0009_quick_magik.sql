ALTER TABLE `preferences` ADD `reminders_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `reminder_schedule` text DEFAULT '[{"wake":420,"bed":1320},{"wake":420,"bed":1320},{"wake":420,"bed":1320},{"wake":420,"bed":1320},{"wake":420,"bed":1320},{"wake":420,"bed":1320},{"wake":420,"bed":1320}]' NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `reminder_morning_glasses` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `reminder_wind_down` integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE `preferences` ADD `reminder_description` text;
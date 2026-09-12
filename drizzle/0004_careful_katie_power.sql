ALTER TABLE `preferences` ADD `health_weight_kg` real;--> statement-breakpoint
ALTER TABLE `preferences` ADD `health_weight_at` integer;--> statement-breakpoint
ALTER TABLE `preferences` ADD `health_error` text;--> statement-breakpoint
ALTER TABLE `preferences` ADD `health_bac_fingerprint` text;
--> statement-breakpoint
UPDATE `drinks` SET `synced_revision` = 0;

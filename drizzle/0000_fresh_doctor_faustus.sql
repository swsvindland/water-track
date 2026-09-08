CREATE TABLE `counters` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "single_counter" CHECK("counters"."id" = 1),
	CONSTRAINT "non_negative_value" CHECK("counters"."value" >= 0)
);

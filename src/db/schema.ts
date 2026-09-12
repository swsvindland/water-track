import { sql } from "drizzle-orm";
import { check, integer, real, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const counters = sqliteTable(
  "counters",
  {
    id: integer("id").primaryKey(),
    value: integer("value").notNull().default(0),
  },
  (table) => [
    check("single_counter", sql`${table.id} = 1`),
    check("non_negative_value", sql`${table.value} >= 0`),
  ]
);

export const drinks = sqliteTable("drinks", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  name: text("name"),
  volumeMl: real("volume_ml").notNull(),
  caffeineMg: real("caffeine_mg").notNull().default(0),
  abv: real("abv").notNull().default(0),
  consumedAt: integer("consumed_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  revision: integer("revision").notNull().default(1),
  deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
  syncedRevision: integer("synced_revision").notNull().default(0),
});

export const preferences = sqliteTable("preferences", {
  id: integer("id").primaryKey(),
  language: text("language").notNull(),
  appearance: text("appearance").notNull().default("system"),
  units: text("units").notNull(),
  goalMl: real("goal_ml").notNull().default(2500),
  defaultMl: real("default_ml").notNull().default(250),
  quickMl: real("quick_ml"),
  favorites: text("favorites")
    .notNull()
    .default(
      '[{"id":"water","kind":"water","name":"","ml":250,"caffeine":0,"abv":0},{"id":"energy","kind":"energy","name":"","ml":473,"caffeine":160,"abv":0},{"id":"coffee","kind":"coffee","name":"","ml":240,"caffeine":95,"abv":0},{"id":"tea","kind":"tea","name":"","ml":240,"caffeine":40,"abv":0}]'
    ),
  weightKg: real("weight_kg"),
  bacEnabled: integer("bac_enabled", { mode: "boolean" }).notNull().default(false),
  bodyWaterRatio: real("body_water_ratio").default(0.55),
  healthEnabled: integer("health_enabled", { mode: "boolean" }).notNull().default(false),
  lastSync: integer("last_sync"),
  healthWeightKg: real("health_weight_kg"),
  healthWeightAt: integer("health_weight_at"),
  healthError: text("health_error"),
  healthBacFingerprint: text("health_bac_fingerprint"),
});

export type Drink = typeof drinks.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;

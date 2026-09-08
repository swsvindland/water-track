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
  units: text("units").notNull(),
  goalMl: real("goal_ml").notNull().default(2500),
  defaultMl: real("default_ml").notNull().default(250),
  presets: text("presets").notNull(),
  weightKg: real("weight_kg"),
  bodyWaterRatio: real("body_water_ratio"),
  healthEnabled: integer("health_enabled", { mode: "boolean" }).notNull().default(false),
  lastSync: integer("last_sync"),
});

export type Drink = typeof drinks.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;

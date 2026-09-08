import { sql } from "drizzle-orm";
import { check, integer, sqliteTable } from "drizzle-orm/sqlite-core";

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

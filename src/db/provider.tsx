import { getLocales } from "expo-localization";
import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { Suspense, useMemo, type PropsWithChildren } from "react";

import migrations from "../../drizzle/migrations";
import * as schema from "./schema";

export async function initializeDatabase(sqlite: SQLiteDatabase) {
  await sqlite.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const db = drizzle(sqlite, { schema });
  await migrate(db, migrations);
  const locale = getLocales()[0];
  const us = locale?.measurementSystem === "us";
  db.insert(schema.preferences)
    .values({
      id: 1,
      language: "system",
      units: us ? "us" : "metric",
      defaultMl: us ? 236.5882365 : 250,
    })
    .onConflictDoNothing()
    .run();
  db.insert(schema.counters).values({ id: 1, value: 0 }).onConflictDoNothing().run();
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    // The splash (held in app/_layout) covers opening and migrating the database.
    <Suspense fallback={null}>
      <SQLiteProvider
        databaseName="water-track.db"
        options={{ enableChangeListener: true }}
        onInit={initializeDatabase}
        useSuspense
      >
        {children}
      </SQLiteProvider>
    </Suspense>
  );
}

export function useDatabase() {
  const sqlite = useSQLiteContext();
  return useMemo(() => drizzle(sqlite, { schema }), [sqlite]);
}

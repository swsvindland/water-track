import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { Suspense, useMemo, type PropsWithChildren } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import migrations from "../../drizzle/migrations";
import * as schema from "./schema";

async function initializeDatabase(sqlite: SQLiteDatabase) {
  await sqlite.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const db = drizzle(sqlite, { schema });
  await migrate(db, migrations);
  db.insert(schema.counters).values({ id: 1, value: 0 }).onConflictDoNothing().run();
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <Suspense
      fallback={
        <View className="flex-1 items-center justify-center gap-4 bg-background">
          <ActivityIndicator />
          <Text className="text-foreground">Opening your saved data…</Text>
        </View>
      }
    >
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

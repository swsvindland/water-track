import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AppState, ActivityIndicator, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { desc, eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { drinks, preferences, type Drink, type Preferences } from "@/db/schema";
import { translate, type Message } from "./i18n";
import { OZ_ML } from "./metrics";
import { registerBackgroundSync, syncHealth } from "./health";

type State = {
  rows: Drink[];
  settings: Preferences;
  now: number;
  t: (key: Message) => string;
  number: (n: number, digits?: number) => string;
  volume: (ml: number) => string;
  locale: string;
};
const Context = createContext<State | null>(null);
export function AppProvider({ children }: PropsWithChildren) {
  const db = useDatabase();
  const records = useLiveQuery(db.select().from(drinks).orderBy(desc(drinks.consumedAt)));
  const prefs = useLiveQuery(db.select().from(preferences).where(eq(preferences.id, 1)));
  const settings = prefs.data[0];
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(Date.now());
        void syncHealth().catch(() => {});
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (settings?.healthEnabled) {
      void registerBackgroundSync().catch(() => {});
      void syncHealth().catch(() => {});
    }
  }, [settings?.healthEnabled, records.updatedAt]);
  if (records.error || prefs.error)
    return (
      <View className="flex-1 justify-center p-6 bg-background">
        <Text className="text-danger">{translate(settings?.language ?? "en", "readError")}</Text>
      </View>
    );
  if (!settings || !records.updatedAt)
    return (
      <View className="flex-1 justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  const locale = settings.language === "es" ? "es-ES" : "en-US";
  const number = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  const volume = (ml: number) =>
    settings.units === "us" ? `${number(ml / OZ_ML, 1)} fl oz` : `${number(ml)} mL`;
  return (
    <Context.Provider
      value={{
        rows: records.data,
        settings,
        now,
        locale,
        number,
        volume,
        t: (key) => translate(settings.language, key),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const state = useContext(Context);
  if (!state) throw new Error("AppProvider missing");
  return state;
}

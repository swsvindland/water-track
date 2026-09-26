import { useLocales } from "expo-localization";
import { Uniwind } from "uniwind";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { AppState, ActivityIndicator, Text, View } from "react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { desc, eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { drinks, preferences, type Drink, type Preferences } from "@/db/schema";
import { languagePreference, localeTag, resolveLanguage, translate, type Message } from "./i18n";
import { bacWeight } from "./health-data";
import { formatVolume } from "./metrics";
import { registerBackgroundSync, unregisterBackgroundSync, syncHealth } from "./health";
import { registerReminderRefresh, syncReminders, unregisterReminderRefresh } from "./notifications";

type State = {
  rows: Drink[];
  settings: Preferences;
  now: number;
  bacWeightKg: number | null;
  t: (key: Message) => string;
  number: (n: number, digits?: number) => string;
  volume: (ml: number) => string;
  locale: string;
};
const Context = createContext<State | null>(null);
export function AppProvider({ children }: PropsWithChildren) {
  const deviceLocales = useLocales();
  const db = useDatabase();
  const records = useLiveQuery(db.select().from(drinks).orderBy(desc(drinks.consumedAt)));
  const prefs = useLiveQuery(db.select().from(preferences).where(eq(preferences.id, 1)));
  const settings = prefs.data[0];
  useEffect(() => {
    const appearance = settings?.appearance;
    Uniwind.setTheme(appearance === "light" || appearance === "dark" ? appearance : "system");
  }, [settings?.appearance]);
  const language = resolveLanguage(
    languagePreference(settings?.language),
    deviceLocales[0]?.languageCode
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    function startClock() {
      setNow(Date.now());
      timer = setInterval(() => setNow(Date.now()), 1000);
    }
    if (AppState.currentState === "active" || AppState.currentState === null) startClock();
    const subscription = AppState.addEventListener("change", (state) => {
      clearInterval(timer);
      if (state === "active") {
        startClock();
        void syncHealth().catch(() => {});
        // Also picks up permission changes made in system settings.
        void syncReminders().catch(() => {});
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const drinkRevisions = records.data.map((drink) => `${drink.id}:${drink.revision}`).join(",");
  useEffect(() => {
    if (settings?.healthEnabled) {
      void registerBackgroundSync().catch(() => {});
      void syncHealth().catch(() => {});
    } else if (settings?.healthEnabled === false) {
      void unregisterBackgroundSync().catch(() => {});
    }
  }, [
    settings?.bacEnabled,
    settings?.healthEnabled,
    settings?.weightKg,
    settings?.bodyWaterRatio,
    drinkRevisions,
  ]);
  useEffect(() => {
    if (settings?.remindersEnabled) void registerReminderRefresh().catch(() => {});
    else if (settings?.remindersEnabled === false) {
      void unregisterReminderRefresh().catch(() => {});
      void syncReminders().catch(() => {});
    }
  }, [settings?.remindersEnabled]);
  // Reminders fire only when behind plan, so any intake or plan change reschedules them.
  useEffect(() => {
    if (settings?.remindersEnabled) void syncReminders().catch(() => {});
  }, [
    settings?.remindersEnabled,
    settings?.reminderSchedule,
    settings?.reminderMorningGlasses,
    settings?.reminderWindDown,
    settings?.goalMl,
    settings?.defaultMl,
    settings?.units,
    language,
    drinkRevisions,
  ]);
  if (records.error || prefs.error)
    return (
      <View className="flex-1 justify-center p-6 bg-background">
        <Text className="text-danger">{translate(language, "readError")}</Text>
      </View>
    );
  if (!settings || !records.updatedAt)
    return (
      <View className="flex-1 justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  const locale = localeTag(language);
  const number = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  const volume = (ml: number) => formatVolume(ml, settings.units, locale);
  return (
    <Context.Provider
      value={{
        rows: records.data,
        settings,
        now,
        bacWeightKg: bacWeight(settings),
        locale,
        number,
        volume,
        t: (key) => translate(language, key),
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

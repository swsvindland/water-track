import { useLocales } from "expo-localization";
import { useState, useSyncExternalStore } from "react";
import { router } from "expo-router";
import { Button, Card, RadioGroup, Select, Switch } from "heroui-native";
import { Platform, ScrollView, View } from "react-native";
import { eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { drinks, preferences, type Preferences } from "@/db/schema";
import { useApp } from "@/lib/store";
import { LB_KG, OZ_ML, parseNumber } from "@/lib/metrics";
import {
  languages,
  languagePreference,
  resolveLanguage,
  translate,
  type Message,
} from "@/lib/i18n";
import { connectHealth, healthAvailable, healthSyncing, subscribeHealthSync } from "@/lib/health";
import { Screen, Field, Heading, Note } from "@/components/ui";
import { SystemLabel } from "@/components/system";

export default function Settings() {
  const { settings, locale } = useApp();
  const db = useDatabase();
  const language = languagePreference(settings.language);
  const appearance = settings.appearance;
  const deviceLocales = useLocales();
  const resolvedLanguage = resolveLanguage(language, deviceLocales[0]?.languageCode);
  const units = settings.units;
  const factor = units === "us" ? OZ_ML : 1;
  const weightFactor = units === "us" ? LB_KG : 1;
  const round = (n: number) => String(Number(n.toFixed(2)));
  const [goal, setGoal] = useState(round(settings.goalMl / factor));
  const [size, setSize] = useState(round(settings.defaultMl / factor));
  const [weight, setWeight] = useState(
    settings.weightKg ? round(settings.weightKg / weightFactor) : ""
  );
  const bacEnabled = settings.bacEnabled;
  const ratio = String(settings.bodyWaterRatio ?? 0.55);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const t = (key: Parameters<typeof translate>[1]) => translate(resolvedLanguage, key);
  function persist(update: Partial<Preferences>) {
    try {
      db.update(preferences).set(update).where(eq(preferences.id, 1)).run();
      setMessage("");
      setError(false);
      return true;
    } catch {
      setMessage(t("saveError"));
      setError(true);
      return false;
    }
  }
  function changeUnits(next: string) {
    if (next === units || !persist({ units: next })) return;
    const nextFactor = next === "us" ? OZ_ML : 1;
    setGoal(round(settings.goalMl / nextFactor));
    setSize(round(settings.defaultMl / nextFactor));
    setWeight(
      settings.weightKg === null ? "" : round(settings.weightKg / (next === "us" ? LB_KG : 1))
    );
  }
  function changeNumber(
    field: "goalMl" | "defaultMl" | "weightKg",
    text: string,
    finished = false
  ) {
    const setDraft = field === "goalMl" ? setGoal : field === "defaultMl" ? setSize : setWeight;
    setDraft(text);
    const value =
      field === "weightKg" && !text.trim()
        ? null
        : parseNumber(text) * (field === "weightKg" ? weightFactor : factor);
    const valid =
      value === null ||
      (Number.isFinite(value) &&
        value >= (field === "weightKg" ? 20 : 1) &&
        value <= (field === "weightKg" ? 400 : 5000));
    if (valid) {
      // Avoid rewriting rounded display values when an unchanged field loses focus.
      if (!finished) persist({ [field]: value });
    } else if (finished) {
      setMessage(t("invalidSettings"));
      setError(true);
      const saved = settings[field];
      setDraft(saved === null ? "" : round(saved / (field === "weightKg" ? weightFactor : factor)));
    }
  }
  return (
    <Screen title={t("settings")} subtitle={t("preferencesNote")}>
      <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
        <Card.Body className="gap-4">
          <Card.Title>{t("language")}</Card.Title>
          <Select
            value={{
              value: language,
              label: language === "system" ? t("system") : languages[language],
            }}
            onValueChange={(option) => {
              if (option) persist({ language: languagePreference(option.value) });
            }}
          >
            <Select.Trigger
              className="border border-field-border"
              accessibilityLabel={t("language")}
            >
              <Select.Value placeholder={t("system")} />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
                  <Select.Item value="system" label={t("system")} />
                  {Object.entries(languages).map(([value, label]) => (
                    <Select.Item key={value} value={value} label={label} />
                  ))}
                </ScrollView>
              </Select.Content>
            </Select.Portal>
          </Select>
        </Card.Body>
      </Card>
      <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
        <Card.Body className="gap-4">
          <Card.Title>{t("appearance")}</Card.Title>
          <Select
            value={{
              value: appearance,
              label: t(appearance === "light" || appearance === "dark" ? appearance : "system"),
            }}
            onValueChange={(option) => {
              if (option) persist({ appearance: option.value });
            }}
          >
            <Select.Trigger
              className="border border-field-border"
              accessibilityLabel={t("appearance")}
            >
              <Select.Value placeholder={t("system")} />
              <Select.TriggerIndicator />
            </Select.Trigger>
            <Select.Portal>
              <Select.Overlay />
              <Select.Content presentation="popover" width="trigger">
                <Select.Item value="system" label={t("system")} />
                <Select.Item value="light" label={t("light")} />
                <Select.Item value="dark" label={t("dark")} />
              </Select.Content>
            </Select.Portal>
          </Select>
        </Card.Body>
      </Card>
      <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
        <Card.Body className="gap-4">
          <Card.Title>{t("units")}</Card.Title>
          <RadioGroup value={units} onValueChange={changeUnits} accessibilityLabel={t("units")}>
            <RadioGroup.Item value="metric">{`${t("metric")} · mL / kg`}</RadioGroup.Item>
            <RadioGroup.Item value="us">{`${t("us")} · fl oz / lb`}</RadioGroup.Item>
          </RadioGroup>
        </Card.Body>
      </Card>
      <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
        <Card.Body className="gap-4">
          <Card.Title>{t("hydration")}</Card.Title>
          <Field
            label={`${t("goal")} (${units === "us" ? "fl oz" : "mL"})`}
            value={goal}
            onChangeText={(text) => changeNumber("goalMl", text)}
            onBlur={() => changeNumber("goalMl", goal, true)}
            keyboardType="decimal-pad"
          />
          <Field
            label={`${t("defaultSize")} (${units === "us" ? "fl oz" : "mL"})`}
            value={size}
            onChangeText={(text) => changeNumber("defaultMl", text)}
            onBlur={() => changeNumber("defaultMl", size, true)}
            keyboardType="decimal-pad"
          />
        </Card.Body>
      </Card>
      <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
        <Card.Body className="gap-4">
          <Card.Title>{t("manage")}</Card.Title>
          <Button variant="outline" onPress={() => router.push("/favorites")}>
            {t("manage")}
          </Button>
        </Card.Body>
      </Card>
      <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
        <Card.Body className="gap-4">
          <Card.Title>{t("bacProfile")}</Card.Title>
          <View className="flex-row items-center justify-between gap-4">
            <Heading>{t("bacEnabled")}</Heading>
            <Switch
              accessibilityLabel={t("bacEnabled")}
              isSelected={bacEnabled}
              onSelectedChange={(enabled) => persist({ bacEnabled: enabled })}
            />
          </View>
          <View className="gap-4" style={{ opacity: bacEnabled ? 1 : 0.5 }}>
            <Field
              label={`${t("weight")} (${units === "us" ? "lb" : "kg"})`}
              editable={bacEnabled}
              value={weight}
              onChangeText={(text) => changeNumber("weightKg", text)}
              onBlur={() => changeNumber("weightKg", weight, true)}
              keyboardType="decimal-pad"
              placeholder={t("optional")}
            />
            {settings.healthEnabled && settings.healthWeightKg !== null && (
              <Note>
                {t("healthWeight")}: {round(settings.healthWeightKg / weightFactor)}{" "}
                {units === "us" ? "lb" : "kg"}
                {settings.healthWeightAt
                  ? ` · ${new Date(settings.healthWeightAt).toLocaleDateString(locale)}`
                  : ""}
              </Note>
            )}
            <View className="gap-3">
              <Heading>{t("factor")}</Heading>
              <RadioGroup
                value={ratio}
                onValueChange={(value) => persist({ bodyWaterRatio: Number(value) })}
                accessibilityLabel={t("factor")}
                isDisabled={!bacEnabled}
              >
                <RadioGroup.Item value="0.55">{t("factorLow")}</RadioGroup.Item>
                <RadioGroup.Item value="0.68">{t("factorHigh")}</RadioGroup.Item>
              </RadioGroup>
              <Note>{t("factorNote")}</Note>
            </View>
          </View>
        </Card.Body>
      </Card>
      {!!message && <Note error={error}>{message}</Note>}
      <HealthSync />
      <Note>{t("localNote")}</Note>
    </Screen>
  );
}

function HealthSync() {
  const { settings, rows, locale, t } = useApp();
  const db = useDatabase();
  const syncing = useSyncExternalStore(subscribeHealthSync, healthSyncing);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ key: Message; error: boolean } | null>(null);
  const enabled = settings.healthEnabled;
  const pending = rows.filter((d) => d.revision !== d.syncedRevision).length;
  async function connect() {
    setBusy(true);
    setNotice(null);
    try {
      // Permission prompts only follow this explicit opt-in; automatic sync never prompts.
      await connectHealth();
      // Queue every drink before enabling so newly granted types are backfilled. The app
      // provider registers background work and exports as soon as sync is enabled.
      db.update(drinks).set({ syncedRevision: 0 }).run();
      db.update(preferences)
        .set({ healthEnabled: true, healthError: null, healthBacFingerprint: null })
        .where(eq(preferences.id, 1))
        .run();
    } catch (e) {
      setNotice({
        key:
          e instanceof Error && e.message === "unavailable"
            ? "healthUnavailable"
            : "healthConnectError",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  function disconnect() {
    try {
      db.update(preferences)
        .set({ healthEnabled: false, healthError: null })
        .where(eq(preferences.id, 1))
        .run();
      setNotice({ key: "disconnectNote", error: false });
    } catch {
      setNotice({ key: "saveError", error: true });
    }
  }
  const status = !enabled
    ? { label: t("healthOff"), dot: "bg-muted" }
    : syncing
      ? { label: t("syncing"), dot: "bg-accent" }
      : settings.healthError
        ? { label: t("syncIncomplete"), dot: "bg-danger" }
        : pending
          ? { label: `${t("pending")}: ${pending}`, dot: "bg-warning" }
          : { label: t("syncDone"), dot: "bg-success" };
  return (
    <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
      <Card.Body className="gap-4">
        <View className="flex-row items-center justify-between gap-4">
          <Card.Title className="flex-1">{t("health")}</Card.Title>
          <Switch
            accessibilityLabel={t("health")}
            isSelected={enabled}
            isDisabled={busy || !healthAvailable}
            onSelectedChange={(next) => (next ? void connect() : disconnect())}
          />
        </View>
        <Note>{t(Platform.OS === "ios" ? "healthApple" : "healthAndroid")}</Note>
        {healthAvailable ? (
          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <View className={`h-2 w-2 rounded-full ${status.dot}`} />
              <SystemLabel>{status.label}</SystemLabel>
            </View>
            {enabled && settings.lastSync && (
              <Note>
                {t("lastSync")}: {new Date(settings.lastSync).toLocaleString(locale)}
              </Note>
            )}
          </View>
        ) : (
          <Note>{t("healthUnavailable")}</Note>
        )}
        {enabled && settings.healthError && <Note error>{t("healthError")}</Note>}
        {enabled && <Note>{t("backgroundNote")}</Note>}
        {notice && <Note error={notice.error}>{t(notice.key)}</Note>}
      </Card.Body>
    </Card>
  );
}

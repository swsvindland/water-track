import { useLocales } from "expo-localization";
import { useState } from "react";
import { router } from "expo-router";
import { Button, Card, RadioGroup, Select, Switch } from "heroui-native";
import { Platform, ScrollView, View } from "react-native";
import { eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { drinks, preferences, type Preferences } from "@/db/schema";
import { useApp } from "@/lib/store";
import { LB_KG, OZ_ML, parseNumber } from "@/lib/metrics";
import { languages, languagePreference, resolveLanguage, translate } from "@/lib/i18n";
import {
  connectHealth,
  healthAvailable,
  registerBackgroundSync,
  syncHealth,
  unregisterBackgroundSync,
} from "@/lib/health";
import { Screen, Field, Heading, Note } from "@/components/ui";

export default function Settings() {
  const { settings, rows, locale } = useApp();
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
  const [busy, setBusy] = useState(false);
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
  async function health(action: "connect" | "sync" | "disconnect") {
    setBusy(true);
    setMessage("");
    try {
      if (action === "disconnect") {
        db.update(preferences)
          .set({ healthEnabled: false, healthError: null })
          .where(eq(preferences.id, 1))
          .run();
        await unregisterBackgroundSync();
      } else {
        // Permission prompts only follow an explicit switch/manual-sync action.
        await connectHealth();
        db.update(preferences)
          .set({ healthEnabled: true, healthError: null, healthBacFingerprint: null })
          .where(eq(preferences.id, 1))
          .run();
        db.update(drinks).set({ syncedRevision: 0 }).run();
        await registerBackgroundSync();
        await syncHealth();
      }
      setMessage(t(action === "disconnect" ? "disconnectNote" : "syncDone"));
      setError(false);
    } catch (e) {
      setMessage(
        t(e instanceof Error && e.message === "unavailable" ? "healthUnavailable" : "healthError")
      );
      setError(true);
    } finally {
      setBusy(false);
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
      <Card className="rounded-md border border-border bg-surface p-6 shadow-none">
        <Card.Body className="gap-4">
          <Card.Title>{t("health")}</Card.Title>
          <Note>{t(settings.healthEnabled ? "healthOn" : "healthOff")}</Note>
          <Note>{t(Platform.OS === "ios" ? "healthApple" : "healthAndroid")}</Note>
          <View className="flex-row items-center justify-between gap-4">
            <Heading>{t("health")}</Heading>
            <Switch
              accessibilityLabel={t("health")}
              isSelected={settings.healthEnabled}
              isDisabled={busy || !healthAvailable}
              onSelectedChange={(enabled) => void health(enabled ? "connect" : "disconnect")}
            />
          </View>
          {settings.healthEnabled && settings.healthError && <Note error>{t("healthError")}</Note>}
          <Note>{t("backgroundNote")}</Note>
          {settings.lastSync && (
            <Note>
              {t("lastSync")}: {new Date(settings.lastSync).toLocaleString(locale)}
            </Note>
          )}
          {settings.healthEnabled && (
            <Note>
              {t("pending")}: {rows.filter((d) => d.revision !== d.syncedRevision).length}
            </Note>
          )}
          {!healthAvailable && <Note>{t("healthUnavailable")}</Note>}
        </Card.Body>
        {settings.healthEnabled && (
          <Card.Footer>
            <Button
              className="w-full"
              isDisabled={busy}
              variant="outline"
              onPress={() => void health("sync")}
            >
              {t("syncNow")}
            </Button>
          </Card.Footer>
        )}
      </Card>
      <Note>{t("localNote")}</Note>
    </Screen>
  );
}

import { useState, useSyncExternalStore, type ComponentProps } from "react";
import { router } from "expo-router";
import { Platform, View } from "react-native";
import { eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { drinks, preferences, type Preferences } from "@/db/schema";
import { useApp } from "@/lib/store";
import { LB_KG, OZ_ML } from "@/lib/metrics";
import { languages, languagePreference, type LanguagePreference, type Message } from "@/lib/i18n";
import { connectHealth, healthAvailable, healthSyncing, subscribeHealthSync } from "@/lib/health";
import {
  Choices,
  ErrorText,
  Field,
  ListRow,
  Meta,
  Note,
  Screen,
  Select,
  SettingsSection,
  Status,
  useKitFormat,
} from "@/vector";
import { ChoicesField, FormSection, SwitchField } from "@/components/fields";
import { parseAmount, useVolume, useWeight } from "@/components/format";
import { ReminderSettings } from "@/components/reminder-settings";
import { VaultSection } from "@/vault";
import { useVaultRestoreKey } from "@/vault-app-ui";

const languageChoices = ["system", ...Object.keys(languages)] as LanguagePreference[];
const appearances = ["system", "light", "dark"] as const;
const unitChoices = ["metric", "us"] as const;
const ratios = ["0.55", "0.68"];

export default function Settings() {
  const { t } = useApp();
  // A restore bumps the key, so the form's drafts start again from the restored preferences.
  const restores = useVaultRestoreKey();
  return (
    <Screen title={t("settings")} subtitle={t("preferencesNote")}>
      <SettingsForm key={restores} />
      <HealthSync />
      <VaultSection />
      <Note>{t("localNote")}</Note>
    </Screen>
  );
}

/** Preferences and reminders: the drafts here (and in ReminderSettings) are seeded once from the stored values. */
function SettingsForm() {
  const { settings, t } = useApp();
  const db = useDatabase();
  const format = useKitFormat();
  const volume = useVolume();
  const bodyWeight = useWeight();
  const language = languagePreference(settings.language);
  const appearance =
    settings.appearance === "light" || settings.appearance === "dark"
      ? settings.appearance
      : "system";
  const units = settings.units;
  const factor = units === "us" ? OZ_ML : 1;
  const weightFactor = units === "us" ? LB_KG : 1;
  const [goal, setGoal] = useState(format.editable(settings.goalMl / factor));
  const [size, setSize] = useState(format.editable(settings.defaultMl / factor));
  const [weight, setWeight] = useState(
    settings.weightKg ? format.editable(settings.weightKg / weightFactor) : ""
  );
  const bacEnabled = settings.bacEnabled;
  const ratio = String(settings.bodyWaterRatio ?? 0.55);
  const [message, setMessage] = useState("");
  function persist(update: Partial<Preferences>) {
    try {
      db.update(preferences).set(update).where(eq(preferences.id, 1)).run();
      setMessage("");
      return true;
    } catch {
      setMessage(t("saveError"));
      return false;
    }
  }
  function changeUnits(next: string) {
    if (next === units || !persist({ units: next })) return;
    const nextFactor = next === "us" ? OZ_ML : 1;
    setGoal(format.editable(settings.goalMl / nextFactor));
    setSize(format.editable(settings.defaultMl / nextFactor));
    setWeight(
      settings.weightKg === null
        ? ""
        : format.editable(settings.weightKg / (next === "us" ? LB_KG : 1))
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
        : parseAmount(format, text) * (field === "weightKg" ? weightFactor : factor);
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
      const saved = settings[field];
      setDraft(
        saved === null
          ? ""
          : format.editable(saved / (field === "weightKg" ? weightFactor : factor))
      );
    }
  }
  return (
    <>
      <FormSection eyebrow={t("language")}>
        <Select
          title={t("language")}
          values={languageChoices}
          value={language}
          label={(value) => (value === "system" ? t("system") : languages[value])}
          onChange={(value) => persist({ language: languagePreference(value) })}
        />
      </FormSection>
      <FormSection eyebrow={t("appearance")}>
        <Select
          title={t("appearance")}
          values={appearances}
          value={appearance}
          label={(value) => t(value)}
          onChange={(value) => persist({ appearance: value })}
        />
      </FormSection>
      <FormSection eyebrow={t("units")}>
        <Choices
          values={unitChoices}
          value={units === "us" ? "us" : "metric"}
          label={(value) =>
            t("unitsOption", {
              name: t(value),
              units: t("unitPair", {
                volume: format.unitParts(1, value === "us" ? "fluid-ounce" : "milliliter").unit,
                weight: format.unitParts(1, value === "us" ? "pound" : "kilogram").unit,
              }),
            })
          }
          onChange={changeUnits}
          accessibilityLabel={t("units")}
        />
      </FormSection>
      <FormSection eyebrow={t("hydration")}>
        <Field
          label={t("goal")}
          value={goal}
          onChange={(text) => changeNumber("goalMl", text)}
          onBlur={() => changeNumber("goalMl", goal, true)}
          numeric
          unit={volume.unit}
        />
        <Field
          label={t("defaultSize")}
          value={size}
          onChange={(text) => changeNumber("defaultMl", text)}
          onBlur={() => changeNumber("defaultMl", size, true)}
          numeric
          unit={volume.unit}
        />
      </FormSection>
      <ReminderSettings />
      <SettingsSection eyebrow={t("favorites")}>
        <ListRow title={t("manage")} onPress={() => router.push("/favorites")} />
      </SettingsSection>
      <FormSection eyebrow={t("bacProfile")}>
        <SwitchField
          label={t("bacEnabled")}
          value={bacEnabled}
          onChange={(enabled) => persist({ bacEnabled: enabled })}
        />
        <Field
          label={t("weight")}
          disabled={!bacEnabled}
          value={weight}
          onChange={(text) => changeNumber("weightKg", text)}
          onBlur={() => changeNumber("weightKg", weight, true)}
          numeric
          unit={bodyWeight.unit}
          placeholder={t("optional")}
        />
        {settings.healthEnabled && settings.healthWeightKg !== null && (
          <Meta
            items={[
              t("healthWeight"),
              bodyWeight.text(settings.healthWeightKg),
              settings.healthWeightAt ? format.date(new Date(settings.healthWeightAt)) : "",
            ]}
          />
        )}
        <ChoicesField
          title={t("factor")}
          values={ratios}
          value={ratio}
          label={(value) => t(value === "0.68" ? "factorHigh" : "factorLow")}
          onChange={(value) => persist({ bodyWaterRatio: Number(value) })}
          disabled={!bacEnabled}
        />
        <Note>{t("factorNote")}</Note>
      </FormSection>
      <ErrorText message={message} />
    </>
  );
}

function HealthSync() {
  const { settings, rows, t } = useApp();
  const db = useDatabase();
  const format = useKitFormat();
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
  const status: ComponentProps<typeof Status> = !enabled
    ? { state: "off", label: t("healthOff") }
    : syncing
      ? { state: "live", label: t("syncing") }
      : settings.healthError
        ? { state: "error", label: t("syncIncomplete") }
        : pending
          ? { state: "attention", label: t("pending"), meta: format.number(pending) }
          : { state: "ok", label: t("syncDone") };
  const lastSync = settings.lastSync ? new Date(settings.lastSync) : null;
  return (
    <FormSection eyebrow={t("health")}>
      <SwitchField
        label={t("connect")}
        value={enabled}
        disabled={busy || !healthAvailable}
        onChange={(next) => (next ? void connect() : disconnect())}
      />
      <Note>{t(Platform.OS === "ios" ? "healthApple" : "healthAndroid")}</Note>
      {healthAvailable ? (
        <View className="gap-2">
          <Status {...status} />
          {enabled && lastSync && (
            <Meta items={[t("lastSync"), format.date(lastSync), format.time(lastSync)]} />
          )}
        </View>
      ) : (
        <Note>{t("healthUnavailable")}</Note>
      )}
      {enabled && settings.healthError && <ErrorText message={t("healthError")} />}
      {enabled && <Note>{t("backgroundNote")}</Note>}
      {notice &&
        (notice.error ? <ErrorText message={t(notice.key)} /> : <Note>{t(notice.key)}</Note>)}
    </FormSection>
  );
}

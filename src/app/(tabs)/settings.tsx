import { useState } from "react";
import { router } from "expo-router";
import { Button, Card } from "heroui-native";
import { View } from "react-native";
import { eq } from "drizzle-orm";
import { useDatabase } from "@/db/provider";
import { preferences } from "@/db/schema";
import { useApp } from "@/lib/store";
import { LB_KG, OZ_ML, parseNumber } from "@/lib/metrics";
import { translate } from "@/lib/i18n";
import {
  connectHealth,
  healthAvailable,
  registerBackgroundSync,
  syncHealth,
  unregisterBackgroundSync,
} from "@/lib/health";
import { Screen, Choices, Field, Heading, Note } from "@/components/ui";

export default function Settings() {
  const { settings, rows, locale } = useApp();
  const db = useDatabase();
  const [language, setLanguage] = useState(settings.language);
  const [units, setUnits] = useState(settings.units);
  const factor = units === "us" ? OZ_ML : 1;
  const weightFactor = units === "us" ? LB_KG : 1;
  const round = (n: number) => String(Number(n.toFixed(2)));
  const [goal, setGoal] = useState(round(settings.goalMl / factor));
  const [size, setSize] = useState(round(settings.defaultMl / factor));
  const [sizes, setSizes] = useState(
    (JSON.parse(settings.presets) as number[]).map((n) => round(n / factor)).join(", ")
  );
  const [weight, setWeight] = useState(
    settings.weightKg ? round(settings.weightKg / weightFactor) : ""
  );
  const [ratio, setRatio] = useState(String(settings.bodyWaterRatio ?? ""));
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  function changeUnits(next: string) {
    if (next === units) return;
    const nextFactor = next === "us" ? OZ_ML : 1;
    setGoal(round((parseNumber(goal) * factor) / nextFactor));
    setSize(round((parseNumber(size) * factor) / nextFactor));
    setSizes(
      sizes
        .split(",")
        .map((n) => round((parseNumber(n) * factor) / nextFactor))
        .join(", ")
    );
    if (weight)
      setWeight(round((parseNumber(weight) * weightFactor) / (next === "us" ? LB_KG : 1)));
    setUnits(next);
  }
  function save() {
    const goalMl = parseNumber(goal) * factor,
      defaultMl = parseNumber(size) * factor;
    const presets = sizes.split(",").map((n) => parseNumber(n) * factor);
    const weightKg = weight.trim() ? parseNumber(weight) * weightFactor : null;
    if (
      ![goalMl, defaultMl, ...presets].every((n) => Number.isFinite(n) && n >= 1 && n <= 5000) ||
      presets.length > 8 ||
      (weightKg !== null && (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400))
    ) {
      setMessage(t("invalidSettings"));
      setError(true);
      return;
    }
    try {
      db.update(preferences)
        .set({
          language,
          units,
          goalMl,
          defaultMl,
          presets: JSON.stringify(presets),
          weightKg,
          bodyWaterRatio: ratio ? Number(ratio) : null,
        })
        .where(eq(preferences.id, 1))
        .run();
      setMessage(t("saved"));
      setError(false);
    } catch {
      setMessage(t("saveError"));
      setError(true);
    }
  }
  async function health(action: "connect" | "sync" | "disconnect") {
    setBusy(true);
    setMessage("");
    try {
      if (action === "disconnect") {
        db.update(preferences).set({ healthEnabled: false }).where(eq(preferences.id, 1)).run();
        await unregisterBackgroundSync();
      } else {
        if (action === "connect") {
          await connectHealth();
          db.update(preferences).set({ healthEnabled: true }).where(eq(preferences.id, 1)).run();
        }
        await syncHealth();
        await registerBackgroundSync();
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
      <Button variant="outline" onPress={() => router.push("/favorites")}>
        {t("manage")}
      </Button>
      <View className="gap-3">
        <Heading>{t("language")}</Heading>
        <Choices
          value={language}
          onChange={setLanguage}
          options={[
            { value: "en", label: "English" },
            { value: "es", label: "Español" },
          ]}
        />
      </View>
      <View className="gap-3">
        <Heading>{t("units")}</Heading>
        <Choices
          value={units}
          onChange={changeUnits}
          options={[
            { value: "metric", label: `${t("metric")} · mL / kg` },
            { value: "us", label: `${t("us")} · fl oz / lb` },
          ]}
        />
      </View>
      <Field
        label={`${t("goal")} (${units === "us" ? "fl oz" : "mL"})`}
        value={goal}
        onChangeText={setGoal}
        keyboardType="decimal-pad"
      />
      <Field
        label={`${t("defaultSize")} (${units === "us" ? "fl oz" : "mL"})`}
        value={size}
        onChangeText={setSize}
        keyboardType="decimal-pad"
      />
      <Field label={t("presets")} value={sizes} onChangeText={setSizes} />
      <Note>{t("presetsHint")}</Note>
      <Heading>{t("bacProfile")}</Heading>
      <Field
        label={`${t("weight")} (${units === "us" ? "lb" : "kg"})`}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder={t("optional")}
      />
      <View className="gap-3">
        <Heading>{t("factor")}</Heading>
        <Choices
          value={ratio}
          onChange={setRatio}
          options={[
            { value: "", label: t("factorNone") },
            { value: "0.55", label: t("factorLow") },
            { value: "0.68", label: t("factorHigh") },
          ]}
        />
        <Note>{t("factorNote")}</Note>
      </View>
      <Button onPress={save}>{t("save")}</Button>
      {!!message && <Note error={error}>{message}</Note>}
      <Card>
        <Card.Body className="gap-4">
          <Card.Title>{t("health")}</Card.Title>
          <Note>{t(settings.healthEnabled ? "healthOn" : "healthOff")}</Note>
          <Note>{t("healthNote")}</Note>
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
        <Card.Footer className="flex-col gap-2">
          {settings.healthEnabled ? (
            <>
              <Button
                className="w-full"
                isDisabled={busy}
                variant="outline"
                onPress={() => void health("sync")}
              >
                {t("syncNow")}
              </Button>
              <Button
                className="w-full"
                isDisabled={busy}
                variant="ghost"
                onPress={() => void health("disconnect")}
              >
                {t("disconnect")}
              </Button>
            </>
          ) : (
            <Button
              className="w-full"
              isDisabled={busy || !healthAvailable}
              variant="outline"
              onPress={() => void health("connect")}
            >
              {t("connect")}
            </Button>
          )}
        </Card.Footer>
      </Card>
      <Note>{t("localNote")}</Note>
    </Screen>
  );
}

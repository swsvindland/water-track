import { useLocalSearchParams, router } from "expo-router";
import { Button } from "heroui-native";
import { useState } from "react";
import { Alert, View } from "react-native";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { useDatabase } from "@/db/provider";
import { drinks } from "@/db/schema";
import { useApp } from "@/lib/store";
import {
  defaults,
  kinds,
  localDateTime,
  OZ_ML,
  parseDateTime,
  parseNumber,
  type DrinkKind,
} from "@/lib/metrics";
import { Screen, Choices, Field, Heading, Note } from "@/components/ui";

export default function DrinkEditor() {
  const params = useLocalSearchParams<{ id?: string; ml?: string }>();
  const { rows, settings, volume, t } = useApp();
  const db = useDatabase();
  const existing = rows.find((d) => d.id === params.id && !d.deleted);
  const factor = settings.units === "us" ? OZ_ML : 1;
  const [kind, setKind] = useState<DrinkKind>((existing?.kind as DrinkKind) ?? "water");
  const [amount, setAmount] = useState(
    String(
      Number(
        (
          (existing?.volumeMl ?? (params.ml ? Number(params.ml) : settings.defaultMl)) / factor
        ).toFixed(2)
      )
    )
  );
  const [caffeine, setCaffeine] = useState(String(existing?.caffeineMg ?? 0));
  const [abv, setAbv] = useState(String(existing?.abv ?? 0));
  const [when, setWhen] = useState(() => localDateTime(existing?.consumedAt ?? Date.now()));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function selectKind(value: DrinkKind) {
    setKind(value);
    const d = defaults[value];
    setAmount(
      String(Number(((value === "water" ? settings.defaultMl : d.ml) / factor).toFixed(2)))
    );
    setCaffeine(String(d.caffeine));
    setAbv(String(d.abv));
  }
  function save() {
    const volumeMl = parseNumber(amount) * factor,
      caffeineMg = parseNumber(caffeine),
      strength = parseNumber(abv),
      consumedAt = parseDateTime(when);
    if (
      ![volumeMl, caffeineMg, strength, consumedAt].every(Number.isFinite) ||
      volumeMl < 1 ||
      volumeMl > 5000 ||
      caffeineMg < 0 ||
      caffeineMg > 2000 ||
      strength < 0 ||
      strength > 100 ||
      consumedAt > Date.now()
    ) {
      setError(t("invalidDrink"));
      return;
    }
    setBusy(true);
    try {
      const values = {
        kind,
        volumeMl,
        caffeineMg,
        abv: strength,
        consumedAt,
        updatedAt: Date.now(),
      };
      if (existing)
        db.update(drinks)
          .set({ ...values, revision: existing.revision + 1 })
          .where(eq(drinks.id, existing.id))
          .run();
      else
        db.insert(drinks)
          .values({ ...values, id: randomUUID() })
          .run();
      router.back();
    } catch {
      setError(t("saveError"));
      setBusy(false);
    }
  }
  function remove() {
    Alert.alert(t("deleteTitle"), t("deleteBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => {
          try {
            db.update(drinks)
              .set({ deleted: true, revision: existing!.revision + 1, updatedAt: Date.now() })
              .where(eq(drinks.id, existing!.id))
              .run();
            router.back();
          } catch {
            setError(t("saveError"));
          }
        },
      },
    ]);
  }
  if (params.id && !existing)
    return (
      <Screen title={t("editDrink")}>
        <Note>{t("notFound")}</Note>
        <Button onPress={() => router.back()}>{t("back")}</Button>
      </Screen>
    );
  return (
    <Screen title={t(existing ? "editDrink" : "addDrink")}>
      <Choices
        value={kind}
        options={kinds.map((value) => ({ value, label: t(value) }))}
        onChange={selectKind}
      />
      <View className="gap-3">
        <Heading>{t("size")}</Heading>
        <View className="flex-row flex-wrap gap-2">
          <Button
            variant="outline"
            onPress={() => setAmount(String(settings.units === "us" ? 8 : 250))}
          >
            {t("cup")} · {volume(settings.units === "us" ? 8 * OZ_ML : 250)}
          </Button>
          {(JSON.parse(settings.presets) as number[]).map((ml, i) => (
            <Button
              key={i}
              variant="outline"
              onPress={() => setAmount(String(Number((ml / factor).toFixed(2))))}
            >
              {volume(ml)}
            </Button>
          ))}
        </View>
      </View>
      <Field
        label={`${t("customSize")} (${settings.units === "us" ? "fl oz" : "mL"})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Field
        label={t("caffeineAmount")}
        value={caffeine}
        onChangeText={setCaffeine}
        keyboardType="decimal-pad"
      />
      <Field label={t("abv")} value={abv} onChangeText={setAbv} keyboardType="decimal-pad" />
      <Note>{t("defaultsNote")}</Note>
      <Field
        label={t("when")}
        value={when}
        onChangeText={setWhen}
        autoCapitalize="none"
        placeholder="YYYY-MM-DD HH:mm"
      />
      <Note>{t("timeHint")}</Note>
      {!!error && <Note error>{error}</Note>}
      <Button isDisabled={busy} onPress={save}>
        {t("save")}
      </Button>
      <Button variant="ghost" onPress={() => router.back()}>
        {t("cancel")}
      </Button>
      {existing && (
        <Button variant="danger-soft" onPress={remove}>
          {t("delete")}
        </Button>
      )}
    </Screen>
  );
}

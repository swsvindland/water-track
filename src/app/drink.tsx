import { useLocalSearchParams, router } from "expo-router";
import { Button, Label, Select } from "heroui-native";
import { DateTimePicker } from "heroui-native-pro";
import {
  CalendarDate,
  fromDate,
  getLocalTimeZone,
  parseDateTime,
  toCalendarDateTime,
  today,
} from "@internationalized/date";
import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { useDatabase } from "@/db/provider";
import { drinks } from "@/db/schema";
import { useApp } from "@/lib/store";
import { defaults, kinds, OZ_ML, parseNumber, type DrinkKind } from "@/lib/metrics";
import { Screen, Field, Note } from "@/components/ui";

import { drinkCatalog, type Favorite } from "@/lib/favorites";

function DrinkDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View className="gap-2">
      <Label>{label}</Label>
      <Select
        value={options.find((option) => option.value === value)}
        onValueChange={(option) => {
          if (option) onChange(option.value);
        }}
      >
        <Select.Trigger accessibilityLabel={label}>
          <Select.Value placeholder={label} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Overlay />
          <Select.Content presentation="popover" width="trigger">
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {options.map((option) => (
                <Select.Item key={option.value} {...option} />
              ))}
            </ScrollView>
          </Select.Content>
        </Select.Portal>
      </Select>
    </View>
  );
}

export default function DrinkEditor() {
  const params = useLocalSearchParams<{ id?: string; ml?: string }>();
  const { rows, settings, locale, t } = useApp();
  const db = useDatabase();
  const existing = rows.find((d) => d.id === params.id && !d.deleted);
  const catalog = drinkCatalog(JSON.parse(settings.favorites) as Favorite[]);
  for (const group of kinds) {
    if (!catalog.some((drink) => drink.kind === group)) {
      catalog.push({ id: `group:${group}`, kind: group, name: "", ...defaults[group] });
    }
  }
  let initialDrink = catalog.find(
    (drink) => drink.kind === (existing?.kind ?? "water") && drink.name === (existing?.name ?? "")
  );
  if (existing && !initialDrink) {
    initialDrink = {
      id: `logged:${existing.id}`,
      kind: existing.kind as DrinkKind,
      name: existing.name ?? "",
      ml: existing.volumeMl,
      caffeine: existing.caffeineMg,
      abv: existing.abv,
    };
    catalog.push(initialDrink);
  }
  initialDrink ??= catalog.find((drink) => drink.kind === "water")!;
  const [drinkId, setDrinkId] = useState(initialDrink.id);
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
  const [name, setName] = useState(existing?.name ?? initialDrink.name);
  const [drinkProfile, setDrinkProfile] = useState(() => ({
    ml: existing?.volumeMl ?? initialDrink.ml,
    caffeine: existing?.caffeineMg ?? initialDrink.caffeine,
    abv: existing?.abv ?? initialDrink.abv,
  }));
  const [when, setWhen] = useState(() => existing?.consumedAt ?? Date.now());
  const [isDateTimeOpen, setDateTimeOpen] = useState(false);
  const timeZone = getLocalTimeZone();
  const dateTime = toCalendarDateTime(fromDate(new Date(when), timeZone));
  const formatDateTime = (value: typeof dateTime) =>
    value.toDate(timeZone).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function selectDrink(drink: Favorite) {
    setDrinkId(drink.id);
    setKind(drink.kind);
    setName(drink.name);
    setAmount(String(Number((drink.ml / factor).toFixed(2))));
    setDrinkProfile(drink);
  }
  function selectKind(value: string) {
    if (value === kind) return;
    const drink = catalog.find((drink) => drink.kind === value);
    if (drink) selectDrink(drink);
  }
  function save() {
    const volumeMl = parseNumber(amount) * factor,
      caffeineMg = (drinkProfile.caffeine * volumeMl) / drinkProfile.ml,
      strength = drinkProfile.abv,
      consumedAt = when;
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
        name: name.trim() || null,
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
      <DrinkDropdown
        label={t("drinkGroup")}
        value={kind}
        options={kinds.map((value) => ({ value, label: t(value) }))}
        onChange={selectKind}
      />
      <DrinkDropdown
        label={t("drinkName")}
        value={drinkId}
        options={catalog
          .filter((drink) => drink.kind === kind)
          .map((drink) => ({
            value: drink.id,
            label: drink.name || t(drink.kind),
          }))}
        onChange={(value) => {
          const drink = catalog.find((drink) => drink.id === value);
          if (drink && drink.id !== drinkId) selectDrink(drink);
        }}
      />
      <Field
        label={`${t("size")} (${settings.units === "us" ? "fl oz" : "mL"})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <DateTimePicker
        isOpen={isDateTimeOpen}
        onOpenChange={setDateTimeOpen}
        value={{ value: dateTime.toString(), label: formatDateTime(dateTime) }}
        onValueChange={(option) => {
          if (option) setWhen(parseDateTime(option.value).toDate(timeZone).getTime());
        }}
        minValue={new CalendarDate(Math.min(1970, dateTime.year), 1, 1)}
        maxValue={today(timeZone)}
        locale={locale}
        formatDateTime={formatDateTime}
      >
        <Label>{t("when")}</Label>
        <DateTimePicker.Select presentation="dialog">
          <DateTimePicker.Trigger accessibilityLabel={t("when")}>
            <DateTimePicker.Value />
            <DateTimePicker.TriggerIndicator />
          </DateTimePicker.Trigger>
          <DateTimePicker.Portal>
            <DateTimePicker.Overlay />
            <DateTimePicker.Content presentation="dialog">
              <DateTimePicker.Wheel />
              <Button variant="ghost" onPress={() => setDateTimeOpen(false)}>
                {t("done")}
              </Button>
            </DateTimePicker.Content>
          </DateTimePicker.Portal>
        </DateTimePicker.Select>
      </DateTimePicker>
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

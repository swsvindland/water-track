import { useLocalSearchParams, router } from "expo-router";
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
import { AccessibilityInfo } from "react-native";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import {
  Button,
  EditorScreen,
  ErrorText,
  Field,
  Icon,
  Select,
  SystemState,
  Text,
  useEditorPortalHost,
  useKitFormat,
  useKitStrings,
  useUndo,
} from "@/vector";
import { parseAmount, useDates, useVolume } from "@/components/format";
import { useDatabase } from "@/db/provider";
import { drinks } from "@/db/schema";
import { useApp } from "@/lib/store";
import { defaults, kinds, OZ_ML, type DrinkKind } from "@/lib/metrics";

import { drinkCatalog, savedFavorites, type Favorite } from "@/lib/favorites";

// The kit Field edge (design-system §5.5) on the Pro date-and-time trigger.
const fieldEdge =
  "min-h-11 rounded-control bg-field px-3 py-2 border border-field-border android:border android:border-field-border ios:focus:outline-focus android:focus:border-focus";

/** Date and time in one wheel, opened above the sheet from the editor's own portal. */
function WhenField({ when, onChange }: { when: number; onChange: (time: number) => void }) {
  const { t } = useApp();
  const format = useKitFormat();
  const dates = useDates();
  const host = useEditorPortalHost();
  const [isOpen, setOpen] = useState(false);
  const timeZone = getLocalTimeZone();
  const dateTime = toCalendarDateTime(fromDate(new Date(when), timeZone));
  const formatDateTime = (value: typeof dateTime) => dates.dateTime(value.toDate(timeZone));
  return (
    <DateTimePicker
      isOpen={isOpen}
      onOpenChange={setOpen}
      value={{ value: dateTime.toString(), label: formatDateTime(dateTime) }}
      onValueChange={(option) => {
        if (option) onChange(parseDateTime(option.value).toDate(timeZone).getTime());
      }}
      minValue={new CalendarDate(Math.min(1970, dateTime.year), 1, 1)}
      maxValue={today(timeZone)}
      locale={format.tag}
      formatDateTime={formatDateTime}
      className="gap-2"
    >
      <Text
        variant="fieldLabel"
        tone="secondary"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {t("when")}
      </Text>
      <DateTimePicker.Select presentation="dialog">
        <DateTimePicker.Trigger className={fieldEdge} accessibilityLabel={t("when")}>
          <DateTimePicker.Value className="text-foreground" />
          <Icon name="date" tone="muted" />
        </DateTimePicker.Trigger>
        <DateTimePicker.Portal hostName={host} disableFullWindowOverlay={host !== undefined}>
          <DateTimePicker.Overlay />
          <DateTimePicker.Content presentation="dialog">
            <DateTimePicker.Wheel />
            <Button variant="ghost" onPress={() => setOpen(false)}>
              {t("done")}
            </Button>
          </DateTimePicker.Content>
        </DateTimePicker.Portal>
      </DateTimePicker.Select>
    </DateTimePicker>
  );
}

export default function DrinkEditor() {
  const params = useLocalSearchParams<{ id?: string; ml?: string }>();
  const { rows, settings, t } = useApp();
  const db = useDatabase();
  const strings = useKitStrings();
  const format = useKitFormat();
  const volume = useVolume();
  const undoAction = useUndo();
  const existing = rows.find((d) => d.id === params.id && !d.deleted);
  const catalog = drinkCatalog(savedFavorites(settings.favorites));
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
  const factor = settings.units === "us" ? OZ_ML : 1;
  // The form as it opened: while it differs, the sheet holds its swipe and Android back.
  const [initial] = useState(() => ({
    drinkId: initialDrink.id,
    amount: format.editable(
      (existing?.volumeMl ?? (params.ml ? Number(params.ml) : settings.defaultMl)) / factor
    ),
    when: existing?.consumedAt ?? Date.now(),
  }));
  const [drinkId, setDrinkId] = useState(initial.drinkId);
  const [kind, setKind] = useState<DrinkKind>((existing?.kind as DrinkKind) ?? "water");
  const [amount, setAmount] = useState(initial.amount);
  const [name, setName] = useState(existing?.name ?? initialDrink.name);
  const [drinkProfile, setDrinkProfile] = useState(() => ({
    ml: existing?.volumeMl ?? initialDrink.ml,
    caffeine: existing?.caffeineMg ?? initialDrink.caffeine,
    abv: existing?.abv ?? initialDrink.abv,
  }));
  const [when, setWhen] = useState(initial.when);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = drinkId !== initial.drinkId || amount !== initial.amount || when !== initial.when;
  function selectDrink(drink: Favorite) {
    setDrinkId(drink.id);
    setKind(drink.kind);
    setName(drink.name);
    setAmount(format.editable(drink.ml / factor));
    setDrinkProfile(drink);
  }
  function selectKind(value: string) {
    if (value === kind) return;
    const drink = catalog.find((drink) => drink.kind === value);
    if (drink) selectDrink(drink);
  }
  function save() {
    const volumeMl = parseAmount(format, amount) * factor,
      caffeineMg = drinkProfile.caffeine * (volumeMl / drinkProfile.ml),
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
  // Undo over confirm (MIGRATION L4): a deleted drink is a tombstone, so Undo restores it and a new revision
  // re-exports it to the health app. This route is outside the tabs' DockProvider, so the kit shows Undo as a
  // toast at the top edge, over whichever screen this sheet closes onto.
  function remove(timestamp: number) {
    // Busy holds the Delete button while the sheet leaves, so a second press cannot delete and go back twice.
    if (!existing || busy) return;
    setBusy(true);
    const { id } = existing;
    try {
      db.update(drinks)
        .set({ deleted: true, revision: existing.revision + 1, updatedAt: timestamp })
        .where(eq(drinks.id, id))
        .run();
    } catch {
      setError(t("saveError"));
      setBusy(false);
      return;
    }
    undoAction.show({
      message: t("deletedDrink", { drink: existing.name || t(existing.kind as DrinkKind) }),
      onUndo: () => restore(id, Date.now()),
    });
    router.back();
  }
  function restore(id: string, timestamp: number) {
    try {
      db.update(drinks)
        .set({ deleted: false, revision: sql`${drinks.revision} + 1`, updatedAt: timestamp })
        .where(eq(drinks.id, id))
        .run();
      // Spoken here rather than as useUndo's undoneMessage, so a failed restore never says it worked.
      AccessibilityInfo.announceForAccessibility(t("drinkRestored"));
    } catch {
      // The sheet is gone by now, so the failure comes back as a toast (shown and announced) whose Undo
      // tries the restore again.
      undoAction.show({ message: t("saveError"), onUndo: () => restore(id, Date.now()) });
    }
  }
  if (params.id && !existing)
    return (
      <EditorScreen title={t("editDrink")} onClose={() => router.back()}>
        <SystemState
          kind="empty"
          message={t("notFound")}
          action={{ label: strings.back, onPress: () => router.back() }}
        />
      </EditorScreen>
    );
  const drinkName = (id: string) => {
    const drink = catalog.find((drink) => drink.id === id);
    return drink ? drink.name || t(drink.kind) : id;
  };
  return (
    <EditorScreen
      title={t(existing ? "editDrink" : "addDrink")}
      onClose={() => router.back()}
      busy={busy}
      dirty={dirty}
      primary={{ label: t("save"), onPress: save }}
      destructive={existing ? { label: t("delete"), onPress: () => remove(Date.now()) } : undefined}
    >
      <Select
        showTitle
        title={t("drinkGroup")}
        values={kinds}
        value={kind}
        label={(value) => t(value)}
        onChange={selectKind}
      />
      <Select
        showTitle
        title={t("drinkName")}
        values={catalog.filter((drink) => drink.kind === kind).map((drink) => drink.id)}
        value={drinkId}
        label={drinkName}
        onChange={(value) => {
          const drink = catalog.find((drink) => drink.id === value);
          if (drink && drink.id !== drinkId) selectDrink(drink);
        }}
      />
      <Field label={t("size")} value={amount} onChange={setAmount} numeric unit={volume.unit} />
      <WhenField when={when} onChange={setWhen} />
      <ErrorText message={error} />
    </EditorScreen>
  );
}

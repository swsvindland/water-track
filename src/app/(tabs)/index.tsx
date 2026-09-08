import { useState } from "react";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { useDatabase } from "@/db/provider";
import { drinks, preferences } from "@/db/schema";
import { favoriteIntake, type Favorite } from "@/lib/favorites";
import {
  SystemButton as Button,
  SystemPanel,
  SystemLabel,
  SystemValue,
  SystemSlider,
} from "@/components/system";
import { router } from "expo-router";
import { AccessibilityInfo, ScrollView, Text, View } from "react-native";
import { Heading, Note } from "@/components/ui";
import { SafeAreaView as NativeSafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";
import { useApp } from "@/lib/store";
import { BacSummary } from "@/components/bac-summary";
import { estimateBac, inDay, totals, OZ_ML } from "@/lib/metrics";

const SafeAreaView = withUniwind(NativeSafeAreaView);

export default function Today() {
  const { rows, settings, now, t, number, volume, locale } = useApp();
  const db = useDatabase();
  const savedMl = settings.quickMl ?? settings.defaultMl;
  const [draftMl, setDraftMl] = useState<number | null>(null);
  const selectedMl = draftMl ?? savedMl;
  const factor = settings.units === "us" ? OZ_ML : 1;
  const step = settings.units === "us" ? 1 : 10;
  const maxSize = Math.min(
    5000 / factor,
    Math.ceil(
      Math.max(
        settings.units === "us" ? 32 : 1000,
        savedMl / factor,
        ...(JSON.parse(settings.presets) as number[]).map((ml) => ml / factor)
      ) / step
    ) * step
  );
  const [height, setHeight] = useState(650);
  const [page, setPage] = useState(0);
  const active = rows.filter((d) => !d.deleted);
  const bac = estimateBac(active, settings.weightKg, settings.bodyWaterRatio, now);
  const showBac = bac !== null && bac > 0;
  const pageSize = height < (showBac ? 630 : 550) ? 2 : 4;
  const favorites = JSON.parse(settings.favorites) as Favorite[];
  const pages = Math.max(1, Math.ceil(favorites.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const [error, setError] = useState("");
  const [last, setLast] = useState<{ id: string; label: string } | null>(null);
  function selectSize(ml: number) {
    if (!Number.isFinite(ml) || ml < 1 || ml > 5000) {
      setError(t("invalidSize"));
      return;
    }
    try {
      db.update(preferences).set({ quickMl: ml }).where(eq(preferences.id, 1)).run();
      setDraftMl(ml);
      setError("");
    } catch {
      setDraftMl(null);
      setError(t("saveError"));
    }
  }
  function log(favorite: Favorite, timestamp: number) {
    let intake;
    try {
      intake = favoriteIntake(favorite, selectedMl);
    } catch {
      setError(t("invalidDrink"));
      return;
    }
    try {
      const id = randomUUID();
      db.insert(drinks)
        .values({ ...intake, id, consumedAt: timestamp, updatedAt: timestamp })
        .run();
      const label = `${t("logged")} · ${volume(selectedMl)} ${favorite.name || t(favorite.kind)}`;
      setLast({ id, label });
      setError("");
      AccessibilityInfo.announceForAccessibility(label);
    } catch {
      setError(t("saveError"));
    }
  }
  function undo() {
    if (!last) return;
    try {
      db.update(drinks)
        .set({ deleted: true, revision: sql`${drinks.revision} + 1`, updatedAt: Date.now() })
        .where(eq(drinks.id, last.id))
        .run();
      setLast(null);
      setError("");
      AccessibilityInfo.announceForAccessibility(t("undone"));
    } catch {
      setError(t("saveError"));
    }
  }
  const today = active.filter((d) => inDay(d.consumedAt, now));
  const total = totals(today);
  const percent = Math.min(100, Math.floor((total.goalFluid / settings.goalMl) * 100));
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]} className="bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      >
        <View className="w-full max-w-xl grow self-center gap-4 p-4">
          <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <Text
              accessibilityRole="header"
              className="text-3xl font-semibold tracking-tight text-foreground"
            >
              {t("today")}
            </Text>
            <SystemLabel>
              {new Date(now).toLocaleDateString(locale, { month: "short", day: "numeric" })}
            </SystemLabel>
          </View>
          <SystemPanel>
            <SystemLabel>{t("goalProgress")}</SystemLabel>
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <SystemValue className="text-4xl font-medium">
                  {volume(total.goalFluid)}
                </SystemValue>
                <Note>
                  {t("goal")}: {volume(settings.goalMl)} · {number(percent)}%
                </Note>
              </View>
              <Button variant="ghost" onPress={() => router.push("/today-details")}>
                {t("details")}
              </Button>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={t("goalProgress")}
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              className="h-1 overflow-hidden rounded-sm bg-surface-secondary"
            >
              <View className="h-full bg-accent" style={{ width: `${percent}%` }} />
            </View>
            <View className="flex-row flex-wrap justify-between gap-4 border-t border-border pt-4">
              <View className="gap-1">
                <SystemLabel>{t("caffeine")}</SystemLabel>
                <SystemValue className="text-base">{number(total.caffeine)} mg</SystemValue>
              </View>
              <View className="gap-1">
                <SystemLabel>{t("pureAlcohol")}</SystemLabel>
                <SystemValue className="text-base">{number(total.alcohol, 1)} g</SystemValue>
              </View>
            </View>
            {showBac && <BacSummary rows={active} now={now} bac={bac} />}
          </SystemPanel>
          <View className="flex-1 gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <Heading>{t("quickAdd")}</Heading>
              <Button variant="ghost" onPress={() => router.push("/favorites")}>
                {t("manage")}
              </Button>
            </View>
            <View className="flex-1 flex-row flex-wrap gap-2">
              {favorites
                .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                .map((favorite) => (
                  <Button
                    key={favorite.id}
                    variant="outline"
                    className="h-auto min-h-24 items-start flex-col gap-2 bg-surface px-4 py-4"
                    style={{ width: "48%", flexGrow: 1 }}
                    accessibilityLabel={`${t("addDrink")}: ${favorite.name || t(favorite.kind)}, ${volume(selectedMl)}`}
                    onPress={() => log(favorite, Date.now())}
                  >
                    <Button.Label numberOfLines={2} className="text-base text-left text-foreground">
                      {favorite.name || t(favorite.kind)}
                    </Button.Label>
                    <SystemValue className="text-sm text-muted">{volume(selectedMl)}</SystemValue>
                  </Button>
                ))}
              {!favorites.length && <Note>{t("favoriteEmpty")}</Note>}
            </View>
            {pages > 1 && (
              <View className="flex-row items-center justify-between">
                <Button
                  variant="ghost"
                  isDisabled={currentPage === 0}
                  onPress={() => setPage(currentPage - 1)}
                >
                  {t("previousPicks")}
                </Button>
                <Note>
                  {number(currentPage + 1)} / {number(pages)}
                </Note>
                <Button
                  variant="ghost"
                  isDisabled={currentPage === pages - 1}
                  onPress={() => setPage(currentPage + 1)}
                >
                  {t("nextPicks")}
                </Button>
              </View>
            )}
          </View>
          <SystemPanel>
            <View className="flex-row items-center justify-between gap-2">
              <Heading>{t("size")}</Heading>
              <SystemValue className="text-xl font-medium">{volume(selectedMl)}</SystemValue>
            </View>
            <SystemSlider
              accessibilityLabel={t("size")}
              accessibilityValue={{ text: volume(selectedMl) }}
              value={selectedMl / factor}
              minValue={Math.min(step, savedMl / factor)}
              maxValue={maxSize}
              step={step}
              onChange={(value) =>
                setDraftMl((typeof value === "number" ? value : value[0]) * factor)
              }
              onChangeEnd={(value) =>
                selectSize((typeof value === "number" ? value : value[0]) * factor)
              }
            />
            <View className="flex-row justify-between">
              <Note>{volume(Math.min(step * factor, savedMl))}</Note>
              <Note>{volume(maxSize * factor)}</Note>
            </View>
          </SystemPanel>
          <View className="min-h-11 flex-row items-center justify-between gap-2">
            <Text
              accessibilityRole={error ? "alert" : undefined}
              numberOfLines={2}
              className={`flex-1 text-sm ${error ? "text-danger" : "text-muted"}`}
            >
              {error || last?.label || t("sizeHint")}
            </Text>
            {last && (
              <Button variant="ghost" onPress={undo}>
                {t("undo")}
              </Button>
            )}
          </View>
          <Button
            variant="outline"
            onPress={() => router.push({ pathname: "/drink", params: { ml: String(selectedMl) } })}
          >
            {t("moreOptions")}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

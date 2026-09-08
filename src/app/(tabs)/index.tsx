import { useState } from "react";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { useDatabase } from "@/db/provider";
import { drinks, preferences } from "@/db/schema";
import { favoriteIntake, type Favorite } from "@/lib/favorites";
import { Button, Card, Slider } from "heroui-native";
import { router } from "expo-router";
import { AccessibilityInfo, Text, View } from "react-native";
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
      <View
        className="w-full max-w-xl flex-1 self-center px-5 py-2"
        style={{ gap: height < 650 ? 4 : 12 }}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      >
        <View className="flex-row items-center justify-between gap-3">
          <Text accessibilityRole="header" className="text-2xl font-semibold text-foreground">
            {t("today")}
          </Text>
          <Text className="text-sm text-muted">
            {new Date(now).toLocaleDateString(locale, { month: "short", day: "numeric" })}
          </Text>
        </View>
        <Card>
          <Card.Body className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1">
                <Text className="text-2xl font-semibold tabular-nums text-foreground">
                  {volume(total.goalFluid)}
                </Text>
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
              className="h-2 overflow-hidden rounded-full bg-surface-secondary"
            >
              <View className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </View>
            <View className="flex-row justify-between gap-2">
              <Text className="text-sm text-muted">
                {t("caffeine")}: {number(total.caffeine)} mg
              </Text>
              <Text className="text-sm text-muted">
                {t("pureAlcohol")}: {number(total.alcohol, 1)} g
              </Text>
            </View>
            {showBac && <BacSummary rows={active} now={now} bac={bac} />}
          </Card.Body>
        </Card>
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
                  variant="secondary"
                  className="h-auto min-h-12 flex-col gap-1 px-3 py-2"
                  style={{ width: "48%", flexGrow: 1, maxHeight: 112 }}
                  accessibilityLabel={`${t("addDrink")}: ${favorite.name || t(favorite.kind)}, ${volume(selectedMl)}`}
                  onPress={() => log(favorite, Date.now())}
                >
                  <Button.Label numberOfLines={2} className="text-lg text-center">
                    {favorite.name || t(favorite.kind)}
                  </Button.Label>
                  <Text className="text-sm text-muted">{volume(selectedMl)}</Text>
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
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-2">
            <Heading>{t("size")}</Heading>
            <Text className="text-xl font-semibold tabular-nums text-foreground">
              {volume(selectedMl)}
            </Text>
          </View>
          <Slider
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
          >
            <Slider.Track className="my-5" hitSlop={16}>
              <Slider.Fill />
              <Slider.Thumb
                accessibilityLabel={t("size")}
                accessibilityValue={{ text: volume(selectedMl) }}
              />
            </Slider.Track>
          </Slider>
          <View className="flex-row justify-between">
            <Note>{volume(Math.min(step * factor, savedMl))}</Note>
            <Note>{volume(maxSize * factor)}</Note>
          </View>
        </View>
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
    </SafeAreaView>
  );
}

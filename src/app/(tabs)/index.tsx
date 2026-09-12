import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor, useToast } from "heroui-native";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { useDatabase } from "@/db/provider";
import { drinks, preferences } from "@/db/schema";
import {
  favoriteIntake,
  favoriteColor,
  favoriteColorClasses,
  homeFavorites,
  type Favorite,
} from "@/lib/favorites";
import {
  SystemButton as Button,
  SystemPanel,
  SystemLabel,
  SystemValue,
  SystemSlider,
} from "@/components/system";
import { router } from "expo-router";
import { AccessibilityInfo, Text, View } from "react-native";
import { Heading, Note } from "@/components/ui";
import { SafeAreaView as NativeSafeAreaView } from "react-native-safe-area-context";
import { SafeAreaView as NativeTabSafeAreaView } from "react-native-screens/experimental";
import { withUniwind } from "uniwind";
import { useApp } from "@/lib/store";
import { HomeCarousel } from "@/components/home-carousel";
import { BacSummary } from "@/components/bac-summary";
import { estimateBac, inDay, totals, OZ_ML } from "@/lib/metrics";

const SafeAreaView = withUniwind(NativeSafeAreaView);

export default function Today() {
  const { rows, bacWeightKg, settings, now, t, number, volume, locale } = useApp();
  const db = useDatabase();
  const { toast } = useToast();
  const foreground = useThemeColor("foreground");
  const savedMl = settings.quickMl ?? settings.defaultMl;
  const [draftMl, setDraftMl] = useState<number | null>(null);
  const selectedMl = draftMl ?? savedMl;
  const factor = settings.units === "us" ? OZ_ML : 1;
  const step = settings.units === "us" ? 1 : 10;
  const maxSize = Math.min(
    5000 / factor,
    Math.ceil(Math.max(settings.units === "us" ? 32 : 1000, savedMl / factor) / step) * step
  );
  const [height, setHeight] = useState(650);
  const compact = height < 700;
  const active = rows.filter((d) => !d.deleted);
  const bac = estimateBac(active, bacWeightKg, settings.bodyWaterRatio, now);
  const showBac = bac !== null && bac > 0;
  const pageSize = 6;
  const favorites = homeFavorites(JSON.parse(settings.favorites) as Favorite[]);
  const pages = Math.max(1, Math.ceil(favorites.length / pageSize));

  const [error, setError] = useState("");
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
      toast.show({
        id,
        variant: "default",
        label,
        duration: 6000,
        actionLabel: t("undo"),
        onActionPress: ({ hide }) => {
          if (undo(id, Date.now())) hide(id);
        },
      });
      setError("");
      AccessibilityInfo.announceForAccessibility(label);
    } catch {
      setError(t("saveError"));
    }
  }
  function undo(id: string, timestamp: number) {
    try {
      db.update(drinks)
        .set({ deleted: true, revision: sql`${drinks.revision} + 1`, updatedAt: timestamp })
        .where(eq(drinks.id, id))
        .run();
      setError("");
      AccessibilityInfo.announceForAccessibility(t("undone"));
      return true;
    } catch {
      setError(t("saveError"));
      return false;
    }
  }
  const today = active.filter((d) => inDay(d.consumedAt, now));
  const total = totals(today);
  const percent = Math.min(100, Math.floor((total.goalFluid / settings.goalMl) * 100));
  return (
    // Native tabs overlay fixed content; reserve their actual bottom inset before measuring.
    <NativeTabSafeAreaView edges={{ bottom: true }} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]} className="bg-background">
        <View
          className="flex-1 min-h-0"
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        >
          <View
            className={`w-full max-w-xl flex-1 min-h-0 self-center px-4 ${compact ? "gap-1 py-2" : "gap-3 py-4"}`}
          >
            <View className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
              <Text
                accessibilityRole="header"
                className="text-3xl font-semibold tracking-tight text-foreground"
              >
                {t("today")}
              </Text>
              <View className="flex-row items-center gap-2">
                <SystemLabel>
                  {new Date(now).toLocaleDateString(locale, { month: "short", day: "numeric" })}
                </SystemLabel>
                <Button
                  isIconOnly
                  variant="ghost"
                  accessibilityLabel={t("moreOptions")}
                  onPress={() =>
                    router.push({ pathname: "/drink", params: { ml: String(selectedMl) } })
                  }
                >
                  <Ionicons name="add-outline" size={24} color={foreground} />
                </Button>
              </View>
            </View>
            <HomeCarousel label={t("goalProgress")}>
              <SystemPanel className={compact ? "gap-2 p-3" : "gap-3"}>
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
                <View className="flex-row flex-wrap justify-between gap-4 border-t border-border pt-2">
                  <View className="gap-1">
                    <SystemLabel>{t("caffeine")}</SystemLabel>
                    <SystemValue className="text-base">{number(total.caffeine)} mg</SystemValue>
                  </View>
                  <View className="gap-1">
                    <SystemLabel>{t("pureAlcohol")}</SystemLabel>
                    <SystemValue className="text-base">{number(total.alcohol, 1)} g</SystemValue>
                  </View>
                </View>
              </SystemPanel>
              {showBac && (
                <SystemPanel className="flex-1 justify-center">
                  <BacSummary rows={active} now={now} bac={bac} />
                </SystemPanel>
              )}
            </HomeCarousel>
            <View className="flex-1 min-h-0 gap-1">
              <HomeCarousel label={t("favorites")} fill>
                {Array.from({ length: pages }, (_, pageIndex) => (
                  <View key={pageIndex} className="flex-1 gap-2">
                    {[0, 1, 2].map((rowIndex) => (
                      <View key={rowIndex} className="flex-1 flex-row gap-2">
                        {favorites
                          .slice(
                            pageIndex * pageSize + rowIndex * 2,
                            pageIndex * pageSize + rowIndex * 2 + 2
                          )
                          .map((favorite) => (
                            <Button
                              key={favorite.id}
                              variant="secondary"
                              className={`h-auto min-h-12 flex-1 flex-row items-center justify-between gap-2 px-3 py-2 ${favoriteColorClasses[favoriteColor(favorite)].background}`}
                              accessibilityLabel={`${t("addDrink")}: ${favorite.name || t(favorite.kind)}, ${volume(selectedMl)}`}
                              onPress={() => log(favorite, Date.now())}
                            >
                              <Button.Label
                                numberOfLines={2}
                                className={`flex-1 text-base font-semibold text-left ${favoriteColorClasses[favoriteColor(favorite)].foreground}`}
                              >
                                {favorite.name || t(favorite.kind)}
                              </Button.Label>
                              <Ionicons
                                name="add-circle-outline"
                                size={22}
                                color={foreground}
                                accessible={false}
                              />
                            </Button>
                          ))}
                        {favorites.length === pageIndex * pageSize + rowIndex * 2 + 1 && (
                          <View className="flex-1" />
                        )}
                      </View>
                    ))}
                    {!favorites.length && <Note>{t("favoriteEmpty")}</Note>}
                  </View>
                ))}
              </HomeCarousel>
            </View>
            <SystemPanel className="gap-0 px-3 py-2">
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
            </SystemPanel>
            {!!error && (
              <View className="min-h-11 flex-row items-center justify-between gap-2">
                <Text
                  accessibilityRole="alert"
                  numberOfLines={2}
                  className="flex-1 text-sm text-danger"
                >
                  {error}
                </Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </NativeTabSafeAreaView>
  );
}

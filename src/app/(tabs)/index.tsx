import { useState } from "react";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { useDatabase } from "@/db/provider";
import { drinks, preferences } from "@/db/schema";
import { favoriteIntake, homeFavorites, savedFavorites, type Favorite } from "@/lib/favorites";
import { router } from "expo-router";
import { AccessibilityInfo, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SafeAreaView as NativeTabSafeAreaView } from "react-native-screens/experimental";
import {
  ErrorText,
  Heading,
  Icon,
  IconButton,
  Label,
  LinkButton,
  Meter,
  Note,
  Panel,
  Screen,
  Slider,
  SystemState,
  Text,
  Value,
  useKit,
  useKitFormat,
  useUndo,
} from "@/vector";
import { useApp } from "@/lib/store";
import { HomeCarousel } from "@/components/home-carousel";
import { BacSummary } from "@/components/bac-summary";
import { kindIcon } from "@/components/drink-list";
import { useVolume } from "@/components/format";
import { useUndoOverlay } from "@/components/undo-overlay";
import { estimateBac, inDay, nearestSize, sizeOptions, totals } from "@/lib/metrics";

/** A neutral quick-log tile: the drink-kind glyph, the name and the size one tap logs. */
function FavoriteTile({
  favorite,
  ml,
  fill,
  compact,
  onPress,
}: {
  favorite: Favorite;
  ml: number;
  fill: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  const { t } = useApp();
  const volume = useVolume();
  const name = favorite.name || t(favorite.kind);
  return (
    <Panel
      inset="none"
      onPress={onPress}
      accessibilityLabel={t("addDrinkLabel", { name, volume: volume.text(ml) })}
      className={fill ? "flex-1" : undefined}
    >
      <View
        className={`flex-row items-center gap-3 px-3 ${fill ? "flex-1" : "min-h-12"} ${compact ? "py-1.5" : "py-2"}`}
      >
        <Icon name={kindIcon[favorite.kind] ?? kindIcon.other} tone="muted" />
        <View className="flex-1">
          {/* A filled grid gives every tile a fixed slot, so a long name shrinks to 80% (as the kit's fit
              does) before it stops at two lines. The tile's label always carries it whole. */}
          <Text
            variant="bodyStrong"
            numberOfLines={fill ? 2 : undefined}
            adjustsFontSizeToFit={fill}
            minimumFontScale={fill ? 0.8 : undefined}
          >
            {name}
          </Text>
          {/* Short screens keep the name: the size is in the panel below and in the label. */}
          {compact ? null : <Value {...volume.parts(ml)} size="xs" tone="muted" />}
        </View>
      </View>
    </Panel>
  );
}

export default function Today() {
  const { rows, bacWeightKg, settings, now, t } = useApp();
  const db = useDatabase();
  const format = useKitFormat();
  const { largeType } = useKit();
  const undoAction = useUndo();
  const undoOverlay = useUndoOverlay();
  const insets = useSafeAreaInsets();
  const volume = useVolume();
  const savedMl = settings.quickMl ?? settings.defaultMl;
  const [draftMl, setDraftMl] = useState<number | null>(null);
  const selectedMl = draftMl ?? savedMl;
  const sizes = sizeOptions(settings.units, savedMl);
  const [height, setHeight] = useState(650);
  // At accessibility text sizes the screen scrolls and every tile takes its own height instead.
  const fill = !largeType;
  // The filled grid keeps its geometry: its Undo sits over the column's bottom edge instead of docking below
  // it. A scrolling column lets the kit dock it above the tab bar.
  const showUndo = fill ? undoOverlay.show : undoAction.show;
  // The measured view runs under the iOS tab bar (the kit Screen clears it); Android reserves it outside.
  const usable = height - insets.top - (Platform.OS === "ios" ? insets.bottom : 0);
  const compact = fill && usable < 700;
  const [logged, setLogged] = useState(0);
  const active = rows.filter((d) => !d.deleted);
  const bac = estimateBac(active, bacWeightKg, settings.bodyWaterRatio, now);
  const showBac = bac !== null && bac > 0;
  const pageSize = 6;
  const favorites = homeFavorites(savedFavorites(settings.favorites));
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
      setLogged((count) => count + 1);
      setError("");
      // Undo replaces a confirm: announced, and held while a screen reader runs.
      showUndo({
        message: t("loggedDrink", {
          drink: favorite.name || t(favorite.kind),
          amount: volume.text(selectedMl),
        }),
        onUndo: () => undo(id, Date.now()),
      });
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
      // Spoken here rather than as useUndo's undoneMessage, so a failed undo never says it worked.
      AccessibilityInfo.announceForAccessibility(t("undone"));
    } catch {
      setError(t("saveError"));
    }
  }
  const today = active.filter((d) => inDay(d.consumedAt, now));
  const total = totals(today);
  const percent = Math.min(100, Math.floor((total.goalFluid / settings.goalMl) * 100));
  return (
    // This tab opts out of automatic content insets (the carousels' horizontal ScrollViews must not take
    // them). On iOS the kit Screen clears the floating tab bar itself, from its bottom safe area; Android's
    // tab bar sits outside the screen, and its bottom inset is reserved here.
    <NativeTabSafeAreaView edges={{ bottom: Platform.OS === "android" }} style={{ flex: 1 }}>
      <View className="flex-1" onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        <Screen
          title={t("today")}
          eyebrow={format.monthDay(now)}
          scroll={largeType}
          compact={compact}
          action={
            <IconButton
              icon="add"
              tone="tint"
              accessibilityLabel={t("moreOptions")}
              onPress={() =>
                router.push({ pathname: "/drink", params: { ml: String(selectedMl) } })
              }
            />
          }
        >
          <HomeCarousel label={t("goalProgress")}>
            <Panel>
              <Panel.Body>
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 gap-1">
                    <Value
                      {...volume.parts(total.goalFluid)}
                      size={compact ? "l" : "xl"}
                      pulseKey={logged}
                    />
                    <View className="flex-row flex-wrap items-baseline gap-x-4 gap-y-1">
                      <View className="flex-row items-baseline gap-2">
                        <Note>{t("goal")}</Note>
                        <Value {...volume.parts(settings.goalMl)} size="xs" tone="muted" />
                      </View>
                      <Value value={format.percent(percent / 100)} size="xs" tone="muted" />
                    </View>
                  </View>
                  <LinkButton icon="forward" onPress={() => router.push("/today-details")}>
                    {t("details")}
                  </LinkButton>
                </View>
                {/* Drinking past the goal is fine: the fill stays full in signal, never a warning. */}
                <Meter
                  tone="signal"
                  value={total.goalFluid}
                  max={settings.goalMl}
                  over="none"
                  accessibilityLabel={t("goalProgress")}
                  valueText={format.percent(percent / 100)}
                />
                <View className="flex-row flex-wrap justify-between gap-x-4 gap-y-1 border-t border-separator pt-3">
                  <View className="flex-row items-baseline gap-2">
                    <Label>{t("caffeine")}</Label>
                    <Value {...format.unitParts(total.caffeine, "milligram")} />
                  </View>
                  <View className="flex-row items-baseline gap-2">
                    <Label>{t("pureAlcohol")}</Label>
                    <Value {...format.unitParts(total.alcohol, "gram", 1)} />
                  </View>
                </View>
              </Panel.Body>
            </Panel>
            {showBac && (
              <Panel className="flex-1 justify-center">
                <Panel.Body>
                  <BacSummary rows={active} now={now} bac={bac} />
                </Panel.Body>
              </Panel>
            )}
          </HomeCarousel>
          <View className={fill ? "min-h-0 flex-1" : undefined}>
            <HomeCarousel label={t("favorites")} fill={fill}>
              {Array.from({ length: pages }, (_, pageIndex) => (
                <View key={pageIndex} className={fill ? "flex-1 gap-2" : "gap-2"}>
                  {[0, 1, 2]
                    // A filled page keeps the 3 × 2 grid; a scrolling or empty one drops empty rows.
                    .filter(
                      (rowIndex) =>
                        (fill && favorites.length > 0) ||
                        favorites[pageIndex * pageSize + rowIndex * 2]
                    )
                    .map((rowIndex) => (
                      <View
                        key={rowIndex}
                        className={fill ? "flex-1 flex-row gap-2" : "flex-row gap-2"}
                      >
                        {[0, 1].map((column) => {
                          const favorite = favorites[pageIndex * pageSize + rowIndex * 2 + column];
                          // Yoga floors a flex basis at its padding, so size padding-free cells
                          // rather than tiles, or a lone tile outgrows its empty neighbor.
                          return (
                            <View key={column} className="flex-1">
                              {favorite && (
                                <FavoriteTile
                                  favorite={favorite}
                                  ml={selectedMl}
                                  fill={fill}
                                  compact={compact}
                                  onPress={() => log(favorite, Date.now())}
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  {!favorites.length && (
                    <SystemState
                      kind="empty"
                      message={t("favoriteEmpty")}
                      action={{ label: t("manage"), onPress: () => router.push("/favorites") }}
                    />
                  )}
                </View>
              ))}
            </HomeCarousel>
          </View>
          <Panel>
            <Panel.Body>
              <View className="flex-row items-center justify-between gap-2">
                <Heading level={3} className="shrink">
                  {t("size")}
                </Heading>
                <Value {...volume.parts(selectedMl)} size="m" />
              </View>
              <Slider
                accessibilityLabel={t("size")}
                valueText={volume.text(selectedMl)}
                value={nearestSize(sizes, selectedMl)}
                min={0}
                max={sizes.length - 1}
                step={1}
                onChange={(index) => setDraftMl(sizes[Math.round(index)])}
                onChangeEnd={(index) => selectSize(sizes[Math.round(index)])}
              />
            </Panel.Body>
          </Panel>
          <ErrorText message={error} />
        </Screen>
        {undoOverlay.strip ? (
          // Over the static column's bottom padding, just above the iOS tab bar (Android's sits outside).
          <View
            className="absolute inset-x-0"
            style={{ bottom: Platform.OS === "ios" ? insets.bottom : 0 }}
          >
            {undoOverlay.strip}
          </View>
        ) : null}
      </View>
    </NativeTabSafeAreaView>
  );
}

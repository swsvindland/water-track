import { Platform, Pressable, View } from "react-native";
import { Icon, Text, Value } from "@/vector";
import { kindIcon } from "@/components/drink-list";
import { useVolume } from "@/components/format";
import { favoriteColor, favoriteColorClasses, type Favorite } from "@/lib/favorites";
import { useApp } from "@/lib/store";

/**
 * A quick-log tile in the favourite's hue (design system §2.5): the tint fills it and the name takes its ink, so
 * a drink is found by colour at a glance; the glyph and the size one tap logs stay muted. Without `onPress` it is
 * the editor's preview, hidden from screen readers (the colour Select already says the hue).
 */
export function FavoriteTile({
  favorite,
  ml,
  fill = false,
  compact = false,
  onPress,
}: {
  favorite: Pick<Favorite, "kind" | "name" | "color">;
  ml: number;
  fill?: boolean;
  compact?: boolean;
  onPress?: () => void;
}) {
  const { t } = useApp();
  const volume = useVolume();
  const name = favorite.name || t(favorite.kind);
  const hue = favoriteColorClasses[favoriteColor(favorite)];
  const tile = `overflow-hidden rounded-panel border border-border ${hue.background} ${fill ? "flex-1" : ""}`;
  const content = (
    <View
      className={`flex-row items-center gap-3 px-3 ${fill ? "flex-1" : "min-h-12"} ${compact ? "py-1.5" : "py-2"}`}
    >
      <Icon name={kindIcon[favorite.kind] ?? kindIcon.other} tone="muted" />
      <View className="flex-1">
        {/* A filled grid gives every tile a fixed slot, so a long name shrinks to 80% (as the kit's fit
            does) before it stops at two lines. The tile's label always carries it whole. */}
        <Text
          variant="bodyStrong"
          className={hue.foreground}
          numberOfLines={fill ? 2 : undefined}
          // Android can shrink fitted text below the readable minimum in a compact tile.
          adjustsFontSizeToFit={fill && Platform.OS === "ios"}
          minimumFontScale={fill ? 0.8 : undefined}
        >
          {name}
        </Text>
        {/* Short screens keep the name: the size is in the panel below and in the label. */}
        {compact ? null : <Value {...volume.parts(ml)} size="xs" tone="muted" />}
      </View>
    </View>
  );
  if (!onPress) {
    return (
      <View
        className={tile}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("addDrinkLabel", { name, volume: volume.text(ml) })}
      onPress={onPress}
      // Press is an opacity change only (§5.3): a grey press fill would hide the hue.
      className={`${tile} active:opacity-60`}
    >
      {content}
    </Pressable>
  );
}

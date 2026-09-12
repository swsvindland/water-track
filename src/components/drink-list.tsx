import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { PressableFeedback, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";
import type { ComponentProps } from "react";
import type { Drink } from "@/db/schema";
import { useApp } from "@/lib/store";
import { alcoholGrams, type DrinkKind } from "@/lib/metrics";
import { Note } from "./ui";
export const icons: Record<DrinkKind, ComponentProps<typeof Ionicons>["name"]> = {
  other: "beaker-outline",
  water: "water-outline",
  juice: "nutrition-outline",
  milk: "cafe-outline",
  coffee: "cafe-outline",
  tea: "leaf-outline",
  preworkout: "barbell-outline",
  energy: "flash-outline",
  alcohol: "wine-outline",
};
export function DrinkList({ rows }: { rows: Drink[] }) {
  const { t, volume, number, locale } = useApp();
  const accent = useThemeColor("accent");
  if (!rows.length)
    return (
      <View className="gap-2 py-6">
        <Text className="text-lg font-medium text-foreground">{t("empty")}</Text>
        <Note>{t("emptyBody")}</Note>
      </View>
    );
  return (
    <View>
      {rows.map((d) => (
        <PressableFeedback
          key={d.id}
          accessibilityRole="button"
          accessibilityLabel={`${t("editDrink")}: ${d.name || t(d.kind as DrinkKind)}, ${volume(d.volumeMl)}`}
          onPress={() => router.push({ pathname: "/drink", params: { id: d.id } })}
          className="flex-row items-center gap-4 overflow-hidden rounded-md px-2 py-4"
        >
          <PressableFeedback.Highlight
            animation={{
              backgroundColor: { value: accent },
              opacity: { value: [0, 0.16] },
            }}
          />
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-secondary">
            <Ionicons name={icons[d.kind as DrinkKind]} size={22} color={accent} />
          </View>
          <View className="flex-1 gap-1">
            <Text className="text-base font-medium text-foreground">
              {d.name || t(d.kind as DrinkKind)}
            </Text>
            <Note>
              {new Date(d.consumedAt).toLocaleTimeString(locale, {
                hour: "numeric",
                minute: "2-digit",
              })}
              {d.caffeineMg > 0 ? ` · ${number(d.caffeineMg)} mg` : ""}
              {d.abv > 0 ? ` · ${number(alcoholGrams(d), 1)} g` : ""}
            </Note>
          </View>
          <Text className="text-base font-medium tabular-nums text-foreground">
            {volume(d.volumeMl)}
          </Text>
        </PressableFeedback>
      ))}
    </View>
  );
}

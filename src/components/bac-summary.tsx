import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useThemeColor } from "heroui-native";
import type { Drink } from "@/db/schema";
import { bacHistory } from "@/lib/metrics";
import { useApp } from "@/lib/store";

export function BacSummary({ rows, now, bac }: { rows: Drink[]; now: number; bac: number }) {
  const { settings, locale, t } = useApp();
  const accent = useThemeColor("accent");
  const points = bacHistory(rows, settings.weightKg, settings.bodyWaterRatio, now);
  const peak = Math.max(0.001, ...points.map((point) => point.value));
  const coordinates = points.map((point) => ({
    x: 3 + ((point.time - (now - 6 * 3600000)) / (6 * 3600000)) * 174,
    y: 37 - (point.value / peak) * 34,
  }));
  const path = coordinates
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const end = coordinates[coordinates.length - 1];
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const label = bac < 0.001 ? `< ${format.format(0.001)}%` : `${format.format(bac)}%`;
  return (
    <View className="flex-row items-center gap-4 pt-1">
      <View className="flex-1">
        <Text className="text-sm text-muted">{t("bac")}</Text>
        <Text className="text-xl font-semibold tabular-nums text-foreground">{label}</Text>
      </View>
      <View
        className="flex-1"
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${t("bacTrend")}. ${t("now")}: ${label}`}
      >
        <Svg
          width="100%"
          height={40}
          viewBox="0 0 180 40"
          preserveAspectRatio="none"
          accessible={false}
        >
          <Path d={`${path} L177,40 L3,40 Z`} fill={accent} fillOpacity={0.1} />
          <Path d={path} fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" />
          {end && <Circle cx={end.x} cy={end.y} r={3} fill={accent} />}
        </Svg>
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted">{t("sixHoursAgo")}</Text>
          <Text className="text-xs text-muted">{t("now")}</Text>
        </View>
      </View>
    </View>
  );
}

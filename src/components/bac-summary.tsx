import { View } from "react-native";
import { Label, Sparkline, Text, Value, useKitFormat } from "@/vector";
import type { Drink } from "@/db/schema";
import { bacHistory } from "@/lib/metrics";
import { useApp } from "@/lib/store";

const WINDOW_MS = 6 * 3600000;
/** Local wall-clock time as an ISO date-time without a zone, which the kit charts read as local. */
const localIso = (time: number) =>
  new Date(time - new Date(time).getTimezoneOffset() * 60000).toISOString().slice(0, 19);

export function BacSummary({ rows, now, bac }: { rows: Drink[]; now: number; bac: number }) {
  const { settings, bacWeightKg, t } = useApp();
  const format = useKitFormat();
  // BAC in percent with three fixed decimals ("0.050%").
  const percent = (value: number) => format.percent(value / 100, 3, { fixed: true });
  const points = bacHistory(rows, bacWeightKg, settings.bodyWaterRatio, now).map((point) => ({
    day: localIso(point.time),
    value: point.value,
  }));
  const value = bac < 0.001 ? t("bacBelow", { value: percent(0.001) }) : percent(bac);
  return (
    <View className="flex-row items-center gap-4">
      <View className="flex-1 gap-1">
        <Label>{t("bac")}</Label>
        <Value value={value} size="m" />
      </View>
      {/* The readout beside it is the value; the trend is one image for screen readers. */}
      <View
        className="flex-1 gap-1"
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("bacTrend")}
      >
        <Sparkline
          points={points}
          height={40}
          zero
          minSpan={0.001}
          from={localIso(now - WINDOW_MS)}
          to={localIso(now)}
        />
        <View className="flex-row justify-between gap-2">
          <Text variant="caption" tone="muted">
            {t("sixHoursAgo")}
          </Text>
          <Text variant="caption" tone="muted">
            {t("now")}
          </Text>
        </View>
      </View>
    </View>
  );
}

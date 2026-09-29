import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Choices,
  Heading,
  Label,
  Meter,
  Panel,
  Screen,
  SystemState,
  Text,
  Value,
  useKitFormat,
} from "@/vector";
import { DrinkList } from "@/components/drink-list";
import { useDates, useVolume } from "@/components/format";
import { useApp } from "@/lib/store";
import { inDay, shiftDays, startOfDay, totals } from "@/lib/metrics";

const periods = ["day", "week", "month"] as const;

export default function History() {
  const { rows, now, t } = useApp();
  const format = useKitFormat();
  const volume = useVolume();
  const dates = useDates();
  const [mode, setMode] = useState<(typeof periods)[number]>("week");
  const [offset, setOffset] = useState(0);
  const date = new Date(startOfDay(now));
  if (mode === "week") date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset * 7);
  if (mode === "day") date.setDate(date.getDate() + offset);
  if (mode === "month") {
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
  }
  const start = +date;
  const end =
    mode === "month"
      ? +new Date(date.getFullYear(), date.getMonth() + 1, 1)
      : shiftDays(start, mode === "week" ? 7 : 1);
  const selected = rows.filter((d) => !d.deleted && d.consumedAt >= start && d.consumedAt < end);
  const days: number[] = [];
  for (let d = start; d < end && d <= now; d = shiftDays(d, 1)) days.push(d);
  const daily = days.map((d) => ({
    date: d,
    rows: selected.filter((row) => inDay(row.consumedAt, d)),
  }));
  const sum = totals(selected);
  const max = Math.max(1, ...daily.map((d) => totals(d.rows).fluid));
  const period =
    mode === "month"
      ? format.monthYear(date)
      : mode === "day"
        ? format.date(date)
        : format.dateRange(date, shiftDays(end, -1), { year: true });
  return (
    <Screen title={t("history")}>
      <Choices
        values={periods}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setOffset(0);
        }}
        label={(value) => t(value)}
        accessibilityLabel={t("period")}
      />
      <View className="gap-3">
        <Heading level={2}>{period}</Heading>
        <View className="flex-row flex-wrap justify-between gap-2">
          <Button variant="ghost" icon="back" onPress={() => setOffset(offset - 1)}>
            {t("previous")}
          </Button>
          <Button
            variant="ghost"
            icon="forward"
            iconPosition="end"
            disabled={offset >= 0}
            onPress={() => setOffset(offset + 1)}
          >
            {t("next")}
          </Button>
        </View>
      </View>
      <Panel>
        <Panel.Header eyebrow={t("periodTotal")} />
        <Panel.Body className="gap-4">
          <Value {...volume.parts(sum.fluid)} size="l" />
          <View className="flex-row flex-wrap gap-x-6 gap-y-3">
            <View className="gap-1">
              <Label>{t("dailyAverage")}</Label>
              <Value {...volume.parts(sum.fluid / Math.max(1, days.length))} />
            </View>
            <View className="gap-1">
              <Label>{t("caffeine")}</Label>
              <Value {...format.unitParts(sum.caffeine, "milligram")} />
            </View>
            <View className="gap-1">
              <Label>{t("pureAlcohol")}</Label>
              <Value {...format.unitParts(sum.alcohol, "gram", 1)} />
            </View>
          </View>
        </Panel.Body>
      </Panel>
      <View className="gap-3">
        <Heading level={3}>{t("trend")}</Heading>
        {daily.map((d) => {
          const fluid = totals(d.rows).fluid;
          const day = format.monthDay(d.date);
          return (
            // The meter is the row's one screen-reader stop: the day, then its total.
            <View key={d.date} className="min-h-6 flex-row items-center gap-3">
              <View
                className="min-w-16"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text variant="readoutXS" tone="muted">
                  {day}
                </Text>
              </View>
              <View className="flex-1">
                <Meter
                  value={fluid}
                  max={max}
                  accessibilityLabel={day}
                  valueText={volume.text(fluid)}
                />
              </View>
              <View
                className="min-w-24 items-end"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Value {...volume.parts(fluid)} size="xs" />
              </View>
            </View>
          );
        })}
      </View>
      {!selected.length && <SystemState kind="empty" message={t("noHistory")} />}
      {[...daily]
        .reverse()
        .filter((d) => d.rows.length)
        .map((d) => (
          <View key={d.date} className="gap-2">
            <Heading level={3}>{dates.weekdayDay(d.date)}</Heading>
            <DrinkList rows={d.rows} />
          </View>
        ))}
    </Screen>
  );
}

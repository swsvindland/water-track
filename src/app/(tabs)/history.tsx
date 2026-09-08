import { useState } from "react";
import { Button, Card } from "heroui-native";
import { Text, View } from "react-native";
import { Screen, Choices, Heading, Note } from "@/components/ui";
import { DrinkList } from "@/components/drink-list";
import { useApp } from "@/lib/store";
import { inDay, shiftDays, startOfDay, totals } from "@/lib/metrics";

export default function History() {
  const { rows, now, t, volume, number, locale } = useApp();
  const [mode, setMode] = useState<"day" | "week" | "month">("week");
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
  const dateLabel = (d: number) =>
    new Date(d).toLocaleDateString(locale, { month: "short", day: "numeric" });
  return (
    <Screen title={t("history")}>
      <Choices
        value={mode}
        onChange={(value) => {
          setMode(value);
          setOffset(0);
        }}
        options={(["day", "week", "month"] as const).map((value) => ({ value, label: t(value) }))}
      />
      <View className="gap-3">
        <Text className="text-xl font-medium text-foreground">
          {mode === "month"
            ? date.toLocaleDateString(locale, { month: "long", year: "numeric" })
            : `${dateLabel(start)}${mode === "week" ? ` – ${dateLabel(shiftDays(end, -1))}` : ""} · ${date.getFullYear()}`}
        </Text>
        <View className="flex-row justify-between">
          <Button variant="ghost" onPress={() => setOffset(offset - 1)}>
            {t("previous")}
          </Button>
          <Button variant="ghost" isDisabled={offset >= 0} onPress={() => setOffset(offset + 1)}>
            {t("next")}
          </Button>
        </View>
      </View>
      <Card>
        <Card.Body className="gap-4">
          <Card.Title>{t("periodTotal")}</Card.Title>
          <Text className="text-4xl font-semibold tabular-nums text-foreground">
            {volume(sum.fluid)}
          </Text>
          <Note>
            {t("dailyAverage")}: {volume(sum.fluid / Math.max(1, days.length))}
          </Note>
          <View className="flex-row flex-wrap gap-6">
            <View>
              <Note>{t("caffeine")}</Note>
              <Text className="text-xl font-medium text-foreground">{number(sum.caffeine)} mg</Text>
            </View>
            <View>
              <Note>{t("pureAlcohol")}</Note>
              <Text className="text-xl font-medium text-foreground">
                {number(sum.alcohol, 1)} g
              </Text>
            </View>
          </View>
        </Card.Body>
      </Card>
      <View className="gap-4">
        <Heading>{t("trend")}</Heading>
        {daily.map((d) => (
          <View
            key={d.date}
            accessibilityLabel={`${dateLabel(d.date)}: ${volume(totals(d.rows).fluid)}`}
            className="flex-row items-center gap-3"
          >
            <Text className="w-16 text-sm text-muted">{dateLabel(d.date)}</Text>
            <View className="h-3 flex-1 overflow-hidden rounded-full bg-surface-secondary">
              <View
                className="h-full rounded-full bg-accent"
                style={{ width: `${(totals(d.rows).fluid / max) * 100}%` }}
              />
            </View>
            <Text className="w-24 text-right text-sm tabular-nums text-foreground">
              {volume(totals(d.rows).fluid)}
            </Text>
          </View>
        ))}
      </View>
      {!selected.length && <Note>{t("noHistory")}</Note>}
      {[...daily]
        .reverse()
        .filter((d) => d.rows.length)
        .map((d) => (
          <View key={d.date}>
            <Heading>
              {new Date(d.date).toLocaleDateString(locale, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Heading>
            <DrinkList rows={d.rows} />
          </View>
        ))}
    </Screen>
  );
}

import { Button, Card } from "heroui-native";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Screen, Heading, Note } from "@/components/ui";
import { DrinkList } from "@/components/drink-list";
import { useApp } from "@/lib/store";
import { estimateBac, inDay, totals } from "@/lib/metrics";

export default function Today() {
  const { rows, settings, now, t, number, volume, locale } = useApp();
  const active = rows.filter((d) => !d.deleted);
  const today = active.filter((d) => inDay(d.consumedAt, now));
  const total = totals(today);
  const percent = Math.min(100, Math.floor((total.goalFluid / settings.goalMl) * 100));
  const bac = estimateBac(active, settings.weightKg, settings.bodyWaterRatio, now);
  return (
    <Screen
      title={t("today")}
      subtitle={new Date(now).toLocaleDateString(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
    >
      <Card>
        <Card.Body className="gap-4">
          <Card.Title>{t("goalProgress")}</Card.Title>
          <View className="flex-row items-end justify-between gap-4">
            <Text className="text-5xl font-semibold tabular-nums text-foreground">
              {number(percent)}%
            </Text>
            <Text className="pb-1 text-muted">
              {volume(total.goalFluid)} / {volume(settings.goalMl)}
            </Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t("goalProgress")}
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            className="h-3 overflow-hidden rounded-full bg-surface-secondary"
          >
            <View className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
          </View>
          <Note>
            {percent >= 100
              ? t("goalReached")
              : `${volume(Math.max(0, settings.goalMl - total.goalFluid))} ${t("remaining")}`}
          </Note>
        </Card.Body>
      </Card>
      <Button onPress={() => router.push("/drink")}>{t("addDrink")}</Button>
      <View className="flex-row flex-wrap gap-x-8 gap-y-4">
        {[
          [t("fluids"), volume(total.fluid)],
          [t("caffeine"), `${number(total.caffeine)} mg`],
          [t("pureAlcohol"), `${number(total.alcohol, 1)} g`],
        ].map(([label, value]) => (
          <View key={label} className="gap-1">
            <Note>{label}</Note>
            <Text className="text-2xl font-semibold tabular-nums text-foreground">{value}</Text>
          </View>
        ))}
      </View>
      <View className="gap-3">
        <Heading>{t("quickAdd")}</Heading>
        <View className="flex-row flex-wrap gap-2">
          {(JSON.parse(settings.presets) as number[]).map((ml, i) => (
            <Button
              key={i}
              variant="outline"
              onPress={() =>
                router.push({ pathname: "/drink", params: { ml: String(ml), kind: "water" } })
              }
            >
              {volume(ml)}
            </Button>
          ))}
        </View>
      </View>
      <View>
        <Heading>{t("drinks")}</Heading>
        <DrinkList rows={today} />
        {today.length > 0 && <Note>{t("editHint")}</Note>}
      </View>
      <Card>
        <Card.Body className="gap-3">
          <Card.Title>{t("bac")}</Card.Title>
          {bac === null ? (
            <Note>{t("bacSetup")}</Note>
          ) : (
            <Text className="text-3xl font-semibold tabular-nums text-foreground">
              {new Intl.NumberFormat(locale, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              }).format(bac)}
              %
            </Text>
          )}
          <Note>{t("bacWarning")}</Note>
        </Card.Body>
      </Card>
      <Note>{t("goalNote")}</Note>
    </Screen>
  );
}

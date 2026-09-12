import { Button, Card } from "heroui-native";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Screen, Heading, Note } from "@/components/ui";
import { DrinkList } from "@/components/drink-list";
import { useApp } from "@/lib/store";
import { estimateBac, inDay, totals } from "@/lib/metrics";

export default function TodayDetails() {
  const { rows, bacWeightKg, settings, now, t, volume, locale } = useApp();
  const active = rows.filter((drink) => !drink.deleted);
  const today = active.filter((drink) => inDay(drink.consumedAt, now));
  const bac = estimateBac(active, bacWeightKg, settings.bodyWaterRatio, now);
  return (
    <Screen title={t("today")} subtitle={t("details")}>
      <Button variant="ghost" onPress={() => router.back()}>
        {t("back")}
      </Button>
      <View className="gap-2">
        <Heading>
          {t("fluids")}: {volume(totals(today).fluid)}
        </Heading>
        <Note>{t("goalNote")}</Note>
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
    </Screen>
  );
}

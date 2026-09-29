import { router } from "expo-router";
import { View } from "react-native";
import {
  Heading,
  LinkButton,
  Note,
  Panel,
  Screen,
  Value,
  useKitFormat,
  useKitStrings,
} from "@/vector";
import { DrinkList } from "@/components/drink-list";
import { useVolume } from "@/components/format";
import { useApp } from "@/lib/store";
import { estimateBac, inDay, totals } from "@/lib/metrics";

export default function TodayDetails() {
  const { rows, bacWeightKg, settings, now, t } = useApp();
  const strings = useKitStrings();
  const format = useKitFormat();
  const volume = useVolume();
  const active = rows.filter((drink) => !drink.deleted);
  const today = active.filter((drink) => inDay(drink.consumedAt, now));
  const bac = estimateBac(active, bacWeightKg, settings.bodyWaterRatio, now);
  return (
    // A read-only sheet on its existing modal route: the header's trailing action closes it.
    <Screen
      title={t("today")}
      subtitle={t("details")}
      action={<LinkButton onPress={() => router.back()}>{strings.done}</LinkButton>}
    >
      <Panel>
        <Panel.Header eyebrow={t("fluids")} />
        <Panel.Body>
          <Value {...volume.parts(totals(today).fluid)} size="l" />
          <Note>{t("goalNote")}</Note>
        </Panel.Body>
      </Panel>
      <View className="gap-2">
        <Heading level={3}>{t("drinks")}</Heading>
        <DrinkList rows={today} />
        {today.length > 0 && <Note>{t("editHint")}</Note>}
      </View>
      <Panel>
        <Panel.Header eyebrow={t("bac")} />
        <Panel.Body>
          {bac === null ? (
            <Note>{t("bacSetup")}</Note>
          ) : (
            <Value value={format.percent(bac / 100, 3, { fixed: true })} size="l" />
          )}
          <Note>{t("bacWarning")}</Note>
        </Panel.Body>
      </Panel>
    </Screen>
  );
}

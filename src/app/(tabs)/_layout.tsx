import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useThemeColor } from "heroui-native";
import { useApp } from "@/lib/store";
import type { JSX } from "react";

export default function TabsLayout(): JSX.Element {
  const { t } = useApp();
  const [activeTint, background] = useThemeColor(["link", "background"]);
  return (
    <NativeTabs
      tintColor={activeTint}
      backgroundColor={background}
      labelVisibilityMode="labeled"
      backBehavior="initialRoute"
    >
      <NativeTabs.Trigger
        name="index"
        contentStyle={{ backgroundColor: background }}
        disableAutomaticContentInsets
      >
        <NativeTabs.Trigger.Label>{t("today")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "drop", selected: "drop.fill" }} md="water_drop" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history" contentStyle={{ backgroundColor: background }}>
        <NativeTabs.Trigger.Label>{t("history")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="bar_chart"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" contentStyle={{ backgroundColor: background }}>
        <NativeTabs.Trigger.Label>{t("settings")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="slider.horizontal.3" md="tune" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

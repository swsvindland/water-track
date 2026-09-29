import { NativeTabs } from "expo-router/unstable-native-tabs";
import { DockProvider, tabOptions, useKit } from "@/vector";
import { useApp } from "@/lib/store";
import type { JSX } from "react";

export default function TabsLayout(): JSX.Element {
  const { t } = useApp();
  const { scheme } = useKit();
  // No bar or content colours on iOS, so Liquid Glass renders the tab bar. The DockProvider holds the kit's
  // docked Undo to the tab roots, where it clears the tab bar on both platforms. On a modal route the kit Screen
  // gives the dock no bottom inset on Android, so edge to edge it would sit under the navigation bar; there
  // useUndo falls back to the kit's top-edge toast instead.
  return (
    <DockProvider>
      <NativeTabs {...tabOptions(scheme)}>
        <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Label>{t("today")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "drop", selected: "drop.fill" }}
            md="water_drop"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="history">
          <NativeTabs.Trigger.Label>{t("history")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
            md="bar_chart"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>{t("settings")}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "gearshape", selected: "gearshape.fill" }}
            md="settings"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </DockProvider>
  );
}

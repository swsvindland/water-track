import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";
import { useApp } from "@/lib/store";
import { Tabs } from "expo-router";
import type { ComponentProps, JSX } from "react";
import type { ColorValue } from "react-native";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color }: { name: IoniconName; color: ColorValue }): JSX.Element {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function TabsLayout(): JSX.Element {
  const { t } = useApp();
  const [activeTint, background, muted] = useThemeColor(["link", "background", "muted"]);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeTint,
        tabBarInactiveTintColor: muted,
        tabBarStyle: { backgroundColor: background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("today"),
          tabBarIcon: ({ color }) => <TabIcon name="water-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("history"),
          tabBarIcon: ({ color }) => <TabIcon name="bar-chart-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings"),
          tabBarIcon: ({ color }) => <TabIcon name="options-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}

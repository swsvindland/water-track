import { router } from "expo-router";
import { Platform } from "react-native";
import { useApp } from "@/lib/store";
import { Button, Screen, Text } from "@/vector";

export default function HealthPrivacy() {
  const { t } = useApp();
  return (
    <Screen title={t("health")} width="form">
      <Text>{t(Platform.OS === "ios" ? "healthApple" : "healthAndroid")}</Text>
      <Text tone="muted">{t("backgroundNote")}</Text>
      <Text tone="muted">{t("disconnectNote")}</Text>
      <Text tone="muted">{t("localNote")}</Text>
      <Button onPress={() => router.replace("/(tabs)/settings")}>{t("settings")}</Button>
    </Screen>
  );
}

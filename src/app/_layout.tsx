import type { JSX } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DatabaseProvider } from "@/db/provider";

import { AppProvider } from "@/lib/store";
import "@/lib/health";
import "../global.css";

export { ErrorBoundary } from "expo-router";

export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <DatabaseProvider>
          <AppProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="drink" options={{ presentation: "modal" }} />
            </Stack>
          </AppProvider>
        </DatabaseProvider>
        <StatusBar style="auto" />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

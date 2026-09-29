import { useEffect, type JSX } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { ErrorBoundary as RouterErrorBoundary, Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DatabaseProvider } from "@/db/provider";
import { duration, NavigationTheme, vectorHeroConfig } from "@/vector";
import { VectorAdapter } from "@/vector-adapter";

import { AppProvider } from "@/lib/store";
import "@/lib/health";
import "@/lib/notifications";
import "../global.css";

// The splash stays up through fonts, the database and the first store read; the store hides it.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: duration.normal, fade: true });

export function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  // A database that fails to open or migrate must not stay hidden under the splash.
  useEffect(() => SplashScreen.hide(), []);
  return <RouterErrorBoundary {...props} />;
}

export default function RootLayout(): JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    Inter: require("../../assets/fonts/Inter.ttf"),
    IBMPlexMono: require("../../assets/fonts/IBMPlexMono-Regular.ttf"),
    // Icon-only controls must not render blank on a cold start.
    ...Ionicons.font,
  });
  // A font that fails to load falls back to the system face rather than holding the splash.
  if (!fontsLoaded && !fontError) return null;
  // HeroUI renders selects and toasts in a portal host beside its children, so it sits inside the kit
  // provider: kit components in those overlays need its context. The DockProvider wraps the tabs only
  // ((tabs)/_layout): the modal routes fall back to the kit's top-edge Undo toast.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DatabaseProvider>
        <AppProvider>
          <VectorAdapter>
            <HeroUINativeProvider config={vectorHeroConfig}>
              <NavigationTheme>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="today-details" options={{ presentation: "modal" }} />
                  <Stack.Screen name="favorites" options={{ presentation: "modal" }} />
                  <Stack.Screen name="drink" options={{ presentation: "modal" }} />
                </Stack>
              </NavigationTheme>
            </HeroUINativeProvider>
          </VectorAdapter>
        </AppProvider>
      </DatabaseProvider>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

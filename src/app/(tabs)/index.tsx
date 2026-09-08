import { eq, sql } from "drizzle-orm";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { Button, Card } from "heroui-native";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDatabase } from "@/db/provider";
import { counters } from "@/db/schema";

export default function HomeTab() {
  const db = useDatabase();
  const { data, error } = useLiveQuery(db.select().from(counters).where(eq(counters.id, 1)));
  const [saveError, setSaveError] = useState<string | null>(null);
  const count = data[0]?.value;
  const ready = count !== undefined && !error;

  function updateCounter(action: "add" | "remove" | "reset") {
    try {
      db.update(counters)
        .set({
          value:
            action === "reset"
              ? 0
              : action === "add"
                ? sql`${counters.value} + 1`
                : sql`max(0, ${counters.value} - 1)`,
        })
        .where(eq(counters.id, 1))
        .run();
      setSaveError(null);
    } catch {
      setSaveError("Couldn’t save your change. Please try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
        <View className="w-full max-w-lg self-center gap-6">
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-3xl font-semibold text-foreground">
              Water Counter
            </Text>
            <Text className="text-base text-muted">A little reminder to keep drinking.</Text>
          </View>
          <Card className="gap-6">
            <Card.Body className="gap-2">
              <Card.Title>Glasses of Water</Card.Title>
              <Text
                accessibilityLiveRegion="polite"
                className="text-6xl font-semibold tabular-nums text-foreground"
              >
                {count ?? "—"}
              </Text>
              <Card.Description>Total since your last reset.</Card.Description>
            </Card.Body>
            <Card.Footer className="flex-col gap-3">
              <Button className="w-full" isDisabled={!ready} onPress={() => updateCounter("add")}>
                Add a glass
              </Button>
              <View className="w-full flex-row gap-3">
                <Button
                  className="flex-1"
                  variant="outline"
                  isDisabled={!ready || count === 0}
                  onPress={() => updateCounter("remove")}
                >
                  Remove one
                </Button>
                <Button
                  className="flex-1"
                  variant="ghost"
                  isDisabled={!ready || count === 0}
                  onPress={() => updateCounter("reset")}
                >
                  Reset
                </Button>
              </View>
            </Card.Footer>
          </Card>
          <Text
            accessibilityRole={error || saveError ? "alert" : undefined}
            className={error || saveError ? "text-danger" : "text-muted"}
          >
            {error
              ? "Couldn’t read your saved count. Please reopen the app."
              : (saveError ??
                "Saved on this device. Close and reopen the app to pick up where you left off.")}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { Platform } from "react-native";
import type { useDatabase } from "@/db/provider";
import { drinks } from "@/db/schema";
import { queuedDrinks, removeQueuedDrinks, updateWatchState } from "../../modules/watch-bridge";
import { queuedDrink, type WatchState } from "./quick-log";

// Saves drinks logged on Apple Watch or with a reminder's action button, then removes them from
// the native queue. A drink that fails to save stays queued for the next attempt.
export function saveQueuedDrinks(db: ReturnType<typeof useDatabase>) {
  const now = Date.now();
  const handled: string[] = [];
  for (const entry of queuedDrinks()) {
    try {
      const drink = queuedDrink(entry, now);
      // IDs make redelivered drinks no-ops.
      if (drink)
        db.insert(drinks)
          .values({ ...drink, updatedAt: now })
          .onConflictDoNothing()
          .run();
      // Invalid entries are removed too, so one bad entry can't hold up the queue.
      const id = (entry as { id?: unknown } | null)?.id;
      if (typeof id === "string") handled.push(id);
    } catch {
      // Retried when the queue changes or the app returns to the foreground.
    }
  }
  removeQueuedDrinks(handled);
}

let sent = "";
export function sendWatchState(state: WatchState) {
  if (Platform.OS !== "ios") return;
  const json = JSON.stringify(state);
  if (json === sent) return;
  sent = json;
  updateWatchState(json);
}
// A newly installed watch app needs the current state even though nothing changed.
export function resendWatchState() {
  sent = "";
}

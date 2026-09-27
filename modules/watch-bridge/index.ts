import { requireOptionalNativeModule } from "expo";

type NativeWatchBridge = {
  updateState(json: string): void;
  queuedDrinks(): string;
  removeQueuedDrinks(ids: string[]): void;
  addListener(event: "onQueue", listener: () => void): { remove(): void };
};

// Only iOS builds link this module; elsewhere every call is a no-op.
const native = requireOptionalNativeModule<NativeWatchBridge>("WatchBridge");

export function updateWatchState(json: string) {
  native?.updateState(json);
}

// Unvalidated entries from Apple Watch and reminder actions.
export function queuedDrinks(): unknown[] {
  try {
    const value: unknown = JSON.parse(native?.queuedDrinks() ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function removeQueuedDrinks(ids: string[]) {
  if (ids.length) native?.removeQueuedDrinks(ids);
}

// Fires when drinks are queued and when a watch app is installed or removed.
export function addQueueListener(listener: () => void) {
  return native?.addListener("onQueue", listener);
}

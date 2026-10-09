import { useSyncExternalStore } from "react";

// Live queries (woken by the descriptor's `announceChange`, src/vault-app.ts) refresh what renders from them, but not
// the drafts Settings and the reminder editor seed once with useState: the Settings tab stays mounted under the
// import screen. Those forms use the restore counter below as their React `key`, so a restore re-initialises them
// from the restored preferences: announceChange's events re-run the store's live queries (Drizzle's expo-sqlite
// driver reads synchronously) before the restore reports done and the import screen calls back.
let restores = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const restoreCount = () => restores;

function restored() {
  restores++;
  for (const listener of [...listeners]) listener();
}

/** The number of restores this process has seen: a `key` for forms whose drafts come from stored values. */
export function useVaultRestoreKey(): number {
  return useSyncExternalStore(subscribe, restoreCount);
}

/** The vault's import screen calls the callback once per finished restore. */
export function useVaultRefresh(): () => void {
  return restored;
}

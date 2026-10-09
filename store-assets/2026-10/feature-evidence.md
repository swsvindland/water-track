# Product evidence

Claims were checked against the current repository source on October 4, 2026. No source review is a substitute for final-device QA.

| Claim | Source |
|---|---|
| Drinks, caffeine, goal and history | `src/db/schema.ts`, `src/lib/metrics.ts`, `src/app/(tabs)/index.tsx`, `src/app/(tabs)/history.tsx` |
| Favorites and serving sizes | `src/lib/favorites.ts`, `src/app/favorites.tsx` |
| Reminders and offline scheduling | `src/lib/reminders.ts`, `src/lib/notifications.ts`, `src/lib/routine.ts` |
| Health Connect rationale | `src/app/health-privacy.tsx`, `plugins/with-health-rationale.js` |
| Apple vs Android sync | `src/lib/health-native.ts`, `src/lib/health-data.ts` |
| Apple Watch and on-device schedule setup | `targets/watch/ContentView.swift`, `src/lib/watch.ts`, `modules/schedule-intelligence` |

Languages and units: `src/lib/locales`, app settings and `app.json`. No app account, ad, analytics or purchase SDK was found in the reviewed app implementation. Review the final dependency/binary inventory before submitting privacy answers. Paid-download pricing and Pendum family names follow `vector-marketing/docs/sources/owner-decisions.md`.

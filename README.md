# VECTOR HYDRATION

**Track your drinks. Know your intake.**

VECTOR HYDRATION puts daily fluid goals, caffeine tracking, and drink history in one place. Log a drink in a tap, follow your intake over time, and connect to Apple Health or Health Connect when you choose.

Built for iOS and Android with Expo. Private and local-first. Drink logs and preferences live in `water-track.db` using expo-sqlite and Drizzle. No account or server is required.

## Features

- Log water, coffee, tea, pre-workout, energy drinks, and alcohol. Edit serving size, total caffeine, ABV, and local consumption time; edit or delete previous entries.
- Today shows total fluid volume, progress toward a configurable non-alcoholic fluid goal, caffeine in mg, and pure alcohol in grams.
- History provides calendar day, Monday–Sunday week, and month reports, daily volume charts, totals, averages, and editable logs. Current-period averages include elapsed calendar days, including days without drinks.
- 11 languages with a system-language default; device locale determines initial metric/US units. Configure serving sizes, default water size, goal, and optional BAC profile. Internal storage always uses mL and kg.
- Optional health sync with weight import, foreground retries, and OS-scheduled background work.

Hydration progress measures logged intake, not physiological hydration. Coffee and tea count; drinks containing alcohol do not contribute to the goal. The default goal of 2,500 mL is editable, not a personalized recommendation. Serving caffeine defaults are examples: users should check product labels.

BAC uses a simplified Widmark calculation with the latest accessible health weight (manual weight as fallback) and an explicitly supplied body-water factor, immediate absorption, and elimination of 0.015 percentage points/hour. It includes alcohol before midnight and applies elimination once per elapsed interval. It is not a measurement and must never be used to decide whether to drive or whether someone is sober, including when displaying zero. With health sync enabled, event-time estimates are exported to Apple Health with metadata identifying them as calculated estimates.

## Run

Use Node 24 LTS and pnpm 11.18.0 (the project requires Node 22.13+; tests need a Node release supporting TypeScript stripping).

```sh
pnpm install
pnpm start --clear
```

For native health integrations, build the development client with Xcode or the Android SDK:

```sh
pnpm ios:build
# or
pnpm android:build
```

The configured application ID is `com.watertrack.app`; adjust it for your signing/team setup before distribution. Expo Go cannot run the health integrations. Browser SQLite is not configured.

## Health sync

The Health sync switch in Settings opts in immediately, independently of Save. Permission prompts occur only when enabling or manually syncing. Automatic sync never prompts.

| Platform       | Exports                                                                                   | Reads                                               |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Apple Health   | Non-alcoholic fluid volume, caffeine, standard alcoholic drinks, event-time BAC estimates | Latest accessible body weight                       |
| Health Connect | Non-alcoholic fluid volume, caffeine via Nutrition records                                | Latest valid weight in the accessible recent window |

Weight import is read-only and stored separately from manual weight. With sync enabled, an available health weight is used for BAC; otherwise manual weight is used. Android reads the preceding 29 days to remain within Health Connect’s default read window; background reads require the optional background permission. HealthKit hides read-denial status, so an empty query falls back to manual weight.

Alcohol exports use the US/NIAAA standard of 14 g ethanol per drink, allowing fractional counts. BAC samples are recomputed for each alcohol-entry timestamp when logs, weight, or body-water factor change; deleted/edited entries remove obsolete samples. HealthKit percent units receive fractions (0.08% → 0.0008). The current React Native Health Connect bridge does not expose alcohol or BAC record types, so those remain local on Android. Exported fluid quantities use drink volume, not measured water composition.

Stable UUIDs associate each drink with only its own exports. Sync removes the previous export before writing its current version; interrupted exports remain pending and can safely retry. Deletions use local tombstones so remote deletion can finish later. Revision checks avoid acknowledging newer edits accidentally. Disconnecting stops future exports, leaving already exported health records in place; reconnecting queues all records so newly granted types are backfilled. Denied write permissions leave work pending while permitted types are still attempted. Automatic and manual errors appear in Settings. Switching off persists the opt-out before unregistering background work and stops subsequent writes in an active sync.

Background tasks are scheduled at a minimum 15-minute interval but execution is controlled by iOS/Android, may be delayed, and is not guaranteed after force-quitting. Foregrounding the app and changing logs also retry exports. iOS requires a physical device to validate background scheduling. Native permissions, background execution, and remote edit/delete behavior require device testing before release. Google Play health declarations and an appropriate published privacy policy are needed for distribution.

## Verification

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm db:check
pnpm format:check
```

Tests cover unit conversions, totals, local midnight and DST boundaries, BAC across multiple drinks and midnight, numeric/date validation, migration preservation, and revision/deletion behavior. Expo Router regenerates route types during `pnpm start` after adding routes.

Device acceptance checks:

1. Log each drink type; close/reopen and verify persistence and daily totals.
2. Edit volume/caffeine/ABV/time; move a drink to yesterday, then delete it and verify both reports.
3. Switch language and units, customize serving sizes, save, and reopen.
4. Connect health permissions; verify one export per supported quantity. Edit/delete and verify remote changes.
5. Deny/revoke permissions, log offline, reconnect, and verify retry without duplicates. Edit during sync.
6. Verify background export on physical iOS/Android devices, with foreground retry after suspension.

## Database changes

Edit `src/db/schema.ts`, then run `pnpm db:generate` and `pnpm db:check`. Commit generated migrations and metadata. Startup applies pending migrations before rendering. The legacy counter table is preserved without inventing dated drink records from the old all-time count.

Data is stored on-device without application-level backup. Uninstalling or clearing app storage removes local records; previously exported health data remains in the platform's health store.

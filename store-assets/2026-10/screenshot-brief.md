# Pendum Hydration screenshot brief

Use the fitness-native October package as the visual reference: dark teal background, a short white/cyan headline, one supporting line, and a framed native phone capture. Put Pendum branding above the headline. Each image must show the actual platform build with fictional data.

## Phone sequence

| Order | Headline | Supporting copy | Route |
|---|---|---|---|
| 1 | Every drink, in view. | Follow your daily fluid goal. | index |
| 2 | Your favorites. One tap. | Set the drinks and sizes you reach for. | favorites |
| 3 | See your daily rhythm. | Review intake across days, weeks and months. | history |
| 4 | Keep your log accurate. | Choose your drink, amount and time. | drink |
| 5 | A routine that fits. | Personal goals, units and settings. | settings |

The first image should show a populated main screen. Use fictional water, coffee and tea entries. Keep alcohol/BAC off in the first screenshot; the listing and review notes still disclose those implemented features.

## Platform exports

- Apple iPhone 6.9-inch: 1320 × 2868 portrait, opaque RGB PNG. Both apps currently disable iPad support, so an iPad set is not included.
- Google Play phone: 1080 × 1920 portrait, opaque RGB PNG. Capture Android navigation, controls and Health Connect text from the actual Android app. Do not relabel or resize an iOS capture as Android.
- Google Play tablet and desktop: if those form factors are offered, capture their actual layouts separately; use clean app captures for the upload slots, following the fitness-native reference. No such sets are currently included here.
- Apple Watch: `apple/watch-46mm/01-favorites.png`, 416 × 496, opaque RGB PNG. This is the native watch app displaying fictional cached companion data. Capture provenance is in `verification.md`. No Wear OS app exists.
- Feature graphic: `google-play/feature-graphic.png`, 1024 × 500. Its abstract chart is decorative, not a screenshot or a claimed personal result.
- Icons: `apple/icon-1024.png` and `google-play/icon-512.png` exported from the current app icon.

## Capture and rendering

`listing.json` contains the ordered routes and captions. `scripts/seed-demo.py` seeds only an empty iOS simulator container after app migrations and refuses existing records; stop the app before running it. Use an isolated test simulator and fictional records. Do not modify a user's database. Health sync, reminders and BAC remain off in fixtures.

Save native files to `raw/ios/<file>.png` or `raw/android/<file>.png`, using the filename stems from listing.json. Run `node store-assets/2026-10/scripts/render-assets.cjs` from the app repository with a supported Node runtime and its installed Sharp dependency. The renderer checks dimensions, text bounds and opaque RGB output and records source hashes; it skips missing screenshots instead of generating app UI. Inspect every completed image and contact sheet before upload.

## Current status

Five fresh iPhone captures and five fresh Android captures have been rendered, visually reviewed and validated. Both native development builds succeeded. Final phone images are in `apple/iphone-6.9/` and `google-play/phone/`; use the contact sheets to review their order. Each platform uses its own native app captures, with fictional data only.

The Apple Watch screenshot is also included. Its local cached demo state demonstrates the native layout; paired-device message delivery is a separate release check.

`scripts/capture-ios.py` saves the currently verified simulator screen. `scripts/capture-android.py` saves one visually verified screen on an isolated emulator. Both capture scripts require the filename stem from `listing.json`; they intentionally do not advance routes on a timer. `scripts/seed-android-from-ios.py` copies the fictional fixture into an empty emulator installation; it refuses nonempty data. `scripts/seed-watch.py` supplies matching fictional companion state to an isolated watch simulator. See `verification.md` for the devices and limitations.

The screenshot work is complete. Store submission still requires the owner fields, published policy/support pages and the final release checks in `submission-checklist.md`.

# Pendum Hydration verification

Checked October 4, 2026. These results cover local development builds and prepared store assets; they do not certify a signed production release.

## Completed checks

| Check | Result |
|---|---|
| iOS native Debug build | Passed on iPhone simulator; included Watch companion target |
| Android native Debug build | Passed, arm64 emulator |
| TypeScript | Passed |
| Targeted numeric/unit formatter tests | 6 passed, 0 failed |
| Shared Vector kit drift check | Passed, 0 differences |
| Lint of the edited Hydration screen, rationale route and plugin | Passed |
| Store copy field limits and text exports | See `copy-validation.json` and `package-validation.json` |
| Image dimensions, opaque RGB, bytes and SHA-256 | See `asset-manifest.json` and `package-validation.json` |
| Screenshot visual review | Five iPhone and five Android images reviewed individually and in contact sheets |

## Capture provenance

The iOS images use an iPhone 18 Pro Max simulator on iOS 27, captured at 1320 × 2868. Android images use an isolated, read-only Pixel 10 Pro XL AVD on API 37, configured to 1080 × 1920 for the store set. The raw files are separate real platform captures. Health sync and reminders are off in the fixtures. No personal user database was used.

Phone marketing artwork follows the existing fitness-native October package: dark teal background, white/cyan headline and a native phone screen in a frame. The renderer scales the native screen proportionally; it does not redraw the app UI. Source hashes and treatments are recorded in `design/composition.json`.

The Apple Watch image is a real Series 12 46 mm simulator screen on watchOS 27, at 416 × 496. It displays fictional cached companion state derived from the phone fixture. The simulator was unpaired for capture after the paired simulator UI failed to launch reliably. This verifies the watch layout, not WatchConnectivity delivery. The final Watch export is the native screen converted to opaque RGB, without promotional overlays.

## Fixes made during capture

Android Hermes sometimes returns the entire formatted quantity as one `formatToParts` item. The shared formatter now uses the full localized string when the individual parts cannot safely be separated. This restores the weight/fluid/height values and avoids duplicated milligram labels. The canonical Vector kit and this app's copy include the fix and regression coverage.

Android favorite labels no longer use automatic font shrinking, which made their names unreadably small in the compact tiles. The iOS behavior is unchanged.

The Hydration build now uses one Expo scene-lifecycle setup and sets Android minSdkVersion to 26, as required by its installed Health Connect dependency. A translated health-explanation screen and native intent handler were added for Health Connect rationale requests.

## Health Connect rationale checks

- Warm legacy rationale action: passed; the running app opened the explanatory screen. Evidence: `verification/health-rationale-warm.png`.
- Cold legacy action in the debug client: Expo Dev Launcher intercepted startup. Evidence: `verification/health-rationale-cold-debug-launcher.png`. This is not a passed cold-start test.
- Android 14+ permission-usage alias: present in the generated manifest with the required protected permission. A direct shell launch was rejected by Android's `START_VIEW_PERMISSION_USAGE` permission as expected. The actual system-owned entry point still needs a release/device test.
- The explanatory route does not replace the requirement for a complete, publicly accessible privacy policy.

## Before release

Build and verify the signed release, reconcile version/build numbers with store history, review its complete SDK/privacy inventory, and test health permissions, record correction/deletion and background behavior on physical devices. The development builds are not uploadable production binaries.

On the unsigned iOS simulator, Expo Notifications emitted a keychain-entitlement warning while registering notification state. It was dismissed for capture; the app source does not suppress it. Test notification permissions, scheduling and actions on the signed iPhone build. Also test paired Watch logging, delivery, and the optional on-device schedule setup on a compatible iPhone.

Support/review contacts, the confirmed copyright holder, public support/privacy pages, territories and release timing remain owner entries. No listing, pricing, declaration or binary has been uploaded by this work.

# Pendum Hydration privacy policy — draft for publication

Effective date: [publication date]
Operator: [legal person or company]
Privacy contact: [contact email]

Pendum Hydration stores the drinks you log (kind, name, volume, caffeine, alcohol by volume and time), your daily goal and serving sizes, your favorite drinks, your reminder schedule and routine description, your optional blood alcohol profile (body weight and body-water factor) and your preferences in the app's local storage on your device. You do not need an account. The developer does not operate an account service, a server or any other developer-hosted storage for these records, and does not receive them. Records leave your device only when you choose to: through Apple Health or Health Connect sync, your paired Apple Watch, or an export you save or share (described below).

## Apple Health and Health Connect

Health integration is optional and off until you connect it in Settings. With your authorization, the app writes non-alcoholic fluid volume, caffeine, the number of standard alcoholic drinks and, if you turn on BAC estimates, estimated blood alcohol content (BAC) to Apple Health, and reads your latest body weight to estimate BAC. On Android, it writes fluid volume and caffeine to Health Connect and reads your body weight from the last 29 days; reading in the background needs an optional extra permission. You control these permissions in the operating system. Apple's and Google's services and any other apps you authorize are subject to their respective privacy practices.

The body weight read from Apple Health or Health Connect stays on your device: it is not included in exports. Disconnecting stops future exports; it does not erase records already saved in Apple Health or Health Connect. Deleting or editing a drink in the app updates or removes its exported records at the next successful sync.

## Reminders, Apple Intelligence and Apple Watch

Hydration reminders are optional local notifications scheduled on your device; no push server is involved. On supported iPhones, the routine you describe to set up the reminder schedule is processed by Apple's on-device model and is not sent to the developer or to Apple by the app. The description is saved with your reminder settings, so it is part of exports you make.

The Apple Watch app receives today's total, goal, units, language and favorites from your iPhone, and sends the drinks you log on the watch back to your iPhone, through Apple's watch connection between your own devices.

## Exports and restores

You can export your data from Settings › Backup › Export data. The export is a single file containing your drink log (including drinks you deleted or a restore removed, which the app keeps marked as deleted so Health sync can remove their exported records) and your settings: goal, serving sizes, units, language, appearance, favorites, reminder schedule and routine description, and the blood alcohol profile. It does not contain the Health sync state, the body weight read from Apple Health or Health Connect, or whether reminders are switched on. The app creates the file on your device and hands it to the share sheet (or, on Android, the folder you pick); where the file goes from there is your choice. The file also includes a spreadsheet-readable list of your drinks.

Restoring a file (Settings › Backup › Restore from a file) replaces the drinks and settings in the app with the file's contents. Drinks in the app that the file does not contain leave your log; like a drink you delete, each is kept marked as deleted, so Health sync can remove any records it exported for it. Before replacing anything, the app keeps a copy of the data it replaces on your device, so the restore can be undone; it keeps the copies of the last two restores. Restoring turns Health sync off until you connect it again; when you do, the app brings Apple Health or Health Connect in line with the restored drinks, removing the records it exported for drinks the file does not contain.

Export files are not encrypted by the app. Anyone who can open the file can read your drink log and settings, including alcohol entries and the body weight you entered, so keep exported files somewhere private. The app does not upload export files anywhere; the developer has no server for them, never receives a copy and cannot access them. If you save a file to a cloud service such as iCloud Drive or Google Drive, it is stored under that service's privacy policy.

## Retention and device backups

Records remain in local app storage until deleted. A drink you delete, or that a restore removes, is hidden and kept marked as deleted, so Health sync can remove its exported records. Exports you made remain wherever you saved them until you delete them. Operating-system backups (iCloud or Google device backup) may include the app's database depending on your device settings; the app's restore copies and working files are excluded from them. Removing the app removes its local records. Retention of operating-system backups is controlled by the operating system and your backup provider.

## Contact and changes

For questions about privacy, contact [contact email]. We will update this policy when the app's data practices change.

---

Publication checklist: replace all bracketed fields; confirm the release binary and third-party dependencies do not transmit analytics, diagnostics or other data to the developer or partners; update this policy to match any such services; host at a public HTTPS URL. This draft describes the source reviewed on October 5, 2026, including the export and restore that ship with the backup vault, and is not yet a published policy. The app has no automatic cloud backup; if one is added later, this policy must describe it before that release.

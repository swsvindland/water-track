# Pendum Hydration privacy and store declarations

These are source-based preparation notes, not submitted declarations or a binary privacy audit. Match the answers to the final release and all bundled SDKs.

## Apple privacy

Candidate answer: Data Not Collected. The source stores tracking data on device and has no account, ads, analytics or developer record server. Apple's definition excludes data processed only on-device. Confirm the release SDKs introduce no off-device collection. Optional Apple Health integration must still be described in the privacy policy. WatchConnectivity between the user’s paired devices and on-device Foundation Models also need to remain accurately described.

No tracking/advertising identifier use was found. No account deletion flow is required for an app without accounts; local deletion and health-record behavior must be explained.

## Google Data safety

Candidate collection answer: No data collected, subject to release verification. Local access alone is excluded from collection. Sharing must be considered separately: transfers to another app can count even on-device. Optional Health Connect transfer may qualify for the user-initiated action or prominent disclosure and consent exception; verify the actual disclosure and consent flow before answering No data shared. Do not automatically equate local storage with no sharing. There is no server-side account, so account-creation/deletion questions are not applicable to this implementation.

Data handled locally: dated drinks, quantities, caffeine and alcohol content, favorites, goal, preferences, optional weight and BAC settings, reminder schedules and routine descriptions. Supported health integration: On iOS, non-alcoholic fluid volume, caffeine and standard alcoholic drinks are exported to Apple Health. Calculated event-time BAC estimates are exported when enabled. On Android, non-alcoholic fluid volume and caffeine (via Nutrition records) are exported to Health Connect; alcohol and BAC remain local. Both platforms may read the latest accessible weight for optional BAC estimates. Health weight is stored separately from manual weight. Editing or deleting a drink queues correction or removal of its linked exports on the next successful sync.

## Google health declaration

Suggested categories based on the implemented features: Nutrition and Weight Management (fluid and caffeine intake); review Other where needed for the optional alcohol/BAC feature. Do not select “no health features.” Complete the console's current choices from the actual build. The app does not claim medical-device approval.

| Permission | User benefit |
|---|---|
| WRITE_HYDRATION | Save the non-alcoholic fluid volume the user logs. |
| WRITE_NUTRITION | Save logged caffeine in Nutrition records. The app does not claim meal/macronutrient tracking. |
| READ_WEIGHT | Use the latest accessible weight for the optional BAC estimate. No weight export. |
| READ_HEALTH_DATA_IN_BACKGROUND | Refresh accessible weight during OS-scheduled health sync when the optional permission is granted. |

Permission justification copy: Pendum Hydration uses only the health types listed above to provide user-enabled health integration. Core manual tracking remains available without health access. Users control access in Settings and in the platform health service. Data is not used for advertising or sold. Read access and background execution are limited by platform permissions.

Hydration now includes a translated Health Connect explanation route (`src/app/health-privacy.tsx`) and native intent handler (`plugins/with-health-rationale.js`). The warm legacy action opened the route on the emulator. Verify cold starts and the protected Android 14+ entry point through the actual Health Connect UI on the signed release; the development launcher is not representative. Publish the completed accessible policy before submission. See `verification.md` for the exact test outcomes.

## Age and content ratings

Complete Apple's age questionnaire and Google's IARC questionnaire honestly; let each console assign the rating. Declare health/wellness information and alcohol references, since alcohol logging and BAC estimates exist even though disabled by default. There is no sale of alcohol, public user-content feed, messaging, gambling or advertising. Do not answer “no alcohol” merely because the marketing focuses on water. Intended audience is adults. Do not invent a numeric rating.

## Remaining owner entries

Review contact, support email, public policy/support URLs, copyright confirmation, business/trader details and release choices remain owner-supplied. See `submission-checklist.md`. Official definitions are linked in `sources.md`.

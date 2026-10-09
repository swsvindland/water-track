# Pendum Hydration submission checklist

Copy, icons, feature graphic and phone screenshot sets are prepared. Upload and release still require a verified release binary and the owner fields below.

- Enter the platform text from the matching en-US folder. No separate keywords field exists on Google Play.
- Select Health & Fitness and App. Choose only relevant tags offered by Play Console; suggested search concepts are water tracking, drink logging and reminders, not a promise that these exact tags exist.
- Configure $4.99 USD as a paid download. No trial, subscription or in-app products. Do not convert an existing free Play listing to paid without checking its eligibility.
- Supply the support email, review contact, confirmed legal rights holder, territories, release timing and business/trader details.
- Publish the completed privacy policy and a reachable support page. Proposed getpendum.com URLs are not verified live.
- Use the existing bundle identifier and package `dev.svindland.vector.water`. The renamed native development builds succeeded. Generate the final signed release from the same config; a JavaScript reload cannot update launcher names or permission prompts.
- Check actual App Store/Play Console version history. The app.json currently specifies 1.0.0; do not infer a release version from those documents.
- No sign-in is required and no review account is needed. Paste the platform review notes.
- Complete privacy, health and age-rating forms using `privacy-and-declarations.md` and the final release SDK inventory. Age ratings are assigned by the consoles; no numeric rating is preselected.
- Declare no ads for the reviewed implementation. Intended audience: adults; do not select children as a target audience for these adult reference/estimate tools. Confirm actual audience settings.
- Verify camera/photos where applicable, record editing/deletion, all claimed health permissions, background behavior and optional features on physical devices.
- Compare the completed five iPhone and five Android screenshots against the final submitted build. Captures contain fictional data. No iPad set is needed while supportsTablet is false. One native Watch image is included; verify paired Watch logging and delivery on physical devices. Android tablet/desktop screenshots are not included; prepare those sets if distributing/merchandising for those formats. No Wear OS app is included.
- Verify both Health Connect rationale entry points in the signed release, including a cold start from the real Health Connect UI. The warm legacy entry point passed on the emulator; the Expo development launcher prevented a representative cold-start test.
- Verify reminder delivery and actions on a signed iPhone build; the unsigned simulator emitted an Expo Notifications keychain-entitlement warning.
- Review privacy manifests, signing, export compliance and current target API requirements in the final build. Source sets ITSAppUsesNonExemptEncryption to false; verify that remains correct for the shipped binary.

No store listing, price, privacy declaration or app release has been submitted by this work.

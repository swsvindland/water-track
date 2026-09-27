/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "watch",
  name: "HydrateWatch",
  displayName: config.ios?.infoPlist?.CFBundleDisplayName ?? config.name,
  bundleIdentifier: ".watchkitapp",
  deploymentTarget: "10.0",
  icon: "../../assets/images/icon.png",
  colors: { $accent: "#22d3ee" },
  frameworks: ["SwiftUI", "WatchConnectivity", "UserNotifications"],
});

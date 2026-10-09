const { withMainActivity } = require("expo/config-plugins");

// Health Connect can request the privacy explanation on a cold or warm launch.
module.exports = function withHealthRationale(config) {
  return withMainActivity(config, (config) => {
    const activity = config.modResults;
    if (activity.language !== "kt") {
      throw new Error("Health rationale requires the Expo Kotlin activity.");
    }
    if (activity.contents.includes("hydrationHealthIntent")) return config;
    if (!activity.contents.includes("super.onCreate(null)")) {
      throw new Error("Cannot locate the activity startup for the health rationale.");
    }
    activity.contents = activity.contents.replace(
      "super.onCreate(null)",
      "hydrationHealthIntent(intent)\n    super.onCreate(null)",
    );
    const methods = `
  private fun hydrationHealthIntent(incoming: android.content.Intent?) {
    if (incoming?.action == "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" ||
        incoming?.action == "android.intent.action.VIEW_PERMISSION_USAGE") {
      incoming.action = android.content.Intent.ACTION_VIEW
      incoming.data = android.net.Uri.parse("water-track://health-privacy")
    }
  }

  override fun onNewIntent(intent: android.content.Intent) {
    hydrationHealthIntent(intent)
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;
    activity.contents = activity.contents.replace(/}\s*$/, `${methods}\n}\n`);
    return config;
  });
};

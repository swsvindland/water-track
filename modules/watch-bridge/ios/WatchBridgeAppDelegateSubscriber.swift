import ExpoModulesCore

// Starts at launch, before JavaScript, so a background launch for a watch message or a
// reminder's action button is handled even if the app is suspended again right away.
public class WatchBridgeAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    WatchBridge.shared.activate()
    return true
  }
}

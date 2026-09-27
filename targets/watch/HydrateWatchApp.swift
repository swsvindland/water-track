import SwiftUI
import UserNotifications
import WatchKit

@main
struct HydrateWatchApp: App {
  @WKApplicationDelegateAdaptor(AppDelegate.self) private var delegate

  var body: some Scene {
    WindowGroup {
      ContentView()
    }
  }
}

final class AppDelegate: NSObject, WKApplicationDelegate, UNUserNotificationCenterDelegate {
  func applicationDidFinishLaunching() {
    // Set before launching finishes so a reminder's action button can launch the app.
    UNUserNotificationCenter.current().delegate = self
    WatchStore.shared.activate()
  }

  // Reminders are scheduled on the iPhone. When the watch shows one and its "Log water" button is
  // tapped here, the drink is logged on the watch and sent to the iPhone. The iPhone handles the
  // same button itself when it is tapped there.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    // The iPhone schedules reminders with expo-notifications, which stores their `data` as userInfo.
    let quickLog = response.notification.request.content.userInfo["quickLog"] as? [String: Any]
    DispatchQueue.main.async {
      if response.actionIdentifier == WatchStore.quickLogAction, let quickLog {
        WatchStore.shared.logFromReminder(quickLog)
      }
      completionHandler()
    }
  }

  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound])
  }
}

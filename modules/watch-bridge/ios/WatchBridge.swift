import ExpoNotifications
import Foundation
import UserNotifications
import WatchConnectivity

/**
 Drinks logged outside the React Native app, on Apple Watch or with a reminder's action button,
 wait in a queue until JavaScript saves them. The queue lives in UserDefaults so a drink survives
 the app being suspended or killed before JavaScript runs. Entries carry their own IDs, so a drink
 delivered twice (a watch message and its guaranteed user-info copy) is saved once.
 */
final class WatchBridge: NSObject, WCSessionDelegate, NotificationDelegate {
  static let shared = WatchBridge()
  static let queueChanged = Notification.Name("WatchBridgeQueueChanged")
  // Matches QUICK_LOG_ACTION in src/lib/quick-log.ts.
  static let quickLogAction = "log-drink"

  private let queueKey = "watch-bridge.queue"
  private let lock = NSLock()
  private var pendingState: String?

  func activate() {
    NotificationCenterManager.shared.addDelegate(self)
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  // MARK: - Queue

  func queuedJSON() -> String {
    lock.lock()
    defer { lock.unlock() }
    return String(data: UserDefaults.standard.data(forKey: queueKey) ?? Data("[]".utf8), encoding: .utf8) ?? "[]"
  }

  func enqueue(_ drinks: [[String: Any]]) {
    lock.lock()
    var items = readQueue()
    for drink in drinks {
      guard let id = drink["id"] as? String, !items.contains(where: { $0["id"] as? String == id }) else {
        continue
      }
      items.append(drink)
    }
    writeQueue(items)
    lock.unlock()
    NotificationCenter.default.post(name: Self.queueChanged, object: nil)
  }

  func remove(_ ids: [String]) {
    lock.lock()
    defer { lock.unlock() }
    let removed = Set(ids)
    writeQueue(readQueue().filter { !removed.contains($0["id"] as? String ?? "") })
  }

  private func readQueue() -> [[String: Any]] {
    guard let data = UserDefaults.standard.data(forKey: queueKey),
          let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      return []
    }
    return items
  }

  private func writeQueue(_ items: [[String: Any]]) {
    guard JSONSerialization.isValidJSONObject(items),
          let data = try? JSONSerialization.data(withJSONObject: items) else {
      return
    }
    UserDefaults.standard.set(data, forKey: queueKey)
  }

  // MARK: - Watch state

  /// Sends today's progress and favorites; the system keeps only the latest context for the watch.
  func updateState(_ json: String) {
    DispatchQueue.main.async {
      self.pendingState = json
      self.sendPendingState()
    }
  }

  private func sendPendingState() {
    guard let json = pendingState, WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    pendingState = nil
    guard session.isPaired, session.isWatchAppInstalled else { return }
    try? session.updateApplicationContext(["state": json])
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    DispatchQueue.main.async { self.sendPendingState() }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // The user switched to another watch; start a session with it.
    WCSession.default.activate()
  }

  func sessionWatchStateDidChange(_ session: WCSession) {
    // A newly installed watch app has no state yet; ask JavaScript for a fresh copy.
    NotificationCenter.default.post(name: Self.queueChanged, object: nil)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    receive(message)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    receive(message)
    replyHandler(["received": true])
  }

  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    receive(userInfo)
  }

  private func receive(_ payload: [String: Any]) {
    if let drinks = payload["drinks"] as? [[String: Any]] {
      enqueue(drinks)
    }
  }

  // MARK: - NotificationDelegate

  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    // expo-notifications stores a local notification's `data` as its userInfo.
    guard response.actionIdentifier == Self.quickLogAction,
          var drink = response.notification.request.content.userInfo["quickLog"] as? [String: Any] else {
      return false
    }
    drink["id"] = UUID().uuidString.lowercased()
    drink["consumedAt"] = (Date().timeIntervalSince1970 * 1000).rounded()
    enqueue([drink])
    // NotificationCenterManager calls the completion handler once every delegate has returned.
    return true
  }
}

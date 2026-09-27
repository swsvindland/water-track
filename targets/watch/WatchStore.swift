import Foundation
import WatchConnectivity
import WatchKit

/**
 Today's progress and favorites from the iPhone, plus drinks logged here that the iPhone hasn't
 recorded yet. Drinks go to the iPhone twice: as a message, which wakes the iPhone app so it
 saves them right away, and as user info, which the system delivers later if the message can't
 be. The iPhone saves each drink ID once.
 */
final class WatchStore: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchStore()
  /// Matches QUICK_LOG_ACTION in src/lib/quick-log.ts.
  static let quickLogAction = "log-drink"
  /// Seconds a tap can be undone before the drink goes to the iPhone.
  static let undoWindow: TimeInterval = 4

  @Published private(set) var state: WatchState?
  @Published private(set) var drinks: [LoggedDrink] = []
  /// The most recent tap, while it can still be undone.
  @Published private(set) var lastLogged: LoggedDrink?

  private let defaults = UserDefaults.standard
  private let stateKey = "state"
  private let drinksKey = "drinks"

  override private init() {
    super.init()
    if let json = defaults.string(forKey: stateKey) {
      state = WatchState.decode(json)
    }
    if let data = defaults.data(forKey: drinksKey),
       let saved = try? JSONDecoder().decode([LoggedDrink].self, from: data) {
      drinks = saved
    }
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  /// Today's intake toward the goal, including drinks the iPhone hasn't recorded yet.
  func totalMl(at date: Date) -> Double {
    let startOfDay = Calendar.current.startOfDay(for: date).timeIntervalSince1970 * 1000
    let recorded = Set(state?.ids ?? [])
    // After midnight the iPhone's total is yesterday's until it sends a new one.
    let base = state.map { abs($0.day - startOfDay) < 1 ? $0.totalMl : 0 } ?? 0
    return drinks
      .filter { $0.countsTowardGoal && $0.consumedAt >= startOfDay && !recorded.contains($0.id) }
      .reduce(base) { $0 + $1.volumeMl }
  }

  // MARK: - Logging (main thread)

  func log(_ favorite: WatchState.Favorite) {
    let drink = LoggedDrink(
      kind: favorite.kind,
      name: favorite.name,
      volumeMl: favorite.volumeMl,
      caffeineMg: favorite.caffeineMg,
      abv: favorite.abv,
      hold: Self.undoWindow
    )
    drinks.append(drink)
    lastLogged = drink
    save()
    WKInterfaceDevice.current().play(.success)
    DispatchQueue.main.asyncAfter(deadline: .now() + Self.undoWindow) { [weak self] in
      self?.sendDue()
    }
  }

  /// Logs a reminder's glass right away; a notification action has nothing to undo.
  func logFromReminder(_ quickLog: [String: Any]) {
    guard let drink = LoggedDrink(quickLog: quickLog) else { return }
    drinks.append(drink)
    save()
    sendDue()
  }

  func undo() {
    guard let drink = lastLogged,
          let index = drinks.firstIndex(where: { $0.id == drink.id && !$0.sent }) else {
      return
    }
    drinks.remove(at: index)
    lastLogged = nil
    save()
    WKInterfaceDevice.current().play(.click)
  }

  /// Sends drinks whose undo window has passed. Also runs when the app becomes active and once
  /// the session activates, for drinks held while the app was suspended or not yet connected.
  func sendDue() {
    let now = Date().timeIntervalSince1970 * 1000
    if let last = lastLogged, last.sendAt <= now + 100 {
      lastLogged = nil
    }
    let session = WCSession.default
    guard session.activationState == .activated else { return }
    var changed = false
    for index in drinks.indices where !drinks[index].sent && drinks[index].sendAt <= now + 100 {
      let payload: [String: Any] = ["drinks": [drinks[index].payload]]
      if session.isReachable {
        session.sendMessage(payload, replyHandler: nil, errorHandler: nil)
      }
      session.transferUserInfo(payload)
      drinks[index].sent = true
      changed = true
    }
    if changed { save() }
  }

  private func save() {
    if let data = try? JSONEncoder().encode(drinks) {
      defaults.set(data, forKey: drinksKey)
    }
  }

  private func apply(_ json: String) {
    guard let next = WatchState.decode(json) else { return }
    state = next
    defaults.set(json, forKey: stateKey)
    // A drink in the iPhone's list is in its total, or was deleted there; either way the watch
    // stops adding it. Sent drinks from earlier days no longer affect today's total.
    let recorded = Set(next.ids)
    let startOfDay = Calendar.current.startOfDay(for: Date()).timeIntervalSince1970 * 1000
    drinks.removeAll { $0.sent && (recorded.contains($0.id) || $0.consumedAt < startOfDay) }
    save()
  }

  // MARK: - WCSessionDelegate (background queue)

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    let json = session.receivedApplicationContext["state"] as? String
    DispatchQueue.main.async {
      if let json { self.apply(json) }
      self.sendDue()
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    guard let json = applicationContext["state"] as? String else { return }
    DispatchQueue.main.async { self.apply(json) }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {
    DispatchQueue.main.async { self.sendDue() }
  }
}

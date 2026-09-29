import SwiftUI

/// What the iPhone sends; mirrors `watchState` in src/lib/quick-log.ts.
struct WatchState: Codable, Equatable {
  struct Favorite: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let color: String
    let kind: String
    let name: String?
    /// The drink at the iPhone's selected size, as its home screen logs it.
    let volumeMl: Double
    let caffeineMg: Double
    let abv: Double
  }

  struct Strings: Codable, Equatable {
    let logged: String
    let undo: String
    let empty: String
    let addDrink: String
  }

  /// Local midnight of the day `totalMl` belongs to, in milliseconds.
  let day: Double
  /// Today's non-alcoholic intake, which counts toward the goal.
  let totalMl: Double
  let goalMl: Double
  let sizeMl: Double
  let units: String
  let locale: String
  /// Today's drinks the iPhone has recorded, including deleted ones.
  let ids: [String]
  let favorites: [Favorite]
  let text: Strings

  static func decode(_ json: String) -> WatchState? {
    try? JSONDecoder().decode(WatchState.self, from: Data(json.utf8))
  }

  /// Matches formatVolume in src/lib/metrics.ts.
  func volume(_ ml: Double) -> String {
    let us = units == "us"
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: locale)
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = us ? 1 : 0
    let value = formatter.string(from: NSNumber(value: us ? ml / 29.5735295625 : ml)) ?? ""
    return "\(value) \(us ? "fl oz" : "mL")"
  }

  func percent(_ ml: Double) -> String {
    // The locale places the sign: "50 %" in fr, de and sv, "50%" in en.
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: locale)
    formatter.numberStyle = .percent
    formatter.maximumFractionDigits = 0
    let value = goalMl > 0 ? min(1, (ml / goalMl * 100).rounded(.down) / 100) : 0
    return formatter.string(from: NSNumber(value: value)) ?? ""
  }
}

/// A drink logged on the watch that the iPhone's state doesn't include yet.
struct LoggedDrink: Codable, Equatable, Identifiable {
  let id: String
  let kind: String
  let name: String?
  let volumeMl: Double
  let caffeineMg: Double
  let abv: Double
  /// Milliseconds since 1970, like the iPhone's database.
  let consumedAt: Double
  /// Held back until then so a mistaken tap can be undone before the iPhone saves it.
  let sendAt: Double
  var sent: Bool

  init(kind: String, name: String?, volumeMl: Double, caffeineMg: Double, abv: Double, hold: TimeInterval) {
    let now = Date().timeIntervalSince1970 * 1000
    id = UUID().uuidString.lowercased()
    self.kind = kind
    self.name = name
    self.volumeMl = volumeMl
    self.caffeineMg = caffeineMg
    self.abv = abv
    consumedAt = now.rounded()
    sendAt = now + hold * 1000
    sent = false
  }

  /// The drink a reminder's action button logs, from the notification's `quickLog` data.
  init?(quickLog: [String: Any]) {
    guard let kind = quickLog["kind"] as? String,
          let volumeMl = quickLog["volumeMl"] as? Double,
          let caffeineMg = quickLog["caffeineMg"] as? Double,
          let abv = quickLog["abv"] as? Double else {
      return nil
    }
    self.init(
      kind: kind,
      name: quickLog["name"] as? String,
      volumeMl: volumeMl,
      caffeineMg: caffeineMg,
      abv: abv,
      hold: 0
    )
  }

  var countsTowardGoal: Bool { abv == 0 }

  /// Property-list values for WatchConnectivity; validated again on the iPhone.
  var payload: [String: Any] {
    var payload: [String: Any] = [
      "id": id,
      "kind": kind,
      "volumeMl": volumeMl,
      "caffeineMg": caffeineMg,
      "abv": abv,
      "consumedAt": consumedAt,
    ]
    if let name { payload["name"] = name }
    return payload
  }
}


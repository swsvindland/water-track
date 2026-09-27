import ExpoModulesCore
#if canImport(FoundationModels)
import FoundationModels
#endif

public class ScheduleIntelligenceModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScheduleIntelligence")

    // "available", "deviceNotEligible", "appleIntelligenceNotEnabled", "modelNotReady" or "unsupported".
    Function("availability") { () -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return ScheduleGenerator.availability()
      }
      #endif
      return "unsupported"
    }

    // Returns a JSON array of seven { wake, bed, off } days in local minutes, Sunday first.
    AsyncFunction("generateSchedule") { (instructions: String, prompt: String) async throws -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        return try await ScheduleGenerator.generate(instructions: instructions, prompt: prompt)
      }
      #endif
      throw ModelUnavailableException()
    }
  }
}

internal final class ModelUnavailableException: Exception {
  override var reason: String {
    "Apple Intelligence is not available on this device"
  }
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct GeneratedDay {
  @Guide(description: "Hour the person wakes up, on a 24-hour clock: 7:30 in the morning is 7", .range(0...23))
  var wakeHour: Int

  @Guide(description: "Minute the person wakes up", .range(0...59))
  var wakeMinute: Int

  @Guide(description: "Hour the person goes to bed, on a 24-hour clock: 8:30 in the evening is 20, 10 pm is 22, midnight is 0, 1 am is 1", .range(0...23))
  var bedHour: Int

  @Guide(description: "Minute the person goes to bed", .range(0...59))
  var bedMinute: Int

  @Guide(description: "True only when the person asked for no reminders on this day")
  var remindersOff: Bool
}

@available(iOS 26.0, *)
@Generable
struct GeneratedWeek {
  var sunday: GeneratedDay
  var monday: GeneratedDay
  var tuesday: GeneratedDay
  var wednesday: GeneratedDay
  var thursday: GeneratedDay
  var friday: GeneratedDay
  var saturday: GeneratedDay
}

@available(iOS 26.0, *)
enum ScheduleGenerator {
  static func availability() -> String {
    if case .unavailable(let reason) = SystemLanguageModel.default.availability {
      switch reason {
      case .deviceNotEligible: return "deviceNotEligible"
      case .appleIntelligenceNotEnabled: return "appleIntelligenceNotEnabled"
      case .modelNotReady: return "modelNotReady"
      default: return "unsupported"
      }
    }
    return "available"
  }

  static func generate(instructions: String, prompt: String) async throws -> String {
    guard case .available = SystemLanguageModel.default.availability else {
      throw ModelUnavailableException()
    }
    // Guided generation constrains the on-device model to the GeneratedWeek structure.
    let session = LanguageModelSession(instructions: instructions)
    let week = try await session.respond(to: prompt, generating: GeneratedWeek.self).content
    let days: [[String: Any]] = [
      week.sunday, week.monday, week.tuesday, week.wednesday, week.thursday, week.friday, week.saturday,
    ].map { day in
      [
        "wake": day.wakeHour * 60 + day.wakeMinute,
        "bed": day.bedHour * 60 + day.bedMinute,
        "off": day.remindersOff,
      ]
    }
    let data = try JSONSerialization.data(withJSONObject: days)
    return String(decoding: data, as: UTF8.self)
  }
}
#endif

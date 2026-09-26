import { requireOptionalNativeModule } from "expo";

export type ScheduleIntelligenceAvailability =
  | "available"
  | "deviceNotEligible"
  | "appleIntelligenceNotEnabled"
  | "modelNotReady"
  | "unsupported";

type NativeScheduleIntelligence = {
  availability(): ScheduleIntelligenceAvailability;
  generateSchedule(instructions: string, prompt: string): Promise<string>;
};

// Only iOS builds link this module; Android, web, and Expo Go report "unsupported".
const native = requireOptionalNativeModule<NativeScheduleIntelligence>("ScheduleIntelligence");

export function scheduleIntelligenceAvailability(): ScheduleIntelligenceAvailability {
  try {
    return native?.availability() ?? "unsupported";
  } catch {
    return "unsupported";
  }
}

// Runs Apple's on-device model; the parsed result is untrusted and must be validated.
export async function generateSchedule(instructions: string, prompt: string): Promise<unknown> {
  if (!native) throw new Error("unavailable");
  return JSON.parse(await native.generateSchedule(instructions, prompt));
}

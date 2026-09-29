import { useMemo } from "react";
import { useCalendars } from "expo-localization";
import { parseDecimal, useKitFormat, type Format, type IntlUnit } from "@/vector";
import { LB_KG, OZ_ML } from "@/lib/metrics";
import { useApp } from "@/lib/store";

/**
 * Volumes in the person's units through the kit formatter (Intl units: "250 ml" in de, "250毫升" in zh).
 * `parts` spreads into a kit Value; `unit` is the suffix of a numeric Field.
 */
export function useVolume() {
  const { settings } = useApp();
  const format = useKitFormat();
  const us = settings.units === "us";
  return useMemo(() => {
    const unit: IntlUnit = us ? "fluid-ounce" : "milliliter";
    const amount = (ml: number) => (us ? ml / OZ_ML : ml);
    const digits = us ? 1 : 0;
    return {
      text: (ml: number) => format.unit(amount(ml), unit, digits),
      parts: (ml: number) => format.unitParts(amount(ml), unit, digits),
      unit: format.unitParts(1, unit).unit,
    };
  }, [format, us]);
}

/** Body weight in the person's units: `unit` is the Field suffix, `text` a stored kilogram value. */
export function useWeight() {
  const { settings } = useApp();
  const format = useKitFormat();
  const us = settings.units === "us";
  return useMemo(() => {
    const unit: IntlUnit = us ? "pound" : "kilogram";
    return {
      text: (kg: number) => format.unit(us ? kg / LB_KG : kg, unit, 2),
      unit: format.unitParts(1, unit).unit,
    };
  }, [format, us]);
}

/**
 * Numeric Field text read back in the locale's format (the kit's `format.editable` seeds it). NaN rather than
 * null, so callers keep their Number.isFinite range checks.
 */
export const parseAmount = (format: Format, text: string) => parseDecimal(text, format.tag) ?? NaN;

/**
 * Combined date styles the kit formatter has none for (it has monthDay, monthYear, year and weekdayLong, which
 * the screens use directly), in the kit's locale and with the device clock setting, as the kit's time() does.
 */
export function useDates() {
  const format = useKitFormat();
  const uses24h = useCalendars()[0]?.uses24hourClock ?? undefined;
  return useMemo(() => {
    const hourCycle: Intl.DateTimeFormatOptions["hourCycle"] =
      uses24h === undefined ? undefined : uses24h ? "h23" : "h12";
    const style = (options: Intl.DateTimeFormatOptions) => {
      const f = new Intl.DateTimeFormat(format.tag, options);
      return (time: number | Date) => f.format(time);
    };
    return {
      /** "Tuesday, Sep 29" */
      weekdayDay: style({ weekday: "long", month: "short", day: "numeric" }),
      /** "Tue 2:00 PM" */
      weekdayTime: style({ weekday: "short", hour: "numeric", minute: "2-digit", hourCycle }),
      /** "Sep 29, 2026, 2:00 PM" */
      dateTime: style({
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hourCycle,
      }),
    };
  }, [format, uses24h]);
}

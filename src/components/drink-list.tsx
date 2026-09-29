import { router } from "expo-router";
import { Meta, Panel, RecordRow, SystemState, Value, useKitFormat, type IconName } from "@/vector";
import type { Drink } from "@/db/schema";
import { useApp } from "@/lib/store";
import { alcoholGrams, type DrinkKind } from "@/lib/metrics";
import { useVolume } from "./format";

/** Drink kinds as registry glyphs: muted in lists, and on Today's quick-log tiles. */
export const kindIcon: Record<DrinkKind, IconName> = {
  other: "drinkOther",
  water: "water",
  juice: "juice",
  milk: "milk",
  coffee: "coffee",
  tea: "tea",
  preworkout: "preworkout",
  energy: "energy",
  alcohol: "alcohol",
};

/** The day's drinks as history records: kind glyph, time, name and caffeine or alcohol, then the volume. */
export function DrinkList({ rows }: { rows: Drink[] }) {
  const { t } = useApp();
  const format = useKitFormat();
  const volume = useVolume();
  if (!rows.length) return <SystemState kind="empty" message={t("emptyBody")} />;
  return (
    <Panel inset="none">
      {rows.map((d) => {
        const name = d.name || t(d.kind as DrinkKind);
        const time = format.time(new Date(d.consumedAt));
        const facets: string[] = [];
        if (d.caffeineMg > 0) facets.push(format.unit(d.caffeineMg, "milligram"));
        if (d.abv > 0) facets.push(format.unit(alcoholGrams(d), "gram", 1));
        const details = [time, ...facets].reduce((first, second) =>
          t("metaPair", { first, second })
        );
        return (
          <RecordRow
            key={d.id}
            leading={kindIcon[d.kind as DrinkKind] ?? kindIcon.other}
            time={time}
            title={name}
            description={facets.length ? <Meta items={facets} /> : undefined}
            value={<Value {...volume.parts(d.volumeMl)} />}
            accessibilityLabel={t("editDrinkLabel", {
              name,
              volume: volume.text(d.volumeMl),
              details,
            })}
            onPress={() => router.push({ pathname: "/drink", params: { id: d.id } })}
          />
        );
      })}
    </Panel>
  );
}

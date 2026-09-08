import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { eq } from "drizzle-orm";
import { Button } from "heroui-native";
import { Screen, Field, Choices, Heading, Note } from "@/components/ui";
import { useDatabase } from "@/db/provider";
import { preferences } from "@/db/schema";
import { useApp } from "@/lib/store";
import { defaults, kinds, OZ_ML, parseNumber, type DrinkKind } from "@/lib/metrics";
import type { Favorite } from "@/lib/favorites";

export default function Favorites() {
  const { settings, t } = useApp();
  const db = useDatabase();
  const favorites = JSON.parse(settings.favorites) as Favorite[];
  const factor = settings.units === "us" ? OZ_ML : 1;
  const [editing, setEditing] = useState<Favorite | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DrinkKind>("water");
  const [amount, setAmount] = useState("");
  const [caffeine, setCaffeine] = useState("");
  const [abv, setAbv] = useState("");
  const [error, setError] = useState("");
  function edit(favorite: Favorite) {
    setEditing(favorite);
    setName(favorite.name || t(favorite.kind));
    setKind(favorite.kind);
    setAmount(String(Number((favorite.ml / factor).toFixed(2))));
    setCaffeine(String(favorite.caffeine));
    setAbv(String(favorite.abv));
    setError("");
  }
  function persist(next: Favorite[]) {
    try {
      db.update(preferences)
        .set({ favorites: JSON.stringify(next) })
        .where(eq(preferences.id, 1))
        .run();
      setEditing(null);
      setError("");
    } catch {
      setError(t("saveError"));
    }
  }
  function save() {
    const ml = parseNumber(amount) * factor,
      mg = parseNumber(caffeine),
      strength = parseNumber(abv);
    if (
      !name.trim() ||
      ![ml, mg, strength].every(Number.isFinite) ||
      ml < 1 ||
      ml > 5000 ||
      mg < 0 ||
      mg > 2000 ||
      strength < 0 ||
      strength > 100
    ) {
      setError(t("invalidFavorite"));
      return;
    }
    const favorite: Favorite = {
      id: editing!.id,
      name: name.trim(),
      kind,
      ml,
      caffeine: mg,
      abv: strength,
    };
    persist(
      favorites.some((f) => f.id === favorite.id)
        ? favorites.map((f) => (f.id === favorite.id ? favorite : f))
        : [...favorites, favorite]
    );
  }
  return (
    <Screen title={t("favorites")}>
      {editing ? (
        <>
          <Field label={t("drinkName")} value={name} onChangeText={setName} maxLength={60} />
          <Heading>{t("drinkType")}</Heading>
          <Choices
            value={kind}
            options={kinds.map((value) => ({ value, label: t(value) }))}
            onChange={(value) => {
              setKind(value);
              setAmount(String(Number((defaults[value].ml / factor).toFixed(2))));
              setCaffeine(String(defaults[value].caffeine));
              setAbv(String(defaults[value].abv));
            }}
          />
          <Field
            label={`${t("referenceSize")} (${settings.units === "us" ? "fl oz" : "mL"})`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <Field
            label={t("caffeineAmount")}
            value={caffeine}
            onChangeText={setCaffeine}
            keyboardType="decimal-pad"
          />
          <Field label={t("abv")} value={abv} onChangeText={setAbv} keyboardType="decimal-pad" />
          <Note>{t("favoriteHint")}</Note>
          <Button onPress={save}>{t("save")}</Button>
          <Button
            variant="ghost"
            onPress={() => {
              setEditing(null);
              setError("");
            }}
          >
            {t("cancel")}
          </Button>
          {favorites.some((f) => f.id === editing.id) && (
            <Button
              variant="danger-soft"
              onPress={() => persist(favorites.filter((f) => f.id !== editing.id))}
            >
              {t("removeFavorite")}
            </Button>
          )}
        </>
      ) : (
        <>
          <View className="gap-3">
            {favorites.map((favorite) => (
              <Button key={favorite.id} variant="outline" onPress={() => edit(favorite)}>
                {favorite.name || t(favorite.kind)}
              </Button>
            ))}
          </View>
          <Button
            onPress={() => edit({ id: randomUUID(), name: "", kind: "other", ...defaults.other })}
          >
            {t("addFavorite")}
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            {t("back")}
          </Button>
        </>
      )}
      {!!error && <Note error>{error}</Note>}
    </Screen>
  );
}

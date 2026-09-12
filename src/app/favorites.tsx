import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { eq } from "drizzle-orm";
import { Button, Switch } from "heroui-native";
import { Screen, Field, Choices, Heading, Note } from "@/components/ui";
import { useDatabase } from "@/db/provider";
import { preferences } from "@/db/schema";
import { useApp } from "@/lib/store";
import { defaults, kinds, OZ_ML, parseNumber, type DrinkKind } from "@/lib/metrics";
import {
  drinkCatalog,
  isPopularDrink,
  favoriteColor,
  favoriteColorClasses,
  favoriteColors,
  type Favorite,
  type FavoriteColor,
} from "@/lib/favorites";

export default function Favorites() {
  const { settings, t, volume, number } = useApp();
  const db = useDatabase();
  const favorites = drinkCatalog(JSON.parse(settings.favorites) as Favorite[]);
  const factor = settings.units === "us" ? OZ_ML : 1;
  const [editing, setEditing] = useState<Favorite | null>(null);
  const [color, setColor] = useState<FavoriteColor | undefined>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DrinkKind>("water");
  const [amount, setAmount] = useState("");
  const [caffeine, setCaffeine] = useState("");
  const [abv, setAbv] = useState("");
  const [error, setError] = useState("");
  function edit(favorite: Favorite) {
    setEditing(favorite);
    setColor(favorite.color);
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
      showOnHome: editing!.showOnHome ?? true,
      name: name.trim(),
      kind,
      color,
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
          <Heading>{t("favoriteButtonColor")}</Heading>
          <View className="flex-row flex-wrap gap-2">
            <Button
              variant="outline"
              accessibilityState={{ selected: color === undefined }}
              onPress={() => setColor(undefined)}
            >
              {`${color === undefined ? "✓ " : ""}${t("automaticColor")}`}
            </Button>
            {favoriteColors.map((option) => (
              <Button
                key={option}
                variant="secondary"
                className={favoriteColorClasses[option].background}
                accessibilityState={{ selected: color === option }}
                onPress={() => setColor(option)}
              >
                <Button.Label className={favoriteColorClasses[option].foreground}>
                  {`${color === option ? "✓ " : ""}${t(option)}`}
                </Button.Label>
              </Button>
            ))}
          </View>
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
            variant="outline"
            onPress={() => {
              setEditing(null);
              setError("");
            }}
          >
            {t("cancel")}
          </Button>
          {!isPopularDrink(editing) && favorites.some((f) => f.id === editing.id) && (
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
          <Note>{t("favoritesVisibilityHint")}</Note>
          {[
            ...kinds
              .map((kind) => ({
                title: t(kind),
                drinks: favorites.filter((drink) => isPopularDrink(drink) && drink.kind === kind),
              }))
              .filter((section) => section.drinks.length > 0),
            {
              title: t("customDrinks"),
              drinks: favorites.filter((drink) => !isPopularDrink(drink)),
            },
          ].map((section) => (
            <View key={section.title} className="gap-3">
              <Heading>{section.title}</Heading>
              {!section.drinks.length && <Note>{t("customDrinksEmpty")}</Note>}
              {section.drinks.map((favorite) => (
                <View key={favorite.id} className="flex-row items-center gap-3 py-2">
                  <View className="flex-1 gap-1">
                    <Text className="text-base font-medium text-foreground">
                      {favorite.name || t(favorite.kind)}
                    </Text>
                    <Note>
                      {volume(favorite.ml)}
                      {favorite.caffeine > 0 ? ` · ${number(favorite.caffeine)} mg` : ""}
                      {favorite.abv > 0 ? ` · ${number(favorite.abv)}%` : ""}
                    </Note>
                  </View>
                  <Button
                    variant="secondary"
                    className={favoriteColorClasses[favoriteColor(favorite)].background}
                    accessibilityLabel={`${t("editDrink")}: ${favorite.name || t(favorite.kind)}`}
                    onPress={() => edit(favorite)}
                  >
                    <Button.Label
                      className={favoriteColorClasses[favoriteColor(favorite)].foreground}
                    >
                      {t("editFavorite")}
                    </Button.Label>
                  </Button>
                  <Switch
                    accessibilityLabel={`${t("showOnHome")}: ${favorite.name || t(favorite.kind)}`}
                    isSelected={favorite.showOnHome !== false}
                    onSelectedChange={(showOnHome) =>
                      persist(
                        favorites.map((drink) =>
                          drink.id === favorite.id ? { ...drink, showOnHome } : drink
                        )
                      )
                    }
                  />
                </View>
              ))}
            </View>
          ))}
          <Note>{t("defaultsNote")}</Note>
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

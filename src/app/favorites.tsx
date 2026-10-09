import { useState } from "react";
import { View } from "react-native";
import { Stack, router } from "expo-router";
import { randomUUID } from "expo-crypto";
import { eq } from "drizzle-orm";
import {
  Button,
  EditorScreen,
  ErrorText,
  Field,
  Label,
  LinkButton,
  ListRow,
  Meta,
  Note,
  Screen,
  Select,
  SettingsSection,
  SystemState,
  Toggle,
  useKitFormat,
  useKitStrings,
} from "@/vector";
import { FavoriteTile } from "@/components/favorite-tile";
import { parseAmount, useVolume } from "@/components/format";
import { useDatabase } from "@/db/provider";
import { preferences } from "@/db/schema";
import { useApp } from "@/lib/store";
import { defaults, kinds, OZ_ML, type DrinkKind } from "@/lib/metrics";
import {
  drinkCatalog,
  favoriteColors,
  favoriteSections,
  isPopularDrink,
  savedFavorites,
  type Favorite,
  type FavoriteColor,
} from "@/lib/favorites";

// "automatic" stores no colour, so the tile follows the drink type's default hue.
type Hue = FavoriteColor | "automatic";
const hues: readonly Hue[] = ["automatic", ...favoriteColors];

type Form = {
  name: string;
  kind: DrinkKind;
  color: Hue;
  amount: string;
  caffeine: string;
  abv: string;
};

/** A catalog row: the drink and its facets, then Edit and the home-screen switch as separate controls. */
function FavoriteRow({
  name,
  facets,
  shown,
  onEdit,
  onShow,
}: {
  name: string;
  facets: string[];
  shown: boolean;
  onEdit: () => void;
  onShow: (shown: boolean) => void;
}) {
  const { t } = useApp();
  const details = facets.reduce((first, second) => t("metaPair", { first, second }));
  return (
    <ListRow
      title={name}
      description={<Meta items={facets} />}
      control={
        <View className="flex-row items-center gap-2">
          <Button
            variant="ghost"
            accessibilityLabel={t("editFavoriteLabel", { name, details })}
            onPress={onEdit}
          >
            {t("editFavorite")}
          </Button>
          <Toggle
            value={shown}
            onChange={onShow}
            accessibilityLabel={t("showOnHomeLabel", { name })}
          />
        </View>
      }
    />
  );
}

export default function Favorites() {
  const { settings, t } = useApp();
  const db = useDatabase();
  const format = useKitFormat();
  const strings = useKitStrings();
  const volume = useVolume();
  const favorites = drinkCatalog(savedFavorites(settings.favorites));
  const factor = settings.units === "us" ? OZ_ML : 1;
  const [editing, setEditing] = useState<Favorite | null>(null);
  const blank: Form = {
    name: "",
    kind: "water",
    color: "automatic",
    amount: "",
    caffeine: "",
    abv: "",
  };
  const [form, setForm] = useState<Form>(blank);
  // The form as it opened: while it differs, the sheet holds its swipe and Android back.
  const [initial, setInitial] = useState<Form>(blank);
  const [error, setError] = useState("");
  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  function edit(favorite: Favorite) {
    const next: Form = {
      name: favorite.name || t(favorite.kind),
      kind: favorite.kind,
      color: favoriteColors.find((hue) => hue === favorite.color) ?? "automatic",
      amount: format.editable(favorite.ml / factor),
      caffeine: format.editable(favorite.caffeine),
      abv: format.editable(favorite.abv),
    };
    setEditing(favorite);
    setForm(next);
    setInitial(next);
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
    const ml = parseAmount(format, form.amount) * factor,
      mg = parseAmount(format, form.caffeine),
      strength = parseAmount(format, form.abv);
    if (
      !form.name.trim() ||
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
      name: form.name.trim(),
      kind: form.kind,
      color: form.color === "automatic" ? undefined : form.color,
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
  if (editing) {
    const saved = favorites.some((f) => f.id === editing.id);
    const dirty = (Object.keys(form) as (keyof Form)[]).some((key) => form[key] !== initial[key]);
    return (
      <EditorScreen
        title={t(saved ? "editDrink" : "addFavorite")}
        onClose={() => {
          setEditing(null);
          setError("");
        }}
        dirty={dirty}
        primary={{ label: t("save"), onPress: save }}
        destructive={
          !isPopularDrink(editing) && saved
            ? {
                label: t("removeFavorite"),
                onPress: () => persist(favorites.filter((f) => f.id !== editing.id)),
              }
            : undefined
        }
      >
        <Field
          label={t("drinkName")}
          value={form.name}
          onChange={(name) => update({ name })}
          maxLength={60}
        />
        <Select
          showTitle
          title={t("drinkType")}
          values={kinds}
          value={form.kind}
          label={(value) => t(value)}
          onChange={(kind) =>
            update({
              kind,
              amount: format.editable(defaults[kind].ml / factor),
              caffeine: format.editable(defaults[kind].caffeine),
              abv: format.editable(defaults[kind].abv),
            })
          }
        />
        <Select
          showTitle
          title={t("favoriteButtonColor")}
          values={hues}
          value={form.color}
          label={(value) => t(value === "automatic" ? "automaticColor" : value)}
          onChange={(color) => update({ color })}
        />
        <FavoriteTile
          favorite={{
            name: form.name.trim(),
            kind: form.kind,
            color: form.color === "automatic" ? undefined : form.color,
          }}
          ml={editing.ml}
          compact
        />
        <Field
          label={t("referenceSize")}
          value={form.amount}
          onChange={(amount) => update({ amount })}
          numeric
          unit={volume.unit}
        />
        <Field
          label={t("caffeineAmount")}
          value={form.caffeine}
          onChange={(caffeine) => update({ caffeine })}
          numeric
        />
        <Field label={t("abv")} value={form.abv} onChange={(abv) => update({ abv })} numeric />
        <Note>{t("favoriteHint")}</Note>
        <ErrorText message={error} />
      </EditorScreen>
    );
  }
  const sections = [
    ...favoriteSections
      .map((kind) => ({
        title: t(kind),
        drinks: favorites.filter((drink) => isPopularDrink(drink) && drink.kind === kind),
      }))
      .filter((section) => section.drinks.length > 0),
    {
      title: t("customDrinks"),
      drinks: favorites.filter((drink) => !isPopularDrink(drink)),
    },
  ];
  return (
    // A list on its existing modal route: switches save as they change, so the header only closes it.
    <>
      {/* The editor holds the swipe while it is dirty; the list always lets it dismiss the route again. */}
      <Stack.Screen options={{ gestureEnabled: true }} />
      <Screen
        title={t("favorites")}
        width="form"
        action={<LinkButton onPress={() => router.back()}>{strings.done}</LinkButton>}
      >
        <Note>{t("favoritesVisibilityHint")}</Note>
        {sections.map((section) =>
          section.drinks.length ? (
            <SettingsSection key={section.title} eyebrow={section.title}>
              {section.drinks.map((favorite) => {
                const name = favorite.name || t(favorite.kind);
                const facets = [volume.text(favorite.ml)];
                if (favorite.caffeine > 0) facets.push(format.unit(favorite.caffeine, "milligram"));
                if (favorite.abv > 0) facets.push(format.percent(favorite.abv / 100, 1));
                return (
                  <FavoriteRow
                    key={favorite.id}
                    name={name}
                    facets={facets}
                    shown={favorite.showOnHome !== false}
                    onEdit={() => edit(favorite)}
                    onShow={(showOnHome) =>
                      persist(
                        favorites.map((drink) =>
                          drink.id === favorite.id ? { ...drink, showOnHome } : drink
                        )
                      )
                    }
                  />
                );
              })}
            </SettingsSection>
          ) : (
            <View key={section.title} className="gap-2">
              <Label accessibilityRole="header">{section.title}</Label>
              <SystemState kind="empty" message={t("customDrinksEmpty")} />
            </View>
          )
        )}
        <Note>{t("defaultsNote")}</Note>
        <Button
          onPress={() => edit({ id: randomUUID(), name: "", kind: "other", ...defaults.other })}
        >
          {t("addFavorite")}
        </Button>
        <ErrorText message={error} />
      </Screen>
    </>
  );
}

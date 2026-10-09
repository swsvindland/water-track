import SwiftUI

struct ContentView: View {
  @ObservedObject private var store = WatchStore.shared
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    Group {
      if let state = store.state {
        // Four favorites per page; swipe or turn the Digital Crown for the rest.
        TabView {
          ForEach(pages(state.favorites), id: \.first?.id) { favorites in
            FavoritesPage(state: state, favorites: favorites)
          }
        }
        .tabViewStyle(.verticalPage)
        .overlay(alignment: .bottom) {
          if let drink = store.lastLogged {
            UndoBanner(state: state, drink: drink)
              .transition(.opacity)
              .vectorHiddenWhenDimmed()
          }
        }
        .animation(.easeOut(duration: 0.15), value: store.lastLogged?.id)
      } else {
        SetupView()
      }
    }
    .vectorWatchTypeCap()
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { store.sendDue() }
    }
  }

  private func pages(_ favorites: [WatchState.Favorite]) -> [[WatchState.Favorite]] {
    guard !favorites.isEmpty else { return [[]] }
    return stride(from: 0, to: favorites.count, by: 4).map {
      Array(favorites[$0..<min($0 + 4, favorites.count)])
    }
  }
}

private struct FavoritesPage: View {
  @ObservedObject private var store = WatchStore.shared
  let state: WatchState
  let favorites: [WatchState.Favorite]

  var body: some View {
    VStack(spacing: 6) {
      // Re-evaluated each minute so the total resets at midnight.
      TimelineView(.everyMinute) { context in
        ProgressHeader(state: state, totalMl: store.totalMl(at: context.date))
      }
      if favorites.isEmpty {
        Text(state.text.empty)
          .font(.footnote)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        Grid(horizontalSpacing: 6, verticalSpacing: 6) {
          GridRow {
            tile(0)
            tile(1)
          }
          GridRow {
            tile(2)
            tile(3)
          }
        }
      }
    }
    .padding(.horizontal, 2)
    .modifier(LargeTypeScroll())
  }

  @ViewBuilder
  private func tile(_ index: Int) -> some View {
    if index < favorites.count {
      FavoriteButton(state: state, favorite: favorites[index])
    } else {
      Color.clear
    }
  }
}

private struct ProgressHeader: View {
  let state: WatchState
  let totalMl: Double

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(state.volume(totalMl))
        .vectorReadout(.title3, weight: .medium)
      VectorMeter(fraction: state.goalMl > 0 ? totalMl / state.goalMl : 0, height: 6)
      HStack(spacing: 4) {
        Text(state.percent(totalMl))
        Spacer(minLength: 0)
        Label(state.volume(state.goalMl), systemImage: "target")
          .labelStyle(.titleAndIcon)
      }
      .font(.caption2)
      .foregroundStyle(.secondary)
      .lineLimit(1)
    }
    .accessibilityElement(children: .combine)
  }
}

private struct FavoriteButton: View {
  let state: WatchState
  let favorite: WatchState.Favorite

  var body: some View {
    // The favorite's hue tints the system tile; the glyph and name take its ink (design system §8.5).
    let ink = favoriteInk(favorite.color)
    Button {
      WatchStore.shared.log(favorite)
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        Image(systemName: drinkSymbol(favorite.kind))
          .font(.footnote)
          .foregroundStyle(ink)
          .accessibilityHidden(true)
        Text(favorite.title)
          .font(.footnote.weight(.semibold))
          .foregroundStyle(ink)
          .lineLimit(2)
          .minimumScaleFactor(0.8)
        Spacer(minLength: 0)
        Text(state.volume(favorite.volumeMl))
          .font(VectorFont.readout(.caption2))
          .monospacedDigit()
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
    .vectorTileButton()
    .tint(ink)
    .vectorHiddenWhenDimmed()
    .accessibilityLabel("\(state.text.addDrink): \(favorite.title), \(state.volume(favorite.volumeMl))")
  }
}

/// The ink of a favorite hue; the iPhone sends favoriteColor() from src/lib/favorites.ts.
private func favoriteInk(_ color: String) -> Color {
  switch color {
  case "cyan": return Color(vector: VectorTokens.favoriteCyanInk)
  case "brown": return Color(vector: VectorTokens.favoriteBrownInk)
  case "sage": return Color(vector: VectorTokens.favoriteSageInk)
  case "amber": return Color(vector: VectorTokens.favoriteAmberInk)
  case "violet": return Color(vector: VectorTokens.favoriteVioletInk)
  case "rose": return Color(vector: VectorTokens.favoriteRoseInk)
  case "blue": return Color(vector: VectorTokens.favoriteBlueInk)
  case "teal": return Color(vector: VectorTokens.favoriteTealInk)
  case "olive": return Color(vector: VectorTokens.favoriteOliveInk)
  case "terracotta": return Color(vector: VectorTokens.favoriteTerracottaInk)
  case "plum": return Color(vector: VectorTokens.favoritePlumInk)
  default: return Color(vector: VectorTokens.favoriteSlateInk)
  }
}

/// Matches kindIcon in src/components/drink-list.tsx (SF names from src/vector/icons.ts).
private func drinkSymbol(_ kind: String) -> String {
  switch kind {
  case "water": return "drop"
  case "coffee": return "cup.and.saucer"
  case "tea": return "leaf"
  case "milk": return "mug"
  case "juice": return "carrot"
  case "energy": return "bolt"
  case "preworkout": return "dumbbell"
  case "alcohol": return "wineglass"
  default: return "waterbottle"
  }
}

private struct UndoBanner: View {
  let state: WatchState
  let drink: LoggedDrink

  var body: some View {
    Button {
      WatchStore.shared.undo()
    } label: {
      HStack(spacing: 6) {
        Image(systemName: VectorSymbol.done)
          .foregroundStyle(VectorColor.signal)
        Text(state.text.logged)
          .lineLimit(1)
        Spacer(minLength: 4)
        Text(state.text.undo)
          .fontWeight(.semibold)
          .foregroundStyle(VectorColor.signal)
      }
      .font(.footnote)
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .vectorFloatingCapsule()
    }
    .buttonStyle(.plain)
    .padding(.horizontal, 4)
    .accessibilityLabel("\(state.text.logged), \(state.volume(drink.volumeMl)). \(state.text.undo)")
  }
}

/// Shown until the iPhone app first sends favorites; it has no translations to share yet.
private struct SetupView: View {
  private static let messages = [
    "en": "Open Pendum Hydration on your iPhone to sync your favorites.",
    "es": "Abre Pendum Hydration en tu iPhone para sincronizar tus favoritos.",
    "fr": "Ouvrez Pendum Hydration sur votre iPhone pour synchroniser vos favoris.",
    "de": "Öffne Pendum Hydration auf deinem iPhone, um deine Favoriten zu synchronisieren.",
    "it": "Apri Pendum Hydration sul tuo iPhone per sincronizzare i preferiti.",
    "pt": "Abra a Pendum Hydration no iPhone para sincronizar os seus favoritos.",
    "nl": "Open Pendum Hydration op je iPhone om je favorieten te synchroniseren.",
    "sv": "Öppna Pendum Hydration på din iPhone för att synka dina favoriter.",
    "ja": "iPhoneでPendum Hydrationを開いて、お気に入りを同期してください。",
    "ko": "iPhone에서 Pendum Hydration을 열어 즐겨찾기를 동기화하세요.",
    "zh": "在 iPhone 上打开 Pendum Hydration 以同步你的收藏。",
  ]

  var body: some View {
    let language = Locale.current.language.languageCode?.identifier ?? "en"
    VStack(spacing: 10) {
      Image(systemName: "iphone.gen3")
        .font(.title2)
        .foregroundStyle(Color.accentColor)
      Text(Self.messages[language] ?? Self.messages["en"]!)
        .font(.footnote)
        .multilineTextAlignment(.center)
    }
    .padding()
    .modifier(LargeTypeScroll())
  }
}

/// Pages keep their fixed layout at normal sizes and scroll at accessibility sizes, so nothing clips.
private struct LargeTypeScroll: ViewModifier {
  @Environment(\.dynamicTypeSize) private var typeSize

  @ViewBuilder
  func body(content: Content) -> some View {
    if typeSize.isAccessibilitySize {
      ScrollView { content }
    } else {
      content
    }
  }
}

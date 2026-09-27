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
              .transition(.move(edge: .bottom).combined(with: .opacity))
          }
        }
        .animation(.snappy, value: store.lastLogged?.id)
      } else {
        SetupView()
      }
    }
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
        .font(.system(.title3, design: .rounded).weight(.semibold))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      ProgressView(value: state.goalMl > 0 ? min(totalMl / state.goalMl, 1) : 0)
        .tint(.accentColor)
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
    let colors = Palette.colors(for: favorite.color)
    Button {
      WatchStore.shared.log(favorite)
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        Text(favorite.title)
          .font(.system(.footnote, design: .rounded).weight(.semibold))
          .lineLimit(2)
          .minimumScaleFactor(0.8)
        Spacer(minLength: 0)
        Text(state.volume(favorite.volumeMl))
          .font(.caption2)
          .opacity(0.8)
          .lineLimit(1)
      }
      .foregroundStyle(colors.foreground)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .padding(8)
      .background(colors.background, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
      .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
    .buttonStyle(PressStyle())
    .accessibilityLabel("\(state.text.addDrink): \(favorite.title), \(state.volume(favorite.volumeMl))")
  }
}

private struct PressStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .scaleEffect(configuration.isPressed ? 0.94 : 1)
      .opacity(configuration.isPressed ? 0.8 : 1)
      .animation(.snappy(duration: 0.15), value: configuration.isPressed)
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
        Image(systemName: "checkmark.circle.fill")
          .foregroundStyle(.green)
        Text(state.text.logged)
          .lineLimit(1)
        Spacer(minLength: 4)
        Text(state.text.undo)
          .fontWeight(.semibold)
          .foregroundStyle(Color.accentColor)
      }
      .font(.footnote)
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(.ultraThinMaterial, in: Capsule())
    }
    .buttonStyle(.plain)
    .padding(.horizontal, 4)
    .accessibilityLabel("\(state.text.logged), \(state.volume(drink.volumeMl)). \(state.text.undo)")
  }
}

/// Shown until the iPhone app first sends favorites; it has no translations to share yet.
private struct SetupView: View {
  private static let messages = [
    "en": "Open HYDRATE on your iPhone to sync your favorites.",
    "es": "Abre HYDRATE en tu iPhone para sincronizar tus favoritos.",
    "fr": "Ouvrez HYDRATE sur votre iPhone pour synchroniser vos favoris.",
    "de": "Öffne HYDRATE auf deinem iPhone, um deine Favoriten zu synchronisieren.",
    "it": "Apri HYDRATE sul tuo iPhone per sincronizzare i preferiti.",
    "pt": "Abra a HYDRATE no iPhone para sincronizar os seus favoritos.",
    "nl": "Open HYDRATE op je iPhone om je favorieten te synchroniseren.",
    "sv": "Öppna HYDRATE på din iPhone för att synka dina favoriter.",
    "ja": "iPhoneでHYDRATEを開いて、お気に入りを同期してください。",
    "ko": "iPhone에서 HYDRATE를 열어 즐겨찾기를 동기화하세요.",
    "zh": "在 iPhone 上打开 HYDRATE 以同步你的收藏。",
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
  }
}

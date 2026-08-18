import SwiftUI
import SwiftData

struct RootView: View {
    @AppStorage(SettingsKeys.hasOnboarded) private var hasOnboarded = false

    var body: some View {
        if hasOnboarded {
            MainTabView()
        } else {
            OnboardingView()
        }
    }
}

struct MainTabView: View {
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
            SurfView()
                .tabItem { Label("Surf", systemImage: "water.waves") }
            CheckInView()
                .tabItem { Label("Check-in", systemImage: "moon.stars") }
            PatternsView()
                .tabItem { Label("Patterns", systemImage: "sparkles") }
            ReframeView()
                .tabItem { Label("Reframe", systemImage: "quote.bubble") }
        }
        .task {
            NotificationManager.shared.refresh()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                NotificationManager.shared.refresh()
            }
        }
    }
}

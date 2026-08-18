import SwiftUI
import SwiftData

@main
struct WaveApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
        .modelContainer(for: [UrgeLog.self, CheckIn.self, ReframeEntry.self, SurfSession.self])
    }
}

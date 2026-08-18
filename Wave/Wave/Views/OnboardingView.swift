import SwiftUI

struct OnboardingView: View {
    @AppStorage(SettingsKeys.hasOnboarded) private var hasOnboarded = false
    @State private var showingReminderPage = false

    var body: some View {
        ZStack {
            Theme.background.ignoresSafeArea()
            if showingReminderPage {
                reminderPage
            } else {
                welcomePage
            }
        }
    }

    private var welcomePage: some View {
        VStack(spacing: 24) {
            Spacer()
            WaveAnimation(intensity: 0.4)
                .frame(height: 160)
            Text("Wave")
                .font(.largeTitle.weight(.semibold))
            VStack(spacing: 12) {
                Text("A private place to notice cravings and urges, and to watch your own patterns take shape.")
                Text("It does not count calories, weigh anything, or grade your days. Everything stays on this phone.")
            }
            .font(.body)
            .foregroundStyle(Theme.softText)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
            Spacer()
            Button {
                showingReminderPage = true
            } label: {
                Text("Continue")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
    }

    private var reminderPage: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "bell.badge")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.accent)
            Text("Reminders, if you want them")
                .font(.title2.weight(.semibold))
            VStack(spacing: 12) {
                Text("Wave can offer one gentle daily nudge to check in, at a time you choose in Settings.")
                Text("Notifications are created on this phone only. Nothing is sent anywhere, and their wording never reveals what the app is for.")
                Text("If you step away for a few days, reminders become less frequent, not more.")
            }
            .font(.body)
            .foregroundStyle(Theme.softText)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 32)
            Spacer()
            VStack(spacing: 12) {
                Button {
                    Task {
                        _ = await NotificationManager.shared.requestPermission()
                        hasOnboarded = true
                    }
                } label: {
                    Text("Allow reminders")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                }
                .buttonStyle(.borderedProminent)
                Button {
                    hasOnboarded = true
                } label: {
                    Text("Maybe later")
                        .font(.subheadline)
                        .foregroundStyle(Theme.softText)
                        .frame(height: 44)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
    }
}

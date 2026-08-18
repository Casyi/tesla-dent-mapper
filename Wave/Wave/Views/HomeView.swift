import SwiftUI
import SwiftData

struct HomeView: View {
    @Query(sort: \UrgeLog.date, order: .reverse) private var logs: [UrgeLog]
    @State private var showingLogSheet = false
    @State private var showingSettings = false

    private var todaysLogs: [UrgeLog] {
        logs.filter { Calendar.current.isDateInToday($0.date) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    Button {
                        showingLogSheet = true
                    } label: {
                        VStack(spacing: 8) {
                            Image(systemName: "water.waves")
                                .font(.system(size: 34, weight: .light))
                            Text("Log an urge")
                                .font(.title2.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 150)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.accent)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .strokeBorder(Theme.accent.opacity(0.25), lineWidth: 1)
                    )

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Today")
                            .font(.subheadline)
                            .foregroundStyle(Theme.dimText)
                        if todaysLogs.isEmpty {
                            Text("Nothing logged yet today.")
                                .foregroundStyle(Theme.softText)
                                .card()
                        } else {
                            ForEach(todaysLogs) { log in
                                LogRow(log: log)
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Wave")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundStyle(Theme.softText)
                    }
                }
            }
            .sheet(isPresented: $showingLogSheet) {
                LogUrgeSheet()
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
        }
    }
}

struct LogRow: View {
    let log: UrgeLog

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(log.date.formatted(date: .omitted, time: .shortened))
                    .font(.subheadline.weight(.medium))
                Spacer()
                Text(log.action)
                    .font(.subheadline)
                    .foregroundStyle(Theme.softText)
            }
            HStack(spacing: 10) {
                Text(log.feeling.capitalized)
                Text("·")
                Text("Intensity \(log.intensity)")
            }
            .font(.subheadline)
            .foregroundStyle(Theme.dimText)
        }
        .card()
    }
}

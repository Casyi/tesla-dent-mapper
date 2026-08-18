import SwiftUI
import SwiftData
import UserNotifications
import UIKit

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage(SettingsKeys.checkInReminderEnabled) private var dailyEnabled = false
    @AppStorage(SettingsKeys.checkInReminderMinutes) private var dailyMinutes = 21 * 60
    @AppStorage(SettingsKeys.riskReminderEnabled) private var riskEnabled = false
    @AppStorage(SettingsKeys.riskReminderMinutes) private var riskMinutes = 21 * 60

    @Query(sort: \UrgeLog.date) private var logs: [UrgeLog]
    @Query(sort: \CheckIn.date) private var checkIns: [CheckIn]
    @Query(sort: \SurfSession.date) private var surfs: [SurfSession]
    @Query(sort: \ReframeEntry.date) private var reframes: [ReframeEntry]

    @State private var authStatus: UNAuthorizationStatus = .notDetermined

    private var peakHour: Int? {
        Patterns.peakHour(logs: logs)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Daily check-in reminder", isOn: $dailyEnabled)
                    if dailyEnabled {
                        DatePicker("Time", selection: timeBinding($dailyMinutes), displayedComponents: .hourAndMinute)
                    }
                } header: {
                    Text("Check-in")
                } footer: {
                    Text("One quiet nudge a day. It never mentions what you are working on.")
                }

                Section {
                    Toggle("Reminder for a high-risk hour", isOn: $riskEnabled)
                    if riskEnabled {
                        DatePicker("Time", selection: timeBinding($riskMinutes), displayedComponents: .hourAndMinute)
                    }
                    if let hour = peakHour {
                        HStack {
                            Text("Your logs cluster around \(Patterns.hourLabel(hour)).")
                                .font(.footnote)
                                .foregroundStyle(Theme.dimText)
                            Spacer()
                            Button("Use it") {
                                riskMinutes = hour * 60
                                riskEnabled = true
                            }
                            .font(.footnote)
                        }
                    }
                } header: {
                    Text("Second reminder")
                } footer: {
                    Text("Optional. If you go quiet for a few days, Wave sends fewer reminders, not more.")
                }

                if authStatus == .denied {
                    Section {
                        Text("Notifications for Wave are off in iOS Settings, so reminders will not arrive.")
                            .font(.footnote)
                            .foregroundStyle(Theme.softText)
                        Button("Open iOS Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) {
                                UIApplication.shared.open(url)
                            }
                        }
                    }
                }

                Section {
                    ShareLink(item: exportText) {
                        Label("Export my logs as text", systemImage: "square.and.arrow.up")
                    }
                } header: {
                    Text("Your data")
                } footer: {
                    Text("Everything stays on this phone. Export creates a plain-text copy you can hand to a doctor or keep for yourself.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
            }
            .task {
                authStatus = await NotificationManager.shared.authorizationStatus()
            }
            .onChange(of: dailyEnabled) { _, _ in reminderSettingChanged() }
            .onChange(of: dailyMinutes) { _, _ in reminderSettingChanged() }
            .onChange(of: riskEnabled) { _, _ in reminderSettingChanged() }
            .onChange(of: riskMinutes) { _, _ in reminderSettingChanged() }
        }
    }

    private var exportText: String {
        ExportBuilder.text(logs: logs, checkIns: checkIns, surfs: surfs, reframes: reframes)
    }

    private func reminderSettingChanged() {
        Task {
            if (dailyEnabled || riskEnabled) && authStatus == .notDetermined {
                _ = await NotificationManager.shared.requestPermission()
                authStatus = await NotificationManager.shared.authorizationStatus()
            }
            NotificationManager.shared.refresh()
        }
    }

    private func timeBinding(_ minutes: Binding<Int>) -> Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(
                    bySettingHour: minutes.wrappedValue / 60,
                    minute: minutes.wrappedValue % 60,
                    second: 0,
                    of: .now
                ) ?? .now
            },
            set: { newValue in
                let components = Calendar.current.dateComponents([.hour, .minute], from: newValue)
                minutes.wrappedValue = (components.hour ?? 0) * 60 + (components.minute ?? 0)
            }
        )
    }
}

import Foundation
import UserNotifications

final class NotificationManager {
    static let shared = NotificationManager()

    private let center = UNUserNotificationCenter.current()
    private let dailyID = "wave.reminder.daily"
    private let riskID = "wave.reminder.risk"
    private let quietID = "wave.reminder.quiet"
    private let surfID = "wave.surf.end"

    private init() {}

    func requestPermission() async -> Bool {
        (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
    }

    func authorizationStatus() async -> UNAuthorizationStatus {
        await center.notificationSettings().authorizationStatus
    }

    func recordActivity() {
        UserDefaults.standard.set(Date(), forKey: SettingsKeys.lastActivityDate)
        refresh()
    }

    func refresh() {
        Task { await self.reschedule() }
    }

    private func reschedule() async {
        center.removePendingNotificationRequests(withIdentifiers: [dailyID, riskID, quietID])
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized else { return }

        let defaults = UserDefaults.standard
        let dailyEnabled = defaults.bool(forKey: SettingsKeys.checkInReminderEnabled)
        let riskEnabled = defaults.bool(forKey: SettingsKeys.riskReminderEnabled)
        guard dailyEnabled || riskEnabled else { return }

        let dailyMinutes = defaults.object(forKey: SettingsKeys.checkInReminderMinutes) as? Int ?? 21 * 60
        let riskMinutes = defaults.object(forKey: SettingsKeys.riskReminderMinutes) as? Int ?? 21 * 60

        let lastActivity = defaults.object(forKey: SettingsKeys.lastActivityDate) as? Date
        let idleDays: Int
        if let lastActivity {
            idleDays = Calendar.current.dateComponents([.day], from: lastActivity, to: Date()).day ?? 0
        } else {
            idleDays = 0
        }

        if idleDays >= 4 {
            let content = UNMutableNotificationContent()
            content.title = "Wave"
            content.body = "Here whenever you want it. There's nothing to catch up on."
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 60 * 60 * 48, repeats: false)
            try? await center.add(UNNotificationRequest(identifier: quietID, content: content, trigger: trigger))
            return
        }

        if dailyEnabled {
            let content = UNMutableNotificationContent()
            content.title = "Wave"
            content.body = "Two minutes to check in, when you have them."
            content.sound = .default
            var components = DateComponents()
            components.hour = dailyMinutes / 60
            components.minute = dailyMinutes % 60
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            try? await center.add(UNNotificationRequest(identifier: dailyID, content: content, trigger: trigger))
        }

        if riskEnabled {
            let content = UNMutableNotificationContent()
            content.title = "Wave"
            content.body = "This hour can bring waves. The timer is there if you want it."
            content.sound = .default
            var components = DateComponents()
            components.hour = riskMinutes / 60
            components.minute = riskMinutes % 60
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            try? await center.add(UNNotificationRequest(identifier: riskID, content: content, trigger: trigger))
        }
    }

    func scheduleSurfEnd(after seconds: TimeInterval) {
        guard seconds > 1 else { return }
        let content = UNMutableNotificationContent()
        content.title = "Wave"
        content.body = "The twenty minutes are up. Notice where the wave is now."
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        center.add(UNNotificationRequest(identifier: surfID, content: content, trigger: trigger))
    }

    func cancelSurfEnd() {
        center.removePendingNotificationRequests(withIdentifiers: [surfID])
    }
}

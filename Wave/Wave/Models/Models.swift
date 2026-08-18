import Foundation
import SwiftData

@Model
final class UrgeLog {
    var date: Date
    var precedingActivity: String
    var feeling: String
    var intensity: Int
    var action: String

    init(date: Date = .now, precedingActivity: String = "", feeling: String, intensity: Int, action: String) {
        self.date = date
        self.precedingActivity = precedingActivity
        self.feeling = feeling
        self.intensity = intensity
        self.action = action
    }
}

@Model
final class CheckIn {
    var date: Date
    var question: String
    var answer: String

    init(date: Date = .now, question: String, answer: String) {
        self.date = date
        self.question = question
        self.answer = answer
    }
}

@Model
final class SurfSession {
    var date: Date
    var outcome: String

    init(date: Date = .now, outcome: String) {
        self.date = date
        self.outcome = outcome
    }
}

@Model
final class ReframeEntry {
    var date: Date
    var original: String
    var fact: String
    var verdict: String

    init(date: Date = .now, original: String, fact: String, verdict: String) {
        self.date = date
        self.original = original
        self.fact = fact
        self.verdict = verdict
    }
}

enum Feeling: String, CaseIterable, Identifiable {
    case bored, tired, stressed, lonely, restless, fine

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

enum UrgeAction: String, CaseIterable, Identifiable {
    case rodeItOut = "Rode it out"
    case gaveIn = "Gave in"
    case somethingElse = "Something else"

    var id: String { rawValue }
}

enum SurfOutcome: String, CaseIterable, Identifiable {
    case eased = "It eased"
    case same = "About the same"
    case strong = "Still strong"

    var id: String { rawValue }
}

enum SettingsKeys {
    static let hasOnboarded = "hasOnboarded"
    static let checkInReminderEnabled = "checkInReminderEnabled"
    static let checkInReminderMinutes = "checkInReminderMinutes"
    static let riskReminderEnabled = "riskReminderEnabled"
    static let riskReminderMinutes = "riskReminderMinutes"
    static let lastActivityDate = "lastActivityDate"
}

import Foundation

enum Patterns {
    static let minimumLogs = 5

    static func sentences(logs: [UrgeLog], surfs: [SurfSession]) -> [String] {
        guard logs.count >= minimumLogs else { return [] }
        var result: [String] = []

        if let bucket = mostCommon(logs.map { timeBucket(for: $0.date) }) {
            result.append("Most of your urges arrive \(bucket).")
        }

        if let feeling = mostCommon(logs.map { $0.feeling }) {
            result.append("The feeling you note most often beforehand is \"\(feeling)\".")
        }

        let rodeOut = logs.filter { $0.action == UrgeAction.rodeItOut.rawValue }.count
        result.append("You rode out \(rodeOut) of your \(logs.count) logged urges.")

        if let hour = peakHour(logs: logs) {
            result.append("They cluster most around \(hourLabel(hour)).")
        }

        if surfs.count >= 3, let outcome = mostCommon(surfs.map { $0.outcome }) {
            result.append("After a twenty-minute surf, your most common note was \"\(outcome.lowercased())\".")
        }

        return result
    }

    static func peakHour(logs: [UrgeLog]) -> Int? {
        guard logs.count >= minimumLogs else { return nil }
        return mostCommon(logs.map { Calendar.current.component(.hour, from: $0.date) })
    }

    static func hourLabel(_ hour: Int) -> String {
        var components = DateComponents()
        components.hour = hour
        let date = Calendar.current.date(from: components) ?? .now
        return date.formatted(date: .omitted, time: .shortened)
    }

    private static func timeBucket(for date: Date) -> String {
        switch Calendar.current.component(.hour, from: date) {
        case 5...11: return "in the morning"
        case 12...16: return "in the afternoon"
        case 17...21: return "in the evening"
        default: return "late at night"
        }
    }

    private static func mostCommon<T: Hashable>(_ values: [T]) -> T? {
        let counts = values.reduce(into: [T: Int]()) { $0[$1, default: 0] += 1 }
        return counts.max { $0.value < $1.value }?.key
    }
}

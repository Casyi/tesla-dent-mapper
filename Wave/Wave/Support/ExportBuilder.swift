import Foundation

enum ExportBuilder {
    static func text(logs: [UrgeLog], checkIns: [CheckIn], surfs: [SurfSession], reframes: [ReframeEntry]) -> String {
        var lines: [String] = []
        lines.append("Wave export")
        lines.append("Created \(Date.now.formatted(date: .long, time: .shortened))")
        lines.append("All entries were logged on device. Times are local.")
        lines.append("")

        lines.append("URGES (\(logs.count))")
        if logs.isEmpty {
            lines.append("None recorded.")
        }
        for log in logs.sorted(by: { $0.date < $1.date }) {
            var line = "\(stamp(log.date)) — felt \(log.feeling), intensity \(log.intensity) of 10, \(log.action.lowercased())"
            lines.append(line)
            let activity = log.precedingActivity.trimmingCharacters(in: .whitespacesAndNewlines)
            if !activity.isEmpty {
                line = "  The hour before: \(activity)"
                lines.append(line)
            }
        }
        lines.append("")

        lines.append("URGE SURF SESSIONS (\(surfs.count))")
        if surfs.isEmpty {
            lines.append("None recorded.")
        }
        for surf in surfs.sorted(by: { $0.date < $1.date }) {
            lines.append("\(stamp(surf.date)) — after 20 minutes: \(surf.outcome.lowercased())")
        }
        lines.append("")

        lines.append("DAILY CHECK-INS (\(checkIns.count))")
        if checkIns.isEmpty {
            lines.append("None recorded.")
        }
        for entry in checkIns.sorted(by: { $0.date < $1.date }) {
            lines.append("\(stamp(entry.date)) — \(entry.question)")
            lines.append("  \(entry.answer)")
        }
        lines.append("")

        lines.append("REFRAMES (\(reframes.count))")
        if reframes.isEmpty {
            lines.append("None recorded.")
        }
        for entry in reframes.sorted(by: { $0.date < $1.date }) {
            lines.append("\(stamp(entry.date))")
            lines.append("  Thought: \(entry.original)")
            lines.append("  What happened: \(entry.fact)")
            if !entry.verdict.isEmpty {
                lines.append("  Attached verdict: \(entry.verdict)")
            }
        }

        return lines.joined(separator: "\n")
    }

    private static func stamp(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .shortened)
    }
}

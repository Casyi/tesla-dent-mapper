import Foundation

enum ThoughtSplitter {
    private static let markers = [
        ", so ", ". so ", " so i", "which means", "that means", "that proves",
        "i'm such", "i am such", "i'm a ", "i am a ", "i'm just", "i am just",
        "i must be", "i always", "i never", "i'll never", "i will never",
        "i can't even", "i have no", "what's wrong with me", "whats wrong with me",
        "as usual", "like always", "again.", "again,", "of course i"
    ]

    static func split(_ text: String) -> (fact: String, verdict: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lowered = trimmed.lowercased()

        var best: Range<String.Index>?
        for marker in markers {
            if let range = lowered.range(of: marker), range.lowerBound > lowered.startIndex {
                if best == nil || range.lowerBound < best!.lowerBound {
                    best = range
                }
            }
        }

        guard let found = best else {
            return (trimmed, "")
        }

        let offset = lowered.distance(from: lowered.startIndex, to: found.lowerBound)
        guard let cut = trimmed.index(trimmed.startIndex, offsetBy: offset, limitedBy: trimmed.endIndex), cut < trimmed.endIndex else {
            return (trimmed, "")
        }
        let fact = String(trimmed[..<cut]).trimmingCharacters(in: CharacterSet(charactersIn: " ,.;"))
        let verdict = String(trimmed[cut...]).trimmingCharacters(in: CharacterSet(charactersIn: " ,.;"))
        if fact.isEmpty || verdict.isEmpty {
            return (trimmed, "")
        }
        return (fact, verdict)
    }
}

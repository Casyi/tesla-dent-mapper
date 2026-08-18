import SwiftUI
import SwiftData

struct CheckInView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \CheckIn.date, order: .reverse) private var entries: [CheckIn]

    @State private var answer = ""
    @State private var justSaved = false

    private static let questions = [
        "What set things off today?",
        "What helped today, even a little?",
        "What did you notice about today?"
    ]

    private var todaysQuestion: String {
        let day = Calendar.current.ordinality(of: .day, in: .era, for: .now) ?? 0
        return Self.questions[day % Self.questions.count]
    }

    private var todaysEntry: CheckIn? {
        entries.first { Calendar.current.isDateInToday($0.date) }
    }

    private var weekAgoEntry: CheckIn? {
        guard let weekAgo = Calendar.current.date(byAdding: .day, value: -7, to: .now) else { return nil }
        return entries.first { Calendar.current.isDate($0.date, inSameDayAs: weekAgo) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Text(todaysQuestion)
                        .font(.title3.weight(.semibold))

                    TextField("Whatever comes to mind", text: $answer, axis: .vertical)
                        .lineLimit(4...8)
                        .padding(14)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))

                    Button {
                        save()
                    } label: {
                        Text(justSaved ? "Saved" : "Save")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(answer.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    if let past = weekAgoEntry {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Seven days ago you wrote")
                                .font(.subheadline)
                                .foregroundStyle(Theme.dimText)
                            Text(past.question)
                                .font(.footnote)
                                .foregroundStyle(Theme.dimText)
                            Text(past.answer)
                                .foregroundStyle(Theme.softText)
                        }
                        .card()
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Check-in")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                if let existing = todaysEntry, answer.isEmpty {
                    answer = existing.answer
                }
            }
        }
    }

    private func save() {
        let text = answer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        if let existing = todaysEntry {
            existing.answer = text
            existing.question = todaysQuestion
        } else {
            context.insert(CheckIn(question: todaysQuestion, answer: text))
        }
        NotificationManager.shared.recordActivity()
        justSaved = true
        Task {
            try? await Task.sleep(for: .seconds(2))
            justSaved = false
        }
    }
}

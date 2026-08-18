import SwiftUI
import SwiftData

struct ReframeView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \ReframeEntry.date, order: .reverse) private var entries: [ReframeEntry]

    @State private var thought = ""
    @State private var fact = ""
    @State private var verdict = ""
    @State private var splitting = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if splitting {
                        splitStage
                    } else {
                        writeStage
                    }

                    if !entries.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Earlier")
                                .font(.subheadline)
                                .foregroundStyle(Theme.dimText)
                            ForEach(entries) { entry in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(entry.date.formatted(date: .abbreviated, time: .omitted))
                                        .font(.caption)
                                        .foregroundStyle(Theme.dimText)
                                    Text(entry.fact)
                                        .foregroundStyle(.white.opacity(0.9))
                                    if !entry.verdict.isEmpty {
                                        Text(entry.verdict)
                                            .italic()
                                            .foregroundStyle(Theme.dimText)
                                    }
                                }
                                .card()
                            }
                        }
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Reframe")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var writeStage: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("A harsh thought about yourself")
                .font(.title3.weight(.semibold))
            Text("Write it exactly as it sounds in your head.")
                .font(.subheadline)
                .foregroundStyle(Theme.softText)
            TextField("The thought", text: $thought, axis: .vertical)
                .lineLimit(3...6)
                .padding(14)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            Button {
                let parts = ThoughtSplitter.split(thought)
                fact = parts.fact
                verdict = parts.verdict
                splitting = true
            } label: {
                Text("Take it apart")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
            }
            .buttonStyle(.borderedProminent)
            .disabled(thought.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
    }

    private var splitStage: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Two different things")
                .font(.title3.weight(.semibold))
            Text("One line is what happened. The other is a verdict that got attached to it. Edit them until the split feels right.")
                .font(.subheadline)
                .foregroundStyle(Theme.softText)

            VStack(alignment: .leading, spacing: 8) {
                Text("What happened")
                    .font(.footnote)
                    .foregroundStyle(Theme.accent)
                TextField("Just the facts", text: $fact, axis: .vertical)
                    .lineLimit(2...4)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("The verdict that got attached")
                    .font(.footnote)
                    .foregroundStyle(Theme.dimText)
                TextField("The judgement, if there is one", text: $verdict, axis: .vertical)
                    .lineLimit(2...4)
                    .padding(14)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            Text("The first line is information. The second is opinion.")
                .font(.footnote)
                .foregroundStyle(Theme.dimText)

            HStack(spacing: 12) {
                Button {
                    splitting = false
                } label: {
                    Text("Back")
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                }
                .buttonStyle(.bordered)
                Button {
                    save()
                } label: {
                    Text("Save")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                }
                .buttonStyle(.borderedProminent)
                .disabled(fact.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private func save() {
        let entry = ReframeEntry(
            original: thought.trimmingCharacters(in: .whitespacesAndNewlines),
            fact: fact.trimmingCharacters(in: .whitespacesAndNewlines),
            verdict: verdict.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        context.insert(entry)
        thought = ""
        fact = ""
        verdict = ""
        splitting = false
    }
}

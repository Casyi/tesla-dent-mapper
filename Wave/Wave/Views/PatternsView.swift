import SwiftUI
import SwiftData

struct PatternsView: View {
    @Query(sort: \UrgeLog.date) private var logs: [UrgeLog]
    @Query(sort: \SurfSession.date) private var surfs: [SurfSession]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    let sentences = Patterns.sentences(logs: logs, surfs: surfs)
                    if sentences.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Not enough to go on yet.")
                                .font(.title3.weight(.semibold))
                            Text("Once you have logged five urges, plain sentences about your own patterns will appear here. There is nothing to do in the meantime.")
                                .foregroundStyle(Theme.softText)
                        }
                        .card()
                    } else {
                        Text("What your logs show")
                            .font(.subheadline)
                            .foregroundStyle(Theme.dimText)
                        ForEach(sentences, id: \.self) { sentence in
                            Text(sentence)
                                .font(.body)
                                .foregroundStyle(.white.opacity(0.9))
                                .card()
                        }
                        Text("These are observations, not judgements. They update as you log.")
                            .font(.footnote)
                            .foregroundStyle(Theme.dimText)
                            .padding(.top, 6)
                    }
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Patterns")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

import SwiftUI
import SwiftData

struct LogUrgeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context

    @State private var activity = ""
    @State private var feeling: Feeling?
    @State private var intensity = 5.0
    @State private var action: UrgeAction?

    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    HStack {
                        Text("Time")
                            .foregroundStyle(Theme.dimText)
                        Spacer()
                        Text(Date.now.formatted(date: .omitted, time: .shortened))
                            .foregroundStyle(Theme.softText)
                    }
                    .font(.subheadline)

                    VStack(alignment: .leading, spacing: 10) {
                        Text("What were you doing in the hour before?")
                            .font(.subheadline)
                            .foregroundStyle(Theme.softText)
                        TextField("Optional", text: $activity, axis: .vertical)
                            .lineLimit(2...4)
                            .padding(14)
                            .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("How were you feeling?")
                            .font(.subheadline)
                            .foregroundStyle(Theme.softText)
                        LazyVGrid(columns: columns, spacing: 10) {
                            ForEach(Feeling.allCases) { option in
                                ChoiceChip(label: option.label, selected: feeling == option) {
                                    feeling = option
                                }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("How strong is it?")
                                .font(.subheadline)
                                .foregroundStyle(Theme.softText)
                            Spacer()
                            Text("\(Int(intensity))")
                                .font(.title3.weight(.semibold).monospacedDigit())
                                .foregroundStyle(Theme.accent)
                        }
                        Slider(value: $intensity, in: 1...10, step: 1)
                        HStack {
                            Text("Barely there")
                            Spacer()
                            Text("Very strong")
                        }
                        .font(.caption)
                        .foregroundStyle(Theme.dimText)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("What did you do?")
                            .font(.subheadline)
                            .foregroundStyle(Theme.softText)
                        VStack(spacing: 10) {
                            ForEach(UrgeAction.allCases) { option in
                                ChoiceChip(label: option.rawValue, selected: action == option) {
                                    action = option
                                }
                            }
                        }
                    }

                    Button {
                        save()
                    } label: {
                        Text("Save")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(feeling == nil || action == nil)
                }
                .padding(20)
            }
            .background(Theme.background)
            .navigationTitle("Log an urge")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(Theme.softText)
                }
            }
        }
    }

    private func save() {
        guard let feeling, let action else { return }
        let log = UrgeLog(
            precedingActivity: activity.trimmingCharacters(in: .whitespacesAndNewlines),
            feeling: feeling.rawValue,
            intensity: Int(intensity),
            action: action.rawValue
        )
        context.insert(log)
        NotificationManager.shared.recordActivity()
        dismiss()
    }
}

struct ChoiceChip: View {
    let label: String
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(label)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
        }
        .buttonStyle(.plain)
        .background(
            selected ? Theme.accent.opacity(0.22) : Theme.card,
            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(selected ? Theme.accent : Color.clear, lineWidth: 1)
        )
        .foregroundStyle(selected ? Theme.accent : Theme.softText)
    }
}

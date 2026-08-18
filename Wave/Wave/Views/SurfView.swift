import SwiftUI
import SwiftData
import UIKit

struct SurfView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.scenePhase) private var scenePhase

    @State private var endDate: Date?
    @State private var showFinishSheet = false

    static let duration: TimeInterval = 20 * 60

    private let lines = [
        "A craving is a wave. It rises, it crests, it passes.",
        "You don't have to make it go away. Just watch it.",
        "Peaks are temporary. They always come down.",
        "Notice where in your body you feel it. Give it room.",
        "You're not fighting it. You're outlasting it.",
        "Breathe out a little longer than you breathe in.",
        "It can be loud and still be passing.",
        "Nothing is required of you for the next few minutes."
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                if let endDate {
                    runningView(endDate: endDate)
                } else {
                    idleView
                }
            }
            .navigationTitle("Urge surf")
            .navigationBarTitleDisplayMode(.inline)
        }
        .onChange(of: endDate) { _, newValue in
            UIApplication.shared.isIdleTimerDisabled = newValue != nil
        }
        .onChange(of: scenePhase) { _, phase in
            guard let endDate else { return }
            switch phase {
            case .background:
                NotificationManager.shared.scheduleSurfEnd(after: endDate.timeIntervalSinceNow)
            case .active:
                NotificationManager.shared.cancelSurfEnd()
                if endDate.timeIntervalSinceNow <= 0 {
                    finish()
                }
            default:
                break
            }
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
        }
        .sheet(isPresented: $showFinishSheet) {
            SurfFinishSheet { outcome in
                context.insert(SurfSession(outcome: outcome.rawValue))
                NotificationManager.shared.recordActivity()
            }
            .presentationDetents([.medium])
        }
    }

    private var idleView: some View {
        VStack(spacing: 24) {
            Spacer()
            WaveAnimation(intensity: 0.35)
                .frame(height: 180)
            Text("Urges rise, crest, and pass.\nYou can watch this one do it.")
                .multilineTextAlignment(.center)
                .font(.body)
                .foregroundStyle(Theme.softText)
            Spacer()
            Button {
                endDate = Date().addingTimeInterval(Self.duration)
            } label: {
                Text("Ride it out · 20 minutes")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 60)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 20)
            .padding(.bottom, 30)
        }
    }

    private func runningView(endDate: Date) -> some View {
        TimelineView(.animation(minimumInterval: 1 / 20)) { timeline in
            let remaining = max(0, endDate.timeIntervalSince(timeline.date))
            let elapsed = Self.duration - remaining
            let lineIndex = Int(elapsed / 25) % lines.count
            VStack(spacing: 24) {
                Spacer()
                Text(timeString(remaining))
                    .font(.system(size: 60, weight: .thin, design: .rounded).monospacedDigit())
                    .foregroundStyle(.white.opacity(0.9))
                WaveAnimation(intensity: 1)
                    .frame(height: 200)
                Text(lines[lineIndex])
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.softText)
                    .frame(minHeight: 60)
                    .padding(.horizontal, 30)
                    .animation(.easeInOut(duration: 1), value: lineIndex)
                Spacer()
                Button {
                    stopEarly()
                } label: {
                    Text("Stop")
                        .font(.subheadline)
                        .foregroundStyle(Theme.dimText)
                        .frame(height: 48)
                        .padding(.horizontal, 24)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 20)
            }
        }
        .task(id: endDate) {
            while !Task.isCancelled {
                if endDate.timeIntervalSinceNow <= 0 {
                    finish()
                    break
                }
                try? await Task.sleep(for: .seconds(0.5))
            }
        }
    }

    private func timeString(_ interval: TimeInterval) -> String {
        let total = Int(interval.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    private func finish() {
        guard endDate != nil else { return }
        endDate = nil
        NotificationManager.shared.cancelSurfEnd()
        showFinishSheet = true
    }

    private func stopEarly() {
        endDate = nil
        NotificationManager.shared.cancelSurfEnd()
    }
}

struct SurfFinishSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onSelect: (SurfOutcome) -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text("Twenty minutes passed.")
                .font(.title3.weight(.semibold))
                .padding(.top, 30)
            Text("How is the urge now, compared to when you started?")
                .font(.subheadline)
                .foregroundStyle(Theme.softText)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
            VStack(spacing: 10) {
                ForEach(SurfOutcome.allCases) { outcome in
                    Button {
                        onSelect(outcome)
                        dismiss()
                    } label: {
                        Text(outcome.rawValue)
                            .font(.subheadline.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                    }
                    .buttonStyle(.plain)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .foregroundStyle(Theme.softText)
                }
            }
            .padding(.horizontal, 20)
            Spacer()
        }
        .presentationBackground(Theme.background)
        .interactiveDismissDisabled(false)
    }
}

struct WaveAnimation: View {
    let intensity: Double

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            let breath = (sin(t * 2 * .pi / 9) + 1) / 2
            let amplitude = (10 + 26 * breath) * intensity
            let level = 0.5 + 0.06 * sin(t * 2 * .pi / 13)
            ZStack {
                WaveShape(phase: t * 0.9, amplitude: amplitude, level: level, frequency: 1.6)
                    .fill(Theme.waveDeep.opacity(0.8))
                WaveShape(phase: t * 1.4 + 2, amplitude: amplitude * 0.7, level: level + 0.05, frequency: 2.2)
                    .fill(Theme.waveLight.opacity(0.45))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .padding(.horizontal, 20)
    }
}

struct WaveShape: Shape {
    var phase: Double
    var amplitude: Double
    var level: Double
    var frequency: Double

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.height * level
        path.move(to: CGPoint(x: 0, y: midY + sin(phase) * amplitude))
        var x: CGFloat = 0
        while x <= rect.width {
            let relative = x / rect.width
            let y = midY + sin(relative * frequency * 2 * .pi + phase) * amplitude
            path.addLine(to: CGPoint(x: x, y: y))
            x += 3
        }
        path.addLine(to: CGPoint(x: rect.width, y: rect.height))
        path.addLine(to: CGPoint(x: 0, y: rect.height))
        path.closeSubpath()
        return path
    }
}

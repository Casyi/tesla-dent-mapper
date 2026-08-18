import SwiftUI

enum Theme {
    static let background = Color(red: 0.043, green: 0.055, blue: 0.09)
    static let card = Color(red: 0.09, green: 0.115, blue: 0.165)
    static let cardRaised = Color(red: 0.125, green: 0.155, blue: 0.215)
    static let accent = Color(red: 0.45, green: 0.74, blue: 0.73)
    static let softText = Color(red: 0.60, green: 0.66, blue: 0.74)
    static let dimText = Color(red: 0.42, green: 0.47, blue: 0.55)
    static let waveDeep = Color(red: 0.10, green: 0.24, blue: 0.36)
    static let waveLight = Color(red: 0.20, green: 0.42, blue: 0.55)
}

struct CardBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

extension View {
    func card() -> some View {
        modifier(CardBackground())
    }
}

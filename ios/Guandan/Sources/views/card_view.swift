import SwiftUI
import GuandanCore

struct Card_View: View {
    let card: Card
    let level: Rank
    var selected = false
    var width: CGFloat = 66

    private var height: CGFloat { width * 1.27 }
    private var is_joker: Bool { card.suit == Suit_Joker }
    private var is_red: Bool {
        is_joker ? card.rank == Rank_Red_Joker : is_red_suit(card.suit)
    }
    private var wild: Bool { is_wild(card, level: level) }
    private var ink: Color { is_red ? Color(red: 0.82, green: 0.17, blue: 0.17) : Color(red: 0.1, green: 0.1, blue: 0.1) }

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 4)
                .fill(
                    wild
                        ? LinearGradient(colors: [Color(red: 1, green: 0.99, blue: 0.95), Color(red: 1, green: 0.93, blue: 0.73)], startPoint: .topLeading, endPoint: .bottomTrailing)
                        : LinearGradient(colors: [.white, Color(red: 0.95, green: 0.95, blue: 0.96)], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .strokeBorder(wild ? Color(red: 0.9, green: 0.68, blue: 0.02) : Color(red: 0.79, green: 0.79, blue: 0.82), lineWidth: 1)
                )

            VStack(alignment: .leading, spacing: 0) {
                Text(is_joker ? "王" : get_rank_symbol(card.rank))
                    .font(.system(size: width * 0.29, weight: .bold, design: .monospaced))
                if !is_joker {
                    Text(get_suit_symbol(card.suit))
                        .font(.system(size: width * 0.24))
                }
            }
            .foregroundStyle(ink)
            .padding(3)

            Text(is_joker ? "★" : get_suit_symbol(card.suit))
                .font(.system(size: width * 0.66))
                .foregroundStyle(ink.opacity(0.85))
                .position(x: width * 0.65, y: height * 0.65)

            if selected {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(red: 0.61, green: 0.15, blue: 0.69).opacity(0.35))
            }
        }
        .frame(width: width, height: height)
        .shadow(color: .black.opacity(0.3), radius: 2, y: 1)
    }
}

#Preview {
    HStack {
        Card_View(card: Card(suit: Suit_Spades, rank: Rank_Ace, id: 1), level: Rank_Two)
        Card_View(card: Card(suit: Suit_Hearts, rank: Rank_Two, id: 2), level: Rank_Two, selected: true)
        Card_View(card: Card(suit: Suit_Joker, rank: Rank_Red_Joker, id: 3), level: Rank_Two)
    }
    .padding()
    .background(Color(red: 0.06, green: 0.2, blue: 0.38))
}

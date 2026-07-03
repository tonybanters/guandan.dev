import SwiftUI
import GuandanCore

private struct Combo_Row: Identifiable {
    let name: String
    let note: String
    let cards: [Card]
    var id: String { name }
}

private func c(_ id: Int, _ rank: Rank, _ suit: Suit) -> Card {
    Card(suit: suit, rank: rank, id: id)
}

private let combo_rows: [Combo_Row] = [
    Combo_Row(name: "Single", note: "one card", cards: [c(1, 5, Suit_Spades)]),
    Combo_Row(name: "Pair", note: "two of the same rank", cards: [c(2, 7, Suit_Spades), c(3, 7, Suit_Hearts)]),
    Combo_Row(name: "Triple", note: "three of the same rank", cards: [c(4, 10, Suit_Spades), c(5, 10, Suit_Hearts), c(6, 10, Suit_Diamonds)]),
    Combo_Row(
        name: "Full House", note: "triple plus a pair",
        cards: [c(7, 11, Suit_Spades), c(8, 11, Suit_Hearts), c(9, 11, Suit_Clubs), c(10, 2, Suit_Spades), c(11, 2, Suit_Diamonds)]
    ),
    Combo_Row(
        name: "Straight", note: "five consecutive ranks, ace high or low",
        cards: [c(12, 1, Suit_Diamonds), c(13, 2, Suit_Spades), c(14, 3, Suit_Hearts), c(15, 4, Suit_Clubs), c(16, 5, Suit_Diamonds)]
    ),
    Combo_Row(
        name: "Tube", note: "three consecutive pairs",
        cards: [c(17, 2, Suit_Spades), c(18, 2, Suit_Hearts), c(19, 3, Suit_Clubs), c(20, 3, Suit_Diamonds), c(21, 4, Suit_Spades), c(22, 4, Suit_Hearts)]
    ),
    Combo_Row(
        name: "Plate", note: "two consecutive triples",
        cards: [c(23, 6, Suit_Spades), c(24, 6, Suit_Hearts), c(25, 6, Suit_Diamonds), c(26, 7, Suit_Clubs), c(27, 7, Suit_Spades), c(28, 7, Suit_Hearts)]
    ),
    Combo_Row(
        name: "Bomb", note: "four or more of a kind, beats any non-bomb; more cards = stronger",
        cards: [c(29, 4, Suit_Spades), c(30, 4, Suit_Hearts), c(31, 4, Suit_Diamonds), c(32, 4, Suit_Clubs)]
    ),
    Combo_Row(
        name: "Straight Flush", note: "five consecutive in one suit; beats 4-5 card bombs, loses to 6+ card bombs",
        cards: [c(33, 2, Suit_Hearts), c(34, 3, Suit_Hearts), c(35, 4, Suit_Hearts), c(36, 5, Suit_Hearts), c(37, 6, Suit_Hearts)]
    ),
    Combo_Row(
        name: "Joker Bomb", note: "all four jokers, beats everything",
        cards: [c(38, Rank_Black_Joker, Suit_Joker), c(39, Rank_Black_Joker, Suit_Joker), c(40, Rank_Red_Joker, Suit_Joker), c(41, Rank_Red_Joker, Suit_Joker)]
    ),
    Combo_Row(
        name: "Wild Card", note: "the HEARTS card of the current level substitutes for any card except jokers",
        cards: [c(42, Rank_Two, Suit_Hearts)]
    ),
]

struct Cheat_Sheet_Button: View {
    @State private var open = false

    var body: some View {
        Button {
            open = true
        } label: {
            Text("? combos")
                .font(.system(size: 11))
                .foregroundStyle(Color(red: 0.49, green: 0.78, blue: 0.89))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color(red: 0.49, green: 0.78, blue: 0.89).opacity(0.4), lineWidth: 1)
                )
        }
        .sheet(isPresented: $open) {
            Cheat_Sheet_View()
        }
    }
}

struct Cheat_Sheet_View: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Combos")
                        .font(.headline)
                        .foregroundStyle(.white)
                    Spacer()
                    Button("Close") {
                        dismiss()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.42, green: 0.46, blue: 0.49))
                }
                .padding(.bottom, 8)

                ForEach(combo_rows) { row in
                    HStack(spacing: 10) {
                        Text(row.name)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 78, alignment: .leading)
                        HStack(spacing: -26) {
                            ForEach(Array(row.cards.enumerated()), id: \.element.id) { idx, card in
                                Card_View(card: card, level: Rank_Two, size: .tiny, context: .table)
                                    .zIndex(Double(idx))
                            }
                        }
                        Text(row.note)
                            .font(.system(size: 10))
                            .foregroundStyle(.white.opacity(0.6))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.vertical, 6)
                    Divider()
                        .overlay(Color.white.opacity(0.08))
                }

                Text("Rank order: 2 < 3 < … < A < level card < black joker < red joker. Bombs beat any non-bomb. In straights, tubes and plates the ace can play low (A-2-3-4-5).")
                    .font(.system(size: 11))
                    .foregroundStyle(Color(red: 0.49, green: 0.78, blue: 0.89))
                    .padding(.top, 10)
            }
            .padding(16)
        }
        .background(Color(red: 0.09, green: 0.13, blue: 0.24))
        .presentationDetents([.large, .medium])
    }
}

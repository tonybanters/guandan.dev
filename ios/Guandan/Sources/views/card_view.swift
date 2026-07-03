import SwiftUI
import GuandanCore

enum Card_Size {
    case tiny
    case small
    case normal
}

enum Card_Context {
    case hand
    case table
}

struct Card_Config {
    let width: CGFloat
    let height: CGFloat
    let rank_font: CGFloat
    let suit_font: CGFloat
    let center_font: CGFloat
    // big center pip position as a fraction of the card size
    let center_x: CGFloat
    let center_y: CGFloat
    // strip of a covered card left visible when overlapped in a row / column
    let h_visible: CGFloat
    let v_overlap: CGFloat
}

// proportions taken from the reference guandan app: 1.5 aspect cards, tall
// overlap strips fitting a rank-over-suit corner label
func card_config(_ context: Card_Context, _ size: Card_Size) -> Card_Config {
    switch (context, size) {
    case (.hand, .tiny):
        return Card_Config(width: 54, height: 81, rank_font: 18, suit_font: 11, center_font: 36, center_x: 0.66, center_y: 0.60, h_visible: 38, v_overlap: 28)
    case (.hand, .small):
        return Card_Config(width: 62, height: 93, rank_font: 21, suit_font: 13, center_font: 42, center_x: 0.66, center_y: 0.60, h_visible: 44, v_overlap: 32)
    case (.hand, .normal):
        return Card_Config(width: 76, height: 114, rank_font: 26, suit_font: 16, center_font: 52, center_x: 0.66, center_y: 0.60, h_visible: 52, v_overlap: 38)
    case (.table, .tiny):
        return Card_Config(width: 42, height: 63, rank_font: 17, suit_font: 12, center_font: 18, center_x: 0.68, center_y: 0.58, h_visible: 24, v_overlap: 0)
    case (.table, .small):
        return Card_Config(width: 48, height: 72, rank_font: 21, suit_font: 14, center_font: 22, center_x: 0.68, center_y: 0.58, h_visible: 28, v_overlap: 0)
    case (.table, .normal):
        return Card_Config(width: 60, height: 90, rank_font: 24, suit_font: 16, center_font: 28, center_x: 0.68, center_y: 0.58, h_visible: 32, v_overlap: 0)
    }
}

private let card_font_name = "IosevkaNF-Bold"

struct Card_View: View {
    let card: Card
    let level: Rank
    var selected = false
    // freshly received tribute card: gold ring + glow
    var glowing = false
    var size: Card_Size = .normal
    var context: Card_Context = .hand

    private var cfg: Card_Config { card_config(context, size) }
    private var is_joker: Bool { card.suit == Suit_Joker }
    private var is_red: Bool {
        is_joker ? card.rank == Rank_Red_Joker : is_red_suit(card.suit)
    }
    private var wild: Bool { is_wild(card, level: level) }
    private var ink: Color { is_red ? Color(red: 0.82, green: 0.17, blue: 0.17) : Color(red: 0.1, green: 0.1, blue: 0.1) }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(
                    wild
                        ? LinearGradient(colors: [Color(red: 1, green: 0.99, blue: 0.95), Color(red: 1, green: 0.93, blue: 0.73)], startPoint: .topLeading, endPoint: .bottomTrailing)
                        : LinearGradient(colors: [.white, Color(red: 0.95, green: 0.95, blue: 0.96)], startPoint: .topLeading, endPoint: .bottomTrailing)
                )
                .overlay(
                    Rectangle()
                        .strokeBorder(wild ? Color(red: 0.9, green: 0.68, blue: 0.02) : Color(red: 0.79, green: 0.79, blue: 0.82), lineWidth: 1)
                )

            // big center pip sits under the corner label
            Text(is_joker ? "★" : get_suit_symbol(card.suit))
                .font(.system(size: cfg.center_font))
                .foregroundStyle(ink.opacity(0.85))
                .position(x: cfg.width * cfg.center_x, y: cfg.height * cfg.center_y)

            corner_label
                .padding(3)

            if selected {
                Rectangle()
                    .fill(Color(red: 0.61, green: 0.15, blue: 0.69).opacity(0.35))
            }

            if glowing {
                Rectangle()
                    .strokeBorder(Color(red: 1, green: 0.76, blue: 0.03), lineWidth: 2)
            }
        }
        .frame(width: cfg.width, height: cfg.height)
        .clipShape(Rectangle())
        .shadow(
            color: glowing ? Color(red: 1, green: 0.76, blue: 0.03).opacity(0.9) : .black.opacity(0.3),
            radius: glowing ? 8 : 2,
            y: 1
        )
    }

    // rank over suit like the reference app, so an overlap strip shows both.
    // fixed-height boxes emulate line-height 1, keeping the two fonts from
    // floating on their own metrics.
    private var corner_label: some View {
        VStack(alignment: .center, spacing: 0) {
            tight_text(is_joker ? "王" : get_rank_symbol(card.rank), font: .custom(card_font_name, size: cfg.rank_font), box: cfg.rank_font)
            if !is_joker {
                tight_text(get_suit_symbol(card.suit), font: .system(size: cfg.suit_font), box: cfg.suit_font)
            }
        }
        .foregroundStyle(ink)
    }

    private func tight_text(_ s: String, font: Font, box: CGFloat) -> some View {
        Text(s)
            .font(font)
            .fixedSize()
            .frame(height: box)
    }
}

#Preview {
    VStack(spacing: 12) {
        HStack {
            Card_View(card: Card(suit: Suit_Spades, rank: Rank_Ace, id: 1), level: Rank_Two, size: .small)
            Card_View(card: Card(suit: Suit_Hearts, rank: Rank_Two, id: 2), level: Rank_Two, selected: true, size: .small)
            Card_View(card: Card(suit: Suit_Diamonds, rank: Rank_Ten, id: 4), level: Rank_Two, size: .small)
            Card_View(card: Card(suit: Suit_Joker, rank: Rank_Red_Joker, id: 3), level: Rank_Two, size: .small)
        }
        HStack {
            Card_View(card: Card(suit: Suit_Spades, rank: Rank_Ace, id: 1), level: Rank_Two, size: .small, context: .table)
            Card_View(card: Card(suit: Suit_Hearts, rank: Rank_Two, id: 2), level: Rank_Two, size: .small, context: .table)
            Card_View(card: Card(suit: Suit_Joker, rank: Rank_Black_Joker, id: 3), level: Rank_Two, size: .tiny, context: .table)
        }
    }
    .padding()
    .background(Color(red: 0.06, green: 0.2, blue: 0.38))
}

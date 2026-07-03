import XCTest
@testable import GuandanCore

private func c(_ rank: Rank, _ suit: Suit, _ id: Int) -> Card {
    Card(suit: suit, rank: rank, id: id)
}

final class Combos_Tests: XCTestCase {
    func test_single() {
        let combo = detect_combo([c(Rank_Ace, Suit_Spades, 1)], level: Rank_Two)
        XCTAssertEqual(combo?.type, .single)
        XCTAssertEqual(combo?.value, 14)
    }

    func test_pair() {
        let combo = detect_combo([c(Rank_Five, Suit_Spades, 1), c(Rank_Five, Suit_Hearts, 2)], level: Rank_Three)
        XCTAssertEqual(combo?.type, .pair)
    }

    func test_mismatched_pair_is_nil() {
        let combo = detect_combo([c(Rank_Five, Suit_Spades, 1), c(Rank_Six, Suit_Hearts, 2)], level: Rank_Three)
        XCTAssertNil(combo)
    }

    func test_triple() {
        let cards = [c(Rank_Nine, Suit_Spades, 1), c(Rank_Nine, Suit_Hearts, 2), c(Rank_Nine, Suit_Clubs, 3)]
        XCTAssertEqual(detect_combo(cards, level: Rank_Two)?.type, .triple)
    }

    func test_full_house_value_is_triple_rank() {
        let cards = [
            c(Rank_King, Suit_Spades, 1), c(Rank_King, Suit_Hearts, 2), c(Rank_King, Suit_Clubs, 3),
            c(Rank_Three, Suit_Spades, 4), c(Rank_Three, Suit_Diamonds, 5),
        ]
        let combo = detect_combo(cards, level: Rank_Two)
        XCTAssertEqual(combo?.type, .full_house)
        XCTAssertEqual(combo?.value, get_rank_value(Rank_King, level: Rank_Two))
    }

    func test_straight() {
        let cards = [
            c(Rank_Three, Suit_Spades, 1), c(Rank_Four, Suit_Hearts, 2), c(Rank_Five, Suit_Clubs, 3),
            c(Rank_Six, Suit_Spades, 4), c(Rank_Seven, Suit_Diamonds, 5),
        ]
        XCTAssertEqual(detect_combo(cards, level: Rank_Two)?.type, .straight)
    }

    func test_ace_low_straight() {
        let cards = [
            c(Rank_Ace, Suit_Spades, 1), c(Rank_Two, Suit_Hearts, 2), c(Rank_Three, Suit_Clubs, 3),
            c(Rank_Four, Suit_Spades, 4), c(Rank_Five, Suit_Diamonds, 5),
        ]
        XCTAssertEqual(detect_combo(cards, level: Rank_Six)?.type, .straight)
    }

    func test_wild_fills_straight_gap() {
        let cards = [
            c(Rank_Three, Suit_Spades, 1), c(Rank_Four, Suit_Diamonds, 2), c(Rank_Six, Suit_Clubs, 3),
            c(Rank_Seven, Suit_Spades, 4), c(Rank_Two, Suit_Hearts, 5),
        ]
        XCTAssertEqual(detect_combo(cards, level: Rank_Two)?.type, .straight)
    }

    func test_wild_completes_straight_flush() {
        let cards = [
            c(Rank_Three, Suit_Spades, 1), c(Rank_Four, Suit_Spades, 2), c(Rank_Five, Suit_Spades, 3),
            c(Rank_Seven, Suit_Spades, 4), c(Rank_Nine, Suit_Hearts, 5),
        ]
        XCTAssertEqual(detect_combo(cards, level: Rank_Nine)?.type, .straight_flush)
    }

    func test_contiguous_wild_counts_as_natural_rank() {
        let cards = [
            c(Rank_Three, Suit_Spades, 1), c(Rank_Four, Suit_Spades, 2), c(Rank_Five, Suit_Spades, 3),
            c(Rank_Six, Suit_Spades, 4), c(Rank_Two, Suit_Hearts, 5),
        ]
        XCTAssertEqual(detect_combo(cards, level: Rank_Two)?.type, .straight)
    }

    func test_tube() {
        let cards = [
            c(Rank_Three, Suit_Spades, 1), c(Rank_Three, Suit_Hearts, 2),
            c(Rank_Four, Suit_Clubs, 3), c(Rank_Four, Suit_Diamonds, 4),
        ]
        XCTAssertEqual(detect_combo(cards, level: Rank_Two)?.type, .tube)
    }

    func test_plate() {
        let cards = [
            c(Rank_Three, Suit_Spades, 1), c(Rank_Three, Suit_Hearts, 2), c(Rank_Three, Suit_Clubs, 3),
            c(Rank_Four, Suit_Spades, 4), c(Rank_Four, Suit_Diamonds, 5), c(Rank_Four, Suit_Clubs, 6),
        ]
        XCTAssertEqual(detect_combo(cards, level: Rank_Two)?.type, .plate)
    }

    func test_joker_bomb_value() {
        let cards = [
            c(Rank_Black_Joker, Suit_Joker, 1), c(Rank_Black_Joker, Suit_Joker, 2),
            c(Rank_Red_Joker, Suit_Joker, 3), c(Rank_Red_Joker, Suit_Joker, 4),
        ]
        let combo = detect_combo(cards, level: Rank_Two)
        XCTAssertEqual(combo?.type, .joker_bomb)
        XCTAssertEqual(combo?.value, 1000)
    }

    func test_bomb_vs_straight_flush_ordering() {
        let sf = detect_combo([
            c(Rank_Ten, Suit_Spades, 1), c(Rank_Jack, Suit_Spades, 2), c(Rank_Queen, Suit_Spades, 3),
            c(Rank_King, Suit_Spades, 4), c(Rank_Ace, Suit_Spades, 5),
        ], level: Rank_Two)!

        let bomb_4 = detect_combo([
            c(Rank_Ace, Suit_Spades, 6), c(Rank_Ace, Suit_Hearts, 7),
            c(Rank_Ace, Suit_Clubs, 8), c(Rank_Ace, Suit_Diamonds, 9),
        ], level: Rank_Two)!

        let bomb_6 = detect_combo([
            c(Rank_Three, Suit_Spades, 10), c(Rank_Three, Suit_Hearts, 11), c(Rank_Three, Suit_Clubs, 12),
            c(Rank_Three, Suit_Diamonds, 13), c(Rank_Three, Suit_Spades, 14), c(Rank_Three, Suit_Hearts, 15),
        ], level: Rank_Two)!

        XCTAssertEqual(sf.type, .straight_flush)
        XCTAssertEqual(bomb_4.type, .bomb_4)
        XCTAssertEqual(bomb_6.type, .bomb_6)
        XCTAssertLessThan(bomb_4.value, sf.value)
        XCTAssertGreaterThan(bomb_6.value, sf.value)
    }

    func test_level_card_value() {
        XCTAssertEqual(get_rank_value(Rank_Seven, level: Rank_Seven), 98)
        XCTAssertEqual(get_rank_value(Rank_Ace, level: Rank_Seven), 14)
        // 2 is the lowest natural rank, matching the server's ordering
        XCTAssertLessThan(
            get_rank_value(Rank_Two, level: Rank_Seven),
            get_rank_value(Rank_Three, level: Rank_Seven)
        )
        XCTAssertLessThan(
            get_rank_value(Rank_Two, level: Rank_Seven),
            get_rank_value(Rank_Ace, level: Rank_Seven)
        )
    }
}

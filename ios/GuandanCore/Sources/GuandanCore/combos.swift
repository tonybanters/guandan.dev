public enum Combo_Type: String, Sendable {
    case single
    case pair
    case triple
    case full_house
    case straight
    case tube
    case plate
    case bomb_4
    case bomb_5
    case bomb_6
    case bomb_7
    case bomb_8
    case straight_flush
    case joker_bomb
}

public struct Detected_Combo: Sendable {
    public let type: Combo_Type
    public let cards: [Card]
    public let value: Int

    public init(type: Combo_Type, cards: [Card], value: Int) {
        self.type = type
        self.cards = cards
        self.value = value
    }
}

/*
 * detect what combo a set of cards forms, mirroring the server rules.
 * the heart level card acts as a wild that can fill gaps in straights
 * and straight flushes. returns nil when the cards form nothing playable.
 * value is only comparable between combos of the same type, except bombs
 * and straight flushes which share the +n*100 / +500 scales.
 */
public func detect_combo(_ cards: [Card], level: Rank) -> Detected_Combo? {
    if cards.isEmpty { return nil }

    let sorted = cards.sorted { $0.rank < $1.rank }
    let n = sorted.count

    if n == 4 && sorted.allSatisfy({ $0.rank == Rank_Black_Joker || $0.rank == Rank_Red_Joker }) {
        return Detected_Combo(type: .joker_bomb, cards: cards, value: 1000)
    }

    let by_rank = Dictionary(grouping: sorted) { $0.rank }

    if n == 1 {
        return Detected_Combo(type: .single, cards: cards, value: get_card_value(sorted[0], level: level))
    }

    if n == 2 && by_rank.count == 1 {
        return Detected_Combo(type: .pair, cards: cards, value: get_card_value(sorted[0], level: level))
    }

    if n == 3 && by_rank.count == 1 {
        return Detected_Combo(type: .triple, cards: cards, value: get_card_value(sorted[0], level: level))
    }

    if by_rank.count == 1 && n >= 4 && n <= 8 {
        let bomb_types: [Int: Combo_Type] = [4: .bomb_4, 5: .bomb_5, 6: .bomb_6, 7: .bomb_7, 8: .bomb_8]
        return Detected_Combo(type: bomb_types[n]!, cards: cards, value: get_card_value(sorted[0], level: level) + n * 100)
    }

    if n == 5 {
        let counts = by_rank.values.map { $0.count }.sorted()
        if counts == [2, 3] {
            let triple_rank = by_rank.first { $0.value.count == 3 }!.key
            return Detected_Combo(type: .full_house, cards: cards, value: get_rank_value(triple_rank, level: level))
        }
    }

    if n >= 5 {
        if by_rank.count == n {
            let ranks = sorted.map { $0.rank }
            if let high = consecutive_high_rank(ranks) {
                if sorted.allSatisfy({ $0.suit == sorted[0].suit }) {
                    return Detected_Combo(type: .straight_flush, cards: cards, value: get_rank_value(high, level: level) + 500 + n * 10)
                }
                return Detected_Combo(type: .straight, cards: cards, value: get_rank_value(high, level: level))
            }
        }

        let wilds = sorted.filter { $0.rank == level && $0.suit == Suit_Hearts }
        let non_wild = sorted.filter { !($0.rank == level && $0.suit == Suit_Hearts) }

        if !wilds.isEmpty && !non_wild.isEmpty {
            let unique_ranks = Set(non_wild.map { $0.rank })

            var start = -1
            while start <= 12 - n + 1 {
                var gaps = 0
                for i in 0..<n {
                    let rank = start + i == -1 ? 12 : start + i
                    if !unique_ranks.contains(rank) {
                        gaps += 1
                    }
                }
                if gaps <= wilds.count && gaps + unique_ranks.count == n {
                    let high_rank = start + n - 1
                    let flush_suit = non_wild[0].suit
                    if non_wild.allSatisfy({ $0.suit == flush_suit }) {
                        return Detected_Combo(type: .straight_flush, cards: cards, value: get_rank_value(high_rank, level: level) + 500 + n * 10)
                    }
                    return Detected_Combo(type: .straight, cards: cards, value: get_rank_value(high_rank, level: level))
                }
                start += 1
            }
        }
    }

    if n >= 4 && n % 2 == 0 {
        if by_rank.values.allSatisfy({ $0.count == 2 }) {
            if let high = consecutive_high_rank(Array(by_rank.keys)) {
                return Detected_Combo(type: .tube, cards: cards, value: get_rank_value(high, level: level))
            }
        }
    }

    if n >= 6 && n % 3 == 0 {
        if by_rank.values.allSatisfy({ $0.count == 3 }) {
            if let high = consecutive_high_rank(Array(by_rank.keys)) {
                return Detected_Combo(type: .plate, cards: cards, value: get_rank_value(high, level: level))
            }
        }
    }

    return nil
}

/*
 * returns the effective high rank of a consecutive run, or nil if the
 * ranks are not consecutive. the ace (rank 12) may wrap low, so
 * a-2-3-4-5 is a run with high rank 3 (the five).
 */
func consecutive_high_rank(_ ranks: [Rank]) -> Rank? {
    let sorted = ranks.sorted()

    func is_run(_ arr: [Int]) -> Bool {
        for i in 1..<arr.count {
            if arr[i] != arr[i - 1] + 1 { return false }
        }
        return true
    }

    if is_run(sorted) { return sorted[sorted.count - 1] }

    if sorted.contains(Rank_Ace) {
        let wrapped = sorted.map { $0 == Rank_Ace ? -1 : $0 }.sorted()
        if is_run(wrapped) { return wrapped[wrapped.count - 1] }
    }

    return nil
}

public func get_card_value(_ card: Card, level: Rank) -> Int {
    return get_rank_value(card.rank, level: level)
}

public func get_rank_value(_ rank: Rank, level: Rank) -> Int {
    if rank == Rank_Red_Joker { return 100 }
    if rank == Rank_Black_Joker { return 99 }
    if rank == level { return 98 }
    if rank == Rank_Two { return 15 }
    if rank == Rank_Ace { return 14 }
    return rank + 2
}

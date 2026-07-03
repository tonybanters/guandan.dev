public typealias Suit = Int
public typealias Rank = Int

public let Suit_Hearts: Suit = 0
public let Suit_Diamonds: Suit = 1
public let Suit_Clubs: Suit = 2
public let Suit_Spades: Suit = 3
public let Suit_Joker: Suit = 4

public let Rank_Two: Rank = 0
public let Rank_Three: Rank = 1
public let Rank_Four: Rank = 2
public let Rank_Five: Rank = 3
public let Rank_Six: Rank = 4
public let Rank_Seven: Rank = 5
public let Rank_Eight: Rank = 6
public let Rank_Nine: Rank = 7
public let Rank_Ten: Rank = 8
public let Rank_Jack: Rank = 9
public let Rank_Queen: Rank = 10
public let Rank_King: Rank = 11
public let Rank_Ace: Rank = 12
public let Rank_Black_Joker: Rank = 13
public let Rank_Red_Joker: Rank = 14

public struct Card: Codable, Identifiable, Hashable, Sendable {
    public let suit: Suit
    public let rank: Rank
    public let id: Int

    enum CodingKeys: String, CodingKey {
        case suit = "Suit"
        case rank = "Rank"
        case id = "Id"
    }

    public init(suit: Suit, rank: Rank, id: Int) {
        self.suit = suit
        self.rank = rank
        self.id = id
    }
}

public struct Player_Info: Codable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let seat: Int
    public let team: Int
    public let is_ready: Bool

    public init(id: String, name: String, seat: Int, team: Int, is_ready: Bool) {
        self.id = id
        self.name = name
        self.seat = seat
        self.team = team
        self.is_ready = is_ready
    }
}

public struct Tribute_Event: Identifiable, Sendable {
    public enum Kind: String, Sendable {
        case pay
        case ret = "return"
        case kang_gong
    }

    public let id: Int
    public let kind: Kind
    public let from_seat: Int
    public let to_seat: Int
    public let card: Card?

    public init(id: Int, kind: Kind, from_seat: Int, to_seat: Int, card: Card?) {
        self.id = id
        self.kind = kind
        self.from_seat = from_seat
        self.to_seat = to_seat
        self.card = card
    }
}

public func get_suit_symbol(_ suit: Suit) -> String {
    let symbols = ["♥", "♦", "♣", "♠", ""]
    return symbols[suit]
}

public func get_rank_symbol(_ rank: Rank) -> String {
    let symbols = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "🃏", "🃏"]
    return symbols[rank]
}

public func is_red_suit(_ suit: Suit) -> Bool {
    return suit == Suit_Hearts || suit == Suit_Diamonds
}

public func is_wild(_ card: Card, level: Rank) -> Bool {
    return card.suit == Suit_Hearts && card.rank == level
}

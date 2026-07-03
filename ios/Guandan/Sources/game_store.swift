import Foundation
import Observation
import GuandanCore

struct Player_Play {
    let cards: [Card]
    let is_pass: Bool
}

enum Tribute_Mode {
    case give
    case ret
}

@MainActor
@Observable
final class Game_Store {
    var room_id: String?
    var players: [Player_Info] = []
    var your_id = ""
    var is_host = false
    var game_active = false
    var is_quick_match = false

    var hand: [Card] = []
    var level: Rank = Rank_Two
    var current_turn = 0
    var my_seat = 0
    var can_pass = false
    var selected_ids: Set<Int> = []
    var player_card_counts: [Int] = [27, 27, 27, 27]
    var team_levels: [Int] = [Rank_Two, Rank_Two]
    var player_plays: [Int: Player_Play] = [:]
    var leading_seat: Int?
    var combo_type = ""
    var last_error: String?
    // seat -> display name; overlaid with "(disconnected)" while a player is away
    var names_by_seat: [Int: String] = [:]

    // tribute exchange: seat i owe a card to / seat awaiting my return card
    var tribute_target: Int?
    var return_target: Int?
    // public feed of tribute cards changing hands; cleared on the next turn
    var tribute_events: [Tribute_Event] = []
    private var tribute_event_id = 0
    // card just received via tribute; glows in the hand until play starts
    var received_tribute_id: Int?

    var in_queue = false
    var queue_found = 1

    // set before create_room so the first room_state auto-fills bots and starts
    var practice_pending = false

    // team (0 or 1) that won the most recent hand; nil between resets
    var round_winner: Int?
    // set on game_end => non-nil means the match is over
    var game_winner: Int?
    // transient end-of-hand / end-of-game message shown over the table
    var hand_banner: String?

    private var error_seq = 0
    private var banner_seq = 0

    var is_my_turn: Bool {
        game_active && current_turn == my_seat
    }

    var tribute_mode: Tribute_Mode? {
        if tribute_target != nil { return .give }
        if return_target != nil { return .ret }
        return nil
    }

    func seat_name(_ seat: Int) -> String {
        names_by_seat[seat] ?? "P\(seat + 1)"
    }

    func handle(_ msg: Incoming_Message) {
        switch msg.type {
        case .room_state:
            guard let p = try? msg.payload(Room_State_Payload.self) else { return }
            room_id = p.room_id
            players = p.players
            your_id = p.your_id
            is_host = p.is_host
            game_active = p.game_active
            is_quick_match = p.quick_match
            in_queue = false
            if let me = p.players.first(where: { $0.id == p.your_id }) {
                my_seat = me.seat
            }
            names_by_seat = Dictionary(uniqueKeysWithValues: p.players.map { ($0.seat, $0.name) })

        case .deal_cards:
            guard let p = try? msg.payload(Deal_Cards_Payload.self) else { return }
            hand = sort_cards(p.cards, level: p.level)
            level = p.level
            game_active = true
            // nobody's turn until the server says so; otherwise the previous
            // hand's stale turn shows action buttons during the tribute window
            current_turn = -1
            selected_ids = []
            player_plays = [:]
            leading_seat = nil
            combo_type = ""
            round_winner = nil
            game_winner = nil
            tribute_target = nil
            return_target = nil
            tribute_events = []
            received_tribute_id = nil
            player_card_counts = [27, 27, 27, 27]

        case .turn:
            guard let p = try? msg.payload(Turn_Payload.self) else { return }
            current_turn = p.seat
            can_pass = p.can_pass
            tribute_events = []
            received_tribute_id = nil
            // a lead turn (no passing allowed) starts a fresh trick
            if !p.can_pass {
                player_plays = [:]
                leading_seat = nil
            }

        case .play_made:
            guard let p = try? msg.payload(Play_Made_Payload.self) else { return }
            let cards = p.cards ?? []
            player_plays[p.seat] = Player_Play(cards: cards, is_pass: p.is_pass)
            if !p.is_pass {
                leading_seat = p.seat
                combo_type = p.combo_type ?? ""
                if player_card_counts.indices.contains(p.seat) {
                    player_card_counts[p.seat] -= cards.count
                }
                if p.seat == my_seat {
                    let played = Set(cards.map { $0.id })
                    hand.removeAll { played.contains($0.id) }
                }
            }

        case .reconnect_success:
            guard let p = try? msg.payload(Reconnect_Success_Payload.self) else { return }
            room_id = p.room_id
            players = p.players
            your_id = p.your_id
            my_seat = p.seat
            hand = sort_cards(p.cards ?? [], level: p.level)
            level = p.level
            current_turn = p.current_turn
            can_pass = p.can_pass
            combo_type = p.combo_type ?? ""
            player_card_counts = p.card_counts
            team_levels = p.team_levels
            leading_seat = p.leading_seat >= 0 ? p.leading_seat : nil
            game_active = p.game_active
            selected_ids = []
            player_plays = [:]
            names_by_seat = Dictionary(uniqueKeysWithValues: p.players.map { ($0.seat, $0.name) })
            // the server does not replay tribute prompts or end-of-hand
            // banners on reconnect, so stale overlays must not survive it
            tribute_target = nil
            return_target = nil
            tribute_events = []
            hand_banner = nil
            round_winner = nil
            game_winner = nil

        case .hand_end:
            guard let p = try? msg.payload(Hand_End_Payload.self) else { return }
            if p.new_levels.count == 2 { team_levels = p.new_levels }
            round_winner = p.winning_team
            show_banner("team \(p.winning_team + 1) won the hand · now playing \(get_rank_symbol(team_levels[p.winning_team]))")

        case .game_end:
            guard let p = try? msg.payload(Game_End_Payload.self) else { return }
            if p.final_levels.count == 2 { team_levels = p.final_levels }
            round_winner = p.winning_team
            game_winner = p.winning_team
            show_banner("team \(p.winning_team + 1) wins the game!")

        case .tribute:
            guard let p = try? msg.payload(Tribute_Payload.self) else { return }
            tribute_target = p.to_seat

        case .tribute_return:
            guard let p = try? msg.payload(Tribute_Return_Payload.self) else { return }
            return_target = p.to_seat

        case .tribute_recv:
            guard let p = try? msg.payload(Tribute_Recv_Payload.self) else { return }
            hand = sort_cards(hand + [p.card], level: level)
            received_tribute_id = p.card.id

        case .tribute_give_ok:
            guard let p = try? msg.payload(Tribute_Ok_Payload.self) else { return }
            tribute_target = nil
            hand.removeAll { $0.id == p.card_id }
            selected_ids = []

        case .tribute_return_ok:
            guard let p = try? msg.payload(Tribute_Ok_Payload.self) else { return }
            return_target = nil
            hand.removeAll { $0.id == p.card_id }
            selected_ids = []

        case .tribute_paid:
            guard let p = try? msg.payload(Tribute_Public_Payload.self) else { return }
            push_tribute_event(.pay, from: p.from_seat, to: p.to_seat, card: p.card)

        case .tribute_returned:
            guard let p = try? msg.payload(Tribute_Public_Payload.self) else { return }
            push_tribute_event(.ret, from: p.from_seat, to: p.to_seat, card: p.card)

        case .kang_gong:
            push_tribute_event(.kang_gong, from: -1, to: -1, card: nil)

        case .queue_status:
            guard let p = try? msg.payload(Queue_Status_Payload.self) else { return }
            queue_found = p.found
            in_queue = true

        case .requeued:
            room_id = nil
            game_active = false
            players = []
            hand = []
            selected_ids = []
            player_plays = [:]
            round_winner = nil
            game_winner = nil
            hand_banner = nil
            tribute_target = nil
            return_target = nil
            tribute_events = []
            in_queue = true
            queue_found = 1

        case .player_disconnected:
            guard let p = try? msg.payload(Player_Status_Payload.self) else { return }
            names_by_seat[p.seat] = "\(names_by_seat[p.seat] ?? p.name) (disconnected)"

        case .player_reconnected:
            guard let p = try? msg.payload(Player_Status_Payload.self) else { return }
            names_by_seat[p.seat] = p.name

        case .error:
            // a failed create_room must not leave the practice intent armed,
            // or the next room the user creates would auto-start with bots
            practice_pending = false
            last_error = (try? msg.payload(Error_Payload.self))?.message
            error_seq += 1
            let seq = error_seq
            Task {
                try? await Task.sleep(for: .seconds(3))
                if seq == error_seq { last_error = nil }
            }

        default:
            break
        }
    }

    // consumed by the app after each message: a freshly created practice room
    // gets bots and starts immediately, mirroring the web client's flow
    func consume_practice_start() -> Bool {
        guard practice_pending, room_id != nil, is_host, !game_active else { return false }
        practice_pending = false
        return true
    }

    // full reset back to the home screen after leaving a room
    func reset() {
        room_id = nil
        players = []
        is_host = false
        game_active = false
        is_quick_match = false
        hand = []
        selected_ids = []
        player_plays = [:]
        player_card_counts = [27, 27, 27, 27]
        leading_seat = nil
        combo_type = ""
        names_by_seat = [:]
        tribute_target = nil
        return_target = nil
        tribute_events = []
        received_tribute_id = nil
        in_queue = false
        round_winner = nil
        game_winner = nil
        hand_banner = nil
        practice_pending = false
    }

    func toggle_selection(_ id: Int) {
        if selected_ids.contains(id) {
            selected_ids.remove(id)
        } else {
            selected_ids.insert(id)
        }
    }

    func clear_selection() {
        selected_ids = []
    }

    // select every card of the rank, or deselect them all if already selected
    func select_same_rank(_ rank: Rank) {
        let ids = hand.filter { $0.rank == rank }.map { $0.id }
        if ids.allSatisfy({ selected_ids.contains($0) }) {
            for id in ids { selected_ids.remove(id) }
        } else {
            for id in ids { selected_ids.insert(id) }
        }
    }

    private func push_tribute_event(_ kind: Tribute_Event.Kind, from: Int, to: Int, card: Card?) {
        tribute_event_id += 1
        tribute_events.append(Tribute_Event(id: tribute_event_id, kind: kind, from_seat: from, to_seat: to, card: card))
    }

    // the server deals the next hand immediately after hand_end and only
    // delays the first turn, so the banner dismisses on its own timer
    // instead of being cleared by deal_cards
    private func show_banner(_ text: String) {
        hand_banner = text
        banner_seq += 1
        let seq = banner_seq
        Task {
            try? await Task.sleep(for: .seconds(8))
            if seq == banner_seq { hand_banner = nil }
        }
    }
}

#if DEBUG
extension Game_Store {
    // deterministic offline state for layout work: launch with -mock_game
    func load_mock_game() {
        let deal: [(Suit, Rank)] = [
            (Suit_Joker, Rank_Red_Joker), (Suit_Joker, Rank_Black_Joker),
            (Suit_Hearts, Rank_Two), (Suit_Clubs, Rank_Two),
            (Suit_Spades, Rank_Ace), (Suit_Hearts, Rank_Ace), (Suit_Diamonds, Rank_Ace),
            (Suit_Diamonds, Rank_Queen),
            (Suit_Spades, Rank_Jack), (Suit_Clubs, Rank_Jack),
            (Suit_Spades, Rank_Ten), (Suit_Spades, Rank_Nine),
            (Suit_Hearts, Rank_Eight), (Suit_Diamonds, Rank_Eight),
            (Suit_Clubs, Rank_Seven), (Suit_Hearts, Rank_Seven),
            (Suit_Clubs, Rank_Six), (Suit_Hearts, Rank_Six), (Suit_Diamonds, Rank_Six),
            (Suit_Spades, Rank_Five),
            (Suit_Spades, Rank_Four), (Suit_Hearts, Rank_Four), (Suit_Clubs, Rank_Four), (Suit_Diamonds, Rank_Four), (Suit_Spades, Rank_Four),
            (Suit_Spades, Rank_Three), (Suit_Hearts, Rank_Three),
            (Suit_Diamonds, Rank_Two),
        ]
        hand = sort_cards(deal.enumerated().map { Card(suit: $1.0, rank: $1.1, id: $0 + 1) }, level: Rank_Two)
        level = Rank_Two
        game_active = true
        my_seat = 0
        current_turn = 0
        can_pass = true
        player_card_counts = [hand.count, 27, 8, 27]
        names_by_seat = [0: "You", 1: "Bot Alice", 2: "Bot Bob", 3: "Bot Charlie"]
        players = names_by_seat.map { Player_Info(id: "p\($0.key)", name: $0.value, seat: $0.key, team: $0.key % 2, is_ready: true) }
        player_plays = [
            1: Player_Play(cards: [
                Card(suit: Suit_Spades, rank: Rank_Three, id: 101),
                Card(suit: Suit_Diamonds, rank: Rank_Four, id: 102),
                Card(suit: Suit_Diamonds, rank: Rank_Five, id: 103),
                Card(suit: Suit_Diamonds, rank: Rank_Six, id: 104),
                Card(suit: Suit_Spades, rank: Rank_Seven, id: 105),
            ], is_pass: false),
            2: Player_Play(cards: [Card(suit: Suit_Diamonds, rank: Rank_Eight, id: 120)], is_pass: false),
            3: Player_Play(cards: [
                Card(suit: Suit_Diamonds, rank: Rank_Nine, id: 107),
                Card(suit: Suit_Clubs, rank: Rank_King, id: 108),
                Card(suit: Suit_Spades, rank: Rank_Nine, id: 109),
                Card(suit: Suit_Diamonds, rank: Rank_King, id: 110),
                Card(suit: Suit_Spades, rank: Rank_King, id: 111),
            ], is_pass: false),
        ]
        leading_seat = 3

        // the between-hands tribute window: empty table, no one's turn yet,
        // tribute lines and the hand banner on display
        if ProcessInfo.processInfo.arguments.contains("-mock_tribute") {
            player_plays = [:]
            leading_seat = nil
            current_turn = -1
            tribute_events = [
                Tribute_Event(id: 1, kind: .pay, from_seat: 3, to_seat: 1, card: Card(suit: Suit_Diamonds, rank: Rank_Three, id: 201)),
                Tribute_Event(id: 2, kind: .ret, from_seat: 1, to_seat: 3, card: Card(suit: Suit_Diamonds, rank: Rank_Two, id: 202)),
            ]
            hand_banner = "team 2 won the hand · now playing 3"
            received_tribute_id = hand.first { $0.rank == Rank_Queen }?.id
        }
    }
}
#endif

// hand order: low to high, level card and jokers on top; ties break by suit
func sort_cards(_ cards: [Card], level: Rank) -> [Card] {
    cards.sorted { a, b in
        let va = card_sort_value(a, level: level)
        let vb = card_sort_value(b, level: level)
        if va != vb { return va < vb }
        return a.suit < b.suit
    }
}

private func card_sort_value(_ card: Card, level: Rank) -> Int {
    if card.rank == Rank_Red_Joker { return 100 }
    if card.rank == Rank_Black_Joker { return 99 }
    if card.rank == level { return 98 }
    return card.rank
}

import Foundation
import Observation
import GuandanCore

struct Player_Play {
    let cards: [Card]
    let is_pass: Bool
}

@MainActor
@Observable
final class Game_Store {
    var room_id: String?
    var players: [Player_Info] = []
    var your_id = ""
    var is_host = false
    var game_active = false

    var hand: [Card] = []
    var level: Rank = Rank_Two
    var current_turn = 0
    var my_seat = 0
    var can_pass = false
    var selected_ids: Set<Int> = []
    var player_card_counts: [Int] = [0, 0, 0, 0]
    var team_levels: [Int] = [Rank_Two, Rank_Two]
    var player_plays: [Int: Player_Play] = [:]
    var leading_seat: Int?
    var combo_type = ""
    var last_error: String?

    var is_my_turn: Bool {
        game_active && current_turn == my_seat
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
            if let me = p.players.first(where: { $0.id == p.your_id }) {
                my_seat = me.seat
            }

        case .deal_cards:
            guard let p = try? msg.payload(Deal_Cards_Payload.self) else { return }
            hand = p.cards
            level = p.level
            game_active = true
            selected_ids = []
            player_plays = [:]
            leading_seat = nil

        case .turn:
            guard let p = try? msg.payload(Turn_Payload.self) else { return }
            current_turn = p.seat
            can_pass = p.can_pass

        case .play_made:
            guard let p = try? msg.payload(Play_Made_Payload.self) else { return }
            player_plays[p.seat] = Player_Play(cards: p.cards, is_pass: p.is_pass)
            if !p.is_pass {
                leading_seat = p.seat
                combo_type = p.combo_type
                if p.seat == my_seat {
                    let played = Set(p.cards.map { $0.id })
                    hand.removeAll { played.contains($0.id) }
                }
            }

        case .reconnect_success:
            guard let p = try? msg.payload(Reconnect_Success_Payload.self) else { return }
            room_id = p.room_id
            players = p.players
            your_id = p.your_id
            my_seat = p.seat
            hand = p.cards
            level = p.level
            current_turn = p.current_turn
            can_pass = p.can_pass
            combo_type = p.combo_type
            player_card_counts = p.card_counts
            team_levels = p.team_levels
            leading_seat = p.leading_seat >= 0 ? p.leading_seat : nil
            game_active = p.game_active

        case .error:
            last_error = (try? msg.payload(Error_Payload.self))?.message

        default:
            break
        }
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

    func select_same_rank(_ rank: Rank) {
        for card in hand where card.rank == rank {
            selected_ids.insert(card.id)
        }
    }
}

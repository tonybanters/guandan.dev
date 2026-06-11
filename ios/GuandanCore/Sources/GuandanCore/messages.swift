import Foundation

public enum Msg_Type: String, Codable, Sendable {
    case join_room
    case create_room
    case room_state
    case game_start
    case deal_cards
    case play_cards
    case pass
    case turn
    case play_made
    case hand_end
    case tribute
    case tribute_give
    case tribute_recv
    case tribute_return
    case tribute_return_give
    case game_end
    case error
    case player_joined
    case player_left
    case fill_bots
    case reconnect
    case reconnect_success
    case player_disconnected
    case player_reconnected
    case start_game
    case pick_seat
    case ready
    case leave_room
    case queue_join
    case queue_leave
    case queue_status
    case requeued
    case tribute_paid
    case tribute_returned
    case kang_gong
}

public struct Empty_Payload: Codable, Sendable {
    public init() {}
}

public struct Incoming_Message: Sendable {
    public let type: Msg_Type
    public let raw: Data

    public init?(text: String) {
        struct Head: Decodable {
            let type: String
        }
        guard let data = text.data(using: .utf8),
              let head = try? JSONDecoder().decode(Head.self, from: data),
              let type = Msg_Type(rawValue: head.type)
        else { return nil }
        self.type = type
        self.raw = data
    }

    public func payload<T: Decodable>(_ payload_type: T.Type) throws -> T {
        return try JSONDecoder().decode(Payload_Body<T>.self, from: raw).payload
    }
}

private struct Payload_Body<T: Decodable>: Decodable {
    let payload: T
}

private struct Outgoing_Envelope<T: Encodable>: Encodable {
    let type: Msg_Type
    let payload: T
}

public func encode_message<T: Encodable>(_ type: Msg_Type, _ payload: T) throws -> String {
    let data = try JSONEncoder().encode(Outgoing_Envelope(type: type, payload: payload))
    return String(decoding: data, as: UTF8.self)
}

public struct Create_Room_Payload: Codable, Sendable {
    public let player_name: String
    public init(player_name: String) { self.player_name = player_name }
}

public struct Join_Room_Payload: Codable, Sendable {
    public let room_id: String
    public let player_name: String
    public init(room_id: String, player_name: String) {
        self.room_id = room_id
        self.player_name = player_name
    }
}

public struct Queue_Join_Payload: Codable, Sendable {
    public let player_name: String
    public init(player_name: String) { self.player_name = player_name }
}

public struct Pick_Seat_Payload: Codable, Sendable {
    public let seat: Int
    public init(seat: Int) { self.seat = seat }
}

public struct Play_Cards_Payload: Codable, Sendable {
    public let card_ids: [Int]
    public init(card_ids: [Int]) { self.card_ids = card_ids }
}

public struct Tribute_Card_Payload: Codable, Sendable {
    public let card_id: Int
    public init(card_id: Int) { self.card_id = card_id }
}

public struct Reconnect_Payload: Codable, Sendable {
    public let session_token: String
    public let room_id: String
    public init(session_token: String, room_id: String) {
        self.session_token = session_token
        self.room_id = room_id
    }
}

public struct Room_State_Payload: Codable, Sendable {
    public let room_id: String
    public let players: [Player_Info]
    public let game_active: Bool
    public let your_id: String
    public let is_host: Bool
    public let quick_match: Bool
    public let session_token: String?
}

public struct Deal_Cards_Payload: Codable, Sendable {
    public let cards: [Card]
    public let level: Rank
}

public struct Turn_Payload: Codable, Sendable {
    public let player_id: String
    public let seat: Int
    public let can_pass: Bool
}

public struct Play_Made_Payload: Codable, Sendable {
    public let player_id: String
    public let seat: Int
    public let cards: [Card]
    public let combo_type: String
    public let is_pass: Bool
}

public struct Error_Payload: Codable, Sendable {
    public let message: String
}

public struct Reconnect_Success_Payload: Codable, Sendable {
    public let session_token: String
    public let room_id: String
    public let players: [Player_Info]
    public let your_id: String
    public let seat: Int
    public let cards: [Card]
    public let level: Rank
    public let current_turn: Int
    public let can_pass: Bool
    public let table_cards: [Card]
    public let combo_type: String
    public let card_counts: [Int]
    public let team_levels: [Int]
    public let leading_seat: Int
    public let game_active: Bool
}

import XCTest
@testable import GuandanCore

final class Messages_Tests: XCTestCase {
    func test_card_decodes_go_keys() throws {
        let json = #"{"Suit":3,"Rank":12,"Id":7}"#
        let card = try JSONDecoder().decode(Card.self, from: Data(json.utf8))
        XCTAssertEqual(card.suit, Suit_Spades)
        XCTAssertEqual(card.rank, Rank_Ace)
        XCTAssertEqual(card.id, 7)
    }

    func test_incoming_room_state() throws {
        let json = """
        {"type":"room_state","payload":{
            "room_id":"abc123",
            "players":[{"id":"p1","name":"tony","seat":0,"team":0,"is_ready":true}],
            "game_active":false,
            "your_id":"p1",
            "is_host":true,
            "quick_match":false
        }}
        """
        let msg = Incoming_Message(text: json)
        XCTAssertEqual(msg?.type, .room_state)
        let payload = try msg!.payload(Room_State_Payload.self)
        XCTAssertEqual(payload.room_id, "abc123")
        XCTAssertEqual(payload.players.first?.name, "tony")
        XCTAssertNil(payload.session_token)
    }

    func test_incoming_unknown_type_is_nil() {
        XCTAssertNil(Incoming_Message(text: #"{"type":"nonsense","payload":{}}"#))
    }

    func test_encode_play_cards() throws {
        let text = try encode_message(.play_cards, Play_Cards_Payload(card_ids: [3, 7]))
        XCTAssertTrue(text.contains(#""type":"play_cards""#))
        XCTAssertTrue(text.contains(#""card_ids""#))
    }

    func test_encode_empty_payload() throws {
        let text = try encode_message(.pass, Empty_Payload())
        XCTAssertTrue(text.contains(#""payload":{}"#))
    }
}

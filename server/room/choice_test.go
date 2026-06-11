package room

import (
	"guandanbtw/game"
	"testing"
)

func room_with_hand(level game.Rank, cards []game.Card) *Room {
	r := new_room("test")
	r.game = game.New_Game_State()
	r.game.Level = level
	r.game.Hands[0] = cards
	return r
}

func Test_payer_has_tribute_choice(t *testing.T) {
	level := game.Rank(0) // level 2, so 2 of hearts is wild

	// two aces in different suits: real choice
	r := room_with_hand(level, []game.Card{
		{Id: 1, Rank: 12, Suit: game.Suit_Diamonds},
		{Id: 2, Rank: 12, Suit: game.Suit_Spades},
		{Id: 3, Rank: 5, Suit: game.Suit_Clubs},
	})
	if !r.payer_has_tribute_choice(0) {
		t.Error("two off-suit aces should be a choice")
	}

	// duplicate copies of the same suit: no choice
	r = room_with_hand(level, []game.Card{
		{Id: 1, Rank: 12, Suit: game.Suit_Spades},
		{Id: 2, Rank: 12, Suit: game.Suit_Spades},
		{Id: 3, Rank: 5, Suit: game.Suit_Clubs},
	})
	if r.payer_has_tribute_choice(0) {
		t.Error("duplicate same-suit aces are not a choice")
	}

	// single highest card: no choice
	r = room_with_hand(level, []game.Card{
		{Id: 1, Rank: 12, Suit: game.Suit_Spades},
		{Id: 2, Rank: 11, Suit: game.Suit_Hearts},
	})
	if r.payer_has_tribute_choice(0) {
		t.Error("single ace is not a choice")
	}

	// wild hearts copy excluded: K spades and K clubs remain a choice at level K
	level_k := game.Rank(11)
	r = room_with_hand(level_k, []game.Card{
		{Id: 1, Rank: 11, Suit: game.Suit_Hearts}, // wild, not giveable
		{Id: 2, Rank: 11, Suit: game.Suit_Spades},
		{Id: 3, Rank: 11, Suit: game.Suit_Clubs},
	})
	if !r.payer_has_tribute_choice(0) {
		t.Error("two non-wild kings in different suits should be a choice")
	}

	// wild hearts excluded leaving one suit: no choice
	r = room_with_hand(level_k, []game.Card{
		{Id: 1, Rank: 11, Suit: game.Suit_Hearts}, // wild
		{Id: 2, Rank: 11, Suit: game.Suit_Spades},
		{Id: 3, Rank: 5, Suit: game.Suit_Clubs},
	})
	if r.payer_has_tribute_choice(0) {
		t.Error("wild copy plus one real king is not a choice")
	}
}

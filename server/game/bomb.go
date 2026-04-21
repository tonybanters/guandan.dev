package game

// Bomb power scheme:
//   n-of-a-kind bomb:  n*100 + rank_value (rank_value 0-98)
//     4-bomb: 400-498,  5-bomb: 500-598
//     6-bomb: 600-698,  7-bomb: 700-798,  8-bomb: 800-898
//   straight flush:    599 — sits strictly above any 5-bomb and below any 6-bomb.
//     Flat Bomb_Power because the [599, 599] gap has no integer room.
//     SF-vs-SF ordering falls back to Rank_Value (see Can_Beat).
//   four-joker bomb:   2000 — unbeatable top of the stack.
func detect_bomb(cards []Card, level Rank) Combination {
	n := len(cards)
	if n == 4 && is_four_joker_bomb(cards) {
		return Combination{
			Type:       Comb_Bomb,
			Cards:      cards,
			Bomb_Power: 2000,
		}
	}
	if is_straight_flush(cards, level) {
		return Combination{
			Type:       Comb_Bomb,
			Cards:      cards,
			Bomb_Power: 599,
			Rank_Value: straight_flush_value(cards, level),
		}
	}
	if n >= 4 && n <= 10 {
		if power, ok := is_n_of_kind_bomb(cards, level); ok {
			return Combination{
				Type:       Comb_Bomb,
				Cards:      cards,
				Bomb_Power: power,
			}
		}
	}

	return Combination{Type: Comb_Invalid}
}

func is_four_joker_bomb(cards []Card) bool {
	if len(cards) != 4 {
		return false
	}

	red_count := 0
	black_count := 0

	for _, c := range cards {
		switch c.Rank {
		case Rank_Red_Joker:
			red_count++
		case Rank_Black_Joker:
			black_count++
		default:
			return false
		}
	}

	return red_count == 2 && black_count == 2
}

func is_straight_flush(cards []Card, level Rank) bool {
	_, ok := straight_flush_top(cards, level)
	return ok
}

// straight_flush_top returns the highest rank of the highest valid straight
// flush interpretation of the given cards. Wild cards fill gaps and are always
// assigned to the highest-ranked valid position (so 8,9,10,J♠ + wild♥ is
// interpreted as Q-high, not J-high).
func straight_flush_top(cards []Card, level Rank) (Rank, bool) {
	if len(cards) < 5 {
		return 0, false
	}

	non_wild, wild := separate_wilds(cards, level)

	if len(non_wild) == 0 {
		return 0, false
	}

	var suit Suit = -1
	for _, c := range non_wild {
		if c.Rank == Rank_Black_Joker || c.Rank == Rank_Red_Joker {
			return 0, false
		}
		if suit == -1 {
			suit = c.Suit
		} else if c.Suit != suit {
			return 0, false
		}
	}

	rank_present := make(map[Rank]bool)
	for _, c := range non_wild {
		rank_present[c.Rank] = true
	}

	natural_order := []Rank{
		Rank_Ace, Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}

	needed_len := len(cards)
	wilds_available := len(wild)

	// Scan high→low so the first valid window found has the highest top.
	for start := len(natural_order) - needed_len; start >= 0; start-- {
		gaps := 0
		for i := 0; i < needed_len; i++ {
			rank := natural_order[start+i]
			if !rank_present[rank] {
				gaps++
			}
		}
		if gaps <= wilds_available {
			return natural_order[start+needed_len-1], true
		}
	}

	return 0, false
}

func straight_flush_value(cards []Card, level Rank) int {
	top, ok := straight_flush_top(cards, level)
	if !ok {
		return 0
	}
	return len(cards)*10 + rank_value(top, level)
}

func is_n_of_kind_bomb(cards []Card, level Rank) (int, bool) {
	n := len(cards)
	if n < 4 || n > 10 {
		return 0, false
	}

	non_wild, wild := separate_wilds(cards, level)

	rank_counts := count_ranks(non_wild)

	for rank, count := range rank_counts {
		if rank == Rank_Black_Joker || rank == Rank_Red_Joker {
			continue
		}
		total := count + len(wild)
		if total >= n {
			power := n*100 + rank_value(rank, level)
			return power, true
		}
	}

	if len(wild) >= n {
		power := n*100 + rank_value(level, level)
		return power, true
	}

	return 0, false
}

package game

type Combination_Type int

const (
	Comb_Invalid Combination_Type = iota
	Comb_Single
	Comb_Pair
	Comb_Triple
	Comb_Full_House
	Comb_Straight
	Comb_Tube
	Comb_Plate
	Comb_Bomb
)

type Combination struct {
	Type       Combination_Type
	Cards      []Card
	Rank_Value int
	Bomb_Power int
}

func Detect_Combination(cards []Card, level Rank) Combination {
	n := len(cards)
	if n == 0 {
		return Combination{Type: Comb_Invalid}
	}

	non_wild, wild := separate_wilds(cards, level)

	if bomb := detect_bomb(cards, level); bomb.Type == Comb_Bomb {
		return bomb
	}

	switch n {
	case 1:
		return detect_single(non_wild, wild, level)
	case 2:
		return detect_pair(non_wild, wild, level)
	case 3:
		return detect_triple(non_wild, wild, level)
	case 5:
		if comb := detect_full_house(non_wild, wild, level); comb.Type != Comb_Invalid {
			return comb
		}
		return detect_straight(non_wild, wild, level)
	case 6:
		if comb := detect_tube(non_wild, wild, level); comb.Type != Comb_Invalid {
			return comb
		}
		return detect_plate(non_wild, wild, level)
	}

	return Combination{Type: Comb_Invalid}
}

func separate_wilds(cards []Card, level Rank) ([]Card, []Card) {
	var non_wild, wild []Card
	for _, c := range cards {
		if Is_Wild(c, level) {
			wild = append(wild, c)
		} else {
			non_wild = append(non_wild, c)
		}
	}
	return non_wild, wild
}

func detect_single(non_wild, wild []Card, level Rank) Combination {
	if len(non_wild) == 1 && len(wild) == 0 {
		return Combination{
			Type:       Comb_Single,
			Cards:      non_wild,
			Rank_Value: card_value(non_wild[0], level),
		}
	}
	if len(non_wild) == 0 && len(wild) == 1 {
		return Combination{
			Type:       Comb_Single,
			Cards:      wild,
			Rank_Value: card_value(wild[0], level),
		}
	}
	return Combination{Type: Comb_Invalid}
}

func detect_pair(non_wild, wild []Card, level Rank) Combination {
	total := len(non_wild) + len(wild)
	if total != 2 {
		return Combination{Type: Comb_Invalid}
	}

	if len(non_wild) == 2 {
		if non_wild[0].Rank == non_wild[1].Rank {
			return Combination{
				Type:       Comb_Pair,
				Cards:      append(non_wild, wild...),
				Rank_Value: card_value(non_wild[0], level),
			}
		}
		return Combination{Type: Comb_Invalid}
	}

	if len(non_wild) == 1 && len(wild) == 1 {
		return Combination{
			Type:       Comb_Pair,
			Cards:      append(non_wild, wild...),
			Rank_Value: card_value(non_wild[0], level),
		}
	}

	if len(wild) == 2 {
		return Combination{
			Type:       Comb_Pair,
			Cards:      wild,
			Rank_Value: card_value(wild[0], level),
		}
	}

	return Combination{Type: Comb_Invalid}
}

func detect_triple(non_wild, wild []Card, level Rank) Combination {
	total := len(non_wild) + len(wild)
	if total != 3 {
		return Combination{Type: Comb_Invalid}
	}

	rank_counts := count_ranks(non_wild)

	for rank, count := range rank_counts {
		needed := 3 - count
		if needed <= len(wild) {
			return Combination{
				Type:       Comb_Triple,
				Cards:      append(non_wild, wild...),
				Rank_Value: rank_value(rank, level),
			}
		}
	}

	if len(wild) == 3 {
		return Combination{
			Type:       Comb_Triple,
			Cards:      wild,
			Rank_Value: card_value(wild[0], level),
		}
	}

	return Combination{Type: Comb_Invalid}
}

func detect_full_house(non_wild, wild []Card, level Rank) Combination {
	total := len(non_wild) + len(wild)
	if total != 5 {
		return Combination{Type: Comb_Invalid}
	}

	rank_counts := count_ranks(non_wild)
	wilds_available := len(wild)

	var triple_rank Rank = -1
	var pair_rank Rank = -1

	ranks := sorted_ranks(rank_counts, level)

	for _, rank := range ranks {
		count := rank_counts[rank]
		if count >= 3 && triple_rank == -1 {
			triple_rank = rank
		} else if count >= 2 && pair_rank == -1 && triple_rank != rank {
			pair_rank = rank
		}
	}

	if triple_rank != -1 && pair_rank != -1 {
		return Combination{
			Type:       Comb_Full_House,
			Cards:      append(non_wild, wild...),
			Rank_Value: rank_value(triple_rank, level),
		}
	}

	for _, rank := range ranks {
		count := rank_counts[rank]
		needed_for_triple := 3 - count
		if needed_for_triple <= wilds_available {
			remaining_wilds := wilds_available - needed_for_triple
			for _, other_rank := range ranks {
				if other_rank == rank {
					continue
				}
				other_count := rank_counts[other_rank]
				needed_for_pair := 2 - other_count
				if needed_for_pair <= remaining_wilds {
					return Combination{
						Type:       Comb_Full_House,
						Cards:      append(non_wild, wild...),
						Rank_Value: rank_value(rank, level),
					}
				}
			}
			if remaining_wilds >= 2 {
				return Combination{
					Type:       Comb_Full_House,
					Cards:      append(non_wild, wild...),
					Rank_Value: rank_value(rank, level),
				}
			}
		}
	}

	return Combination{Type: Comb_Invalid}
}

func detect_straight(non_wild, wild []Card, level Rank) Combination {
	total := len(non_wild) + len(wild)
	if total != 5 {
		return Combination{Type: Comb_Invalid}
	}

	for _, card := range non_wild {
		if card.Rank == Rank_Black_Joker || card.Rank == Rank_Red_Joker {
			return Combination{Type: Comb_Invalid}
		}
	}

	rank_counts := count_ranks(non_wild)
	wilds_available := len(wild)

	natural_order := []Rank{
		Rank_Ace, Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}

	// Scan high→low so wilds fill the highest valid straight (e.g., 10,J,Q,K
	// + wild resolves to 10-J-Q-K-A, not 9-10-J-Q-K).
	for start := len(natural_order) - 5; start >= 0; start-- {
		needed := 0
		valid := true
		highest := natural_order[start+4]

		for i := 0; i < 5; i++ {
			rank := natural_order[start+i]
			if rank_counts[rank] == 0 {
				needed++
			} else if rank_counts[rank] > 1 {
				valid = false
				break
			}
		}

		if valid && needed <= wilds_available {
			return Combination{
				Type:       Comb_Straight,
				Cards:      append(non_wild, wild...),
				Rank_Value: straight_value(highest, level),
			}
		}
	}

	return Combination{Type: Comb_Invalid}
}

func straight_value(highest Rank, level Rank) int {
	natural_order := []Rank{
		Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}
	for i, r := range natural_order {
		if r == highest {
			return i
		}
	}
	return 0
}

func detect_tube(non_wild, wild []Card, level Rank) Combination {
	total := len(non_wild) + len(wild)
	if total != 6 {
		return Combination{Type: Comb_Invalid}
	}

	for _, card := range non_wild {
		if card.Rank == Rank_Black_Joker || card.Rank == Rank_Red_Joker {
			return Combination{Type: Comb_Invalid}
		}
	}

	rank_counts := count_ranks(non_wild)
	wilds_available := len(wild)

	natural_order := []Rank{
		Rank_Ace, Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}

	// Scan high→low so wilds fill the highest valid tube.
	for start := len(natural_order) - 3; start >= 0; start-- {
		needed := 0
		valid := true
		highest := natural_order[start+2]

		for i := 0; i < 3; i++ {
			rank := natural_order[start+i]
			count := rank_counts[rank]
			if count < 2 {
				needed += 2 - count
			}
		}

		if valid && needed <= wilds_available {
			return Combination{
				Type:       Comb_Tube,
				Cards:      append(non_wild, wild...),
				Rank_Value: straight_value(highest, level),
			}
		}
	}

	return Combination{Type: Comb_Invalid}
}

func detect_plate(non_wild, wild []Card, level Rank) Combination {
	total := len(non_wild) + len(wild)
	if total != 6 {
		return Combination{Type: Comb_Invalid}
	}

	for _, card := range non_wild {
		if card.Rank == Rank_Black_Joker || card.Rank == Rank_Red_Joker {
			return Combination{Type: Comb_Invalid}
		}
	}

	rank_counts := count_ranks(non_wild)
	wilds_available := len(wild)

	natural_order := []Rank{
		Rank_Ace, Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}

	for start := 0; start <= len(natural_order)-2; start++ {
		needed := 0
		highest := natural_order[start+1]

		for i := 0; i < 2; i++ {
			rank := natural_order[start+i]
			count := rank_counts[rank]
			if count < 3 {
				needed += 3 - count
			}
		}

		if needed <= wilds_available {
			return Combination{
				Type:       Comb_Plate,
				Cards:      append(non_wild, wild...),
				Rank_Value: straight_value(highest, level),
			}
		}
	}

	return Combination{Type: Comb_Invalid}
}

func count_ranks(cards []Card) map[Rank]int {
	counts := make(map[Rank]int)
	for _, c := range cards {
		counts[c.Rank]++
	}
	return counts
}

func sorted_ranks(counts map[Rank]int, level Rank) []Rank {
	var ranks []Rank
	for r := range counts {
		ranks = append(ranks, r)
	}

	for i := 0; i < len(ranks)-1; i++ {
		for j := i + 1; j < len(ranks); j++ {
			if rank_value(ranks[i], level) < rank_value(ranks[j], level) {
				ranks[i], ranks[j] = ranks[j], ranks[i]
			}
		}
	}

	return ranks
}

func Can_Beat(play, lead Combination) bool {
	if play.Type == Comb_Invalid {
		return false
	}

	if play.Type == Comb_Bomb && lead.Type != Comb_Bomb {
		return true
	}

	if play.Type == Comb_Bomb && lead.Type == Comb_Bomb {
		if play.Bomb_Power != lead.Bomb_Power {
			return play.Bomb_Power > lead.Bomb_Power
		}
		// Same bomb power (e.g., two straight flushes, both power 599): break
		// the tie by the highest card. Bomb_Power alone can't distinguish SFs
		// because the [599, 599] gap between 5-bomb and 6-bomb has no integer
		// room for internal ordering.
		return play.Rank_Value > lead.Rank_Value
	}

	if play.Type != lead.Type {
		return false
	}

	if len(play.Cards) != len(lead.Cards) {
		return false
	}

	return play.Rank_Value > lead.Rank_Value
}

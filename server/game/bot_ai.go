package game

import "sort"

// Hand_Analysis holds the decomposed hand for strategic play
type Hand_Analysis struct {
	Singles     []Card
	Pairs       [][]Card
	Triples     [][]Card
	Full_Houses [][]Card
	Straights   [][]Card
	Tubes       [][]Card
	Plates      [][]Card
	Bombs       [][]Card
	Level       Rank
}

// Analyze_Hand decomposes a hand into optimal combinations
func Analyze_Hand(hand []Card, level Rank) Hand_Analysis {
	analysis := Hand_Analysis{Level: level}

	// Sort hand by value (low to high)
	sorted := make([]Card, len(hand))
	copy(sorted, hand)
	sort.Slice(sorted, func(i, j int) bool {
		return Card_Value(sorted[i], level) < Card_Value(sorted[j], level)
	})

	// Group cards by rank
	rank_groups := make(map[Rank][]Card)
	for _, c := range sorted {
		rank_groups[c.Rank] = append(rank_groups[c.Rank], c)
	}

	// First, identify bombs (4+ of a kind) - these are special
	used_ids := make(map[int]bool)
	for rank, cards := range rank_groups {
		if rank == Rank_Black_Joker || rank == Rank_Red_Joker {
			continue
		}
		if len(cards) >= 4 {
			analysis.Bombs = append(analysis.Bombs, cards[:4])
			for _, c := range cards[:4] {
				used_ids[c.Id] = true
			}
		}
	}

	// Check for 4-joker bomb
	jokers := append(rank_groups[Rank_Black_Joker], rank_groups[Rank_Red_Joker]...)
	if len(jokers) == 4 {
		analysis.Bombs = append(analysis.Bombs, jokers)
		for _, c := range jokers {
			used_ids[c.Id] = true
		}
	}

	// Get remaining cards (not in bombs)
	remaining := []Card{}
	for _, c := range sorted {
		if !used_ids[c.Id] {
			remaining = append(remaining, c)
		}
	}

	// Find straights (5 consecutive cards)
	straights := find_all_straights(remaining, level)
	for _, straight := range straights {
		analysis.Straights = append(analysis.Straights, straight)
		for _, c := range straight {
			used_ids[c.Id] = true
		}
	}

	// Update remaining
	remaining = []Card{}
	for _, c := range sorted {
		if !used_ids[c.Id] {
			remaining = append(remaining, c)
		}
	}

	// Find tubes (3 consecutive pairs)
	tubes := find_all_tubes(remaining, level)
	for _, tube := range tubes {
		analysis.Tubes = append(analysis.Tubes, tube)
		for _, c := range tube {
			used_ids[c.Id] = true
		}
	}

	// Update remaining
	remaining = []Card{}
	for _, c := range sorted {
		if !used_ids[c.Id] {
			remaining = append(remaining, c)
		}
	}

	// Find plates (2 consecutive triples)
	plates := find_all_plates(remaining, level)
	for _, plate := range plates {
		analysis.Plates = append(analysis.Plates, plate)
		for _, c := range plate {
			used_ids[c.Id] = true
		}
	}

	// Update remaining
	remaining = []Card{}
	for _, c := range sorted {
		if !used_ids[c.Id] {
			remaining = append(remaining, c)
		}
	}

	// Regroup remaining cards
	rank_groups = make(map[Rank][]Card)
	for _, c := range remaining {
		rank_groups[c.Rank] = append(rank_groups[c.Rank], c)
	}

	// Find full houses (triple + pair)
	full_houses := find_all_full_houses(rank_groups, level)
	for _, fh := range full_houses {
		analysis.Full_Houses = append(analysis.Full_Houses, fh)
		for _, c := range fh {
			used_ids[c.Id] = true
		}
	}

	// Update remaining
	remaining = []Card{}
	for _, c := range sorted {
		if !used_ids[c.Id] {
			remaining = append(remaining, c)
		}
	}

	// Regroup remaining
	rank_groups = make(map[Rank][]Card)
	for _, c := range remaining {
		rank_groups[c.Rank] = append(rank_groups[c.Rank], c)
	}

	// Extract triples, pairs, singles from remaining
	for _, cards := range rank_groups {
		for len(cards) >= 3 {
			analysis.Triples = append(analysis.Triples, cards[:3])
			cards = cards[3:]
		}
		for len(cards) >= 2 {
			analysis.Pairs = append(analysis.Pairs, cards[:2])
			cards = cards[2:]
		}
		for _, c := range cards {
			analysis.Singles = append(analysis.Singles, c)
		}
	}

	// Sort all groups by value (low to high)
	sort_combo_groups(&analysis, level)

	return analysis
}

func sort_combo_groups(a *Hand_Analysis, level Rank) {
	// Sort singles
	sort.Slice(a.Singles, func(i, j int) bool {
		return Card_Value(a.Singles[i], level) < Card_Value(a.Singles[j], level)
	})

	// Sort pairs by their rank value
	sort.Slice(a.Pairs, func(i, j int) bool {
		return Card_Value(a.Pairs[i][0], level) < Card_Value(a.Pairs[j][0], level)
	})

	// Sort triples
	sort.Slice(a.Triples, func(i, j int) bool {
		return Card_Value(a.Triples[i][0], level) < Card_Value(a.Triples[j][0], level)
	})

	// Sort bombs by power (save strongest)
	sort.Slice(a.Bombs, func(i, j int) bool {
		bi := detect_bomb(a.Bombs[i], level)
		bj := detect_bomb(a.Bombs[j], level)
		return bi.Bomb_Power < bj.Bomb_Power
	})
}

func find_all_straights(cards []Card, level Rank) [][]Card {
	var result [][]Card

	// Group by rank
	rank_cards := make(map[Rank][]Card)
	for _, c := range cards {
		if c.Rank != Rank_Black_Joker && c.Rank != Rank_Red_Joker {
			rank_cards[c.Rank] = append(rank_cards[c.Rank], c)
		}
	}

	natural_order := []Rank{
		Rank_Ace, Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}

	// Try to find straights starting from lowest
	used := make(map[int]bool)
	for start := 0; start <= len(natural_order)-5; start++ {
		straight := []Card{}
		valid := true

		for i := 0; i < 5; i++ {
			rank := natural_order[start+i]
			found := false
			for _, c := range rank_cards[rank] {
				if !used[c.Id] {
					straight = append(straight, c)
					found = true
					break
				}
			}
			if !found {
				valid = false
				break
			}
		}

		if valid && len(straight) == 5 {
			// Verify it's actually a valid straight (not flush)
			if !is_same_suit(straight) {
				result = append(result, straight)
				for _, c := range straight {
					used[c.Id] = true
				}
			}
		}
	}

	return result
}

func is_same_suit(cards []Card) bool {
	if len(cards) == 0 {
		return false
	}
	suit := cards[0].Suit
	for _, c := range cards[1:] {
		if c.Suit != suit {
			return false
		}
	}
	return true
}

func find_all_tubes(cards []Card, level Rank) [][]Card {
	var result [][]Card

	// Group by rank, need at least 2 of each
	rank_cards := make(map[Rank][]Card)
	for _, c := range cards {
		if c.Rank != Rank_Black_Joker && c.Rank != Rank_Red_Joker {
			rank_cards[c.Rank] = append(rank_cards[c.Rank], c)
		}
	}

	natural_order := []Rank{
		Rank_Ace, Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}

	used := make(map[int]bool)
	for start := 0; start <= len(natural_order)-3; start++ {
		tube := []Card{}
		valid := true

		for i := 0; i < 3; i++ {
			rank := natural_order[start+i]
			count := 0
			for _, c := range rank_cards[rank] {
				if !used[c.Id] && count < 2 {
					tube = append(tube, c)
					count++
				}
			}
			if count < 2 {
				valid = false
				break
			}
		}

		if valid && len(tube) == 6 {
			result = append(result, tube)
			for _, c := range tube {
				used[c.Id] = true
			}
		}
	}

	return result
}

func find_all_plates(cards []Card, level Rank) [][]Card {
	var result [][]Card

	// Group by rank, need at least 3 of each
	rank_cards := make(map[Rank][]Card)
	for _, c := range cards {
		if c.Rank != Rank_Black_Joker && c.Rank != Rank_Red_Joker {
			rank_cards[c.Rank] = append(rank_cards[c.Rank], c)
		}
	}

	natural_order := []Rank{
		Rank_Ace, Rank_Two, Rank_Three, Rank_Four, Rank_Five,
		Rank_Six, Rank_Seven, Rank_Eight, Rank_Nine, Rank_Ten,
		Rank_Jack, Rank_Queen, Rank_King, Rank_Ace,
	}

	used := make(map[int]bool)
	for start := 0; start <= len(natural_order)-2; start++ {
		plate := []Card{}
		valid := true

		for i := 0; i < 2; i++ {
			rank := natural_order[start+i]
			count := 0
			for _, c := range rank_cards[rank] {
				if !used[c.Id] && count < 3 {
					plate = append(plate, c)
					count++
				}
			}
			if count < 3 {
				valid = false
				break
			}
		}

		if valid && len(plate) == 6 {
			result = append(result, plate)
			for _, c := range plate {
				used[c.Id] = true
			}
		}
	}

	return result
}

func find_all_full_houses(rank_cards map[Rank][]Card, level Rank) [][]Card {
	var result [][]Card

	// Find all triples
	var triples []struct {
		rank  Rank
		cards []Card
	}
	for rank, cards := range rank_cards {
		if rank != Rank_Black_Joker && rank != Rank_Red_Joker && len(cards) >= 3 {
			triples = append(triples, struct {
				rank  Rank
				cards []Card
			}{rank, cards[:3]})
		}
	}

	// Sort triples by value (low to high)
	sort.Slice(triples, func(i, j int) bool {
		return rank_value(triples[i].rank, level) < rank_value(triples[j].rank, level)
	})

	used := make(map[int]bool)
	for _, triple := range triples {
		// Check if triple is still available
		available := true
		for _, c := range triple.cards {
			if used[c.Id] {
				available = false
				break
			}
		}
		if !available {
			continue
		}

		// Find a pair
		for pair_rank, pair_cards := range rank_cards {
			if pair_rank == triple.rank {
				continue
			}
			if pair_rank == Rank_Black_Joker || pair_rank == Rank_Red_Joker {
				continue
			}

			available_pair := []Card{}
			for _, c := range pair_cards {
				if !used[c.Id] {
					available_pair = append(available_pair, c)
				}
			}

			if len(available_pair) >= 2 {
				fh := append(triple.cards, available_pair[:2]...)
				result = append(result, fh)
				for _, c := range fh {
					used[c.Id] = true
				}
				break
			}
		}
	}

	return result
}

// Bot_Choose_Lead decides what to play when leading (no current play to beat)
func Bot_Choose_Lead(hand []Card, level Rank) []int {
	if len(hand) == 0 {
		return nil
	}

	analysis := Analyze_Hand(hand, level)

	// Priority: lead with combos before singles (to get rid of more cards efficiently)
	// But lead LOW when we have HIGH of same type (to regain control)

	// Try leading with lowest straight (5 cards at once!)
	if len(analysis.Straights) > 0 {
		return card_ids(analysis.Straights[0])
	}

	// Try leading with lowest tube (6 cards!)
	if len(analysis.Tubes) > 0 {
		return card_ids(analysis.Tubes[0])
	}

	// Try leading with lowest plate (6 cards!)
	if len(analysis.Plates) > 0 {
		return card_ids(analysis.Plates[0])
	}

	// Try leading with lowest full house (5 cards)
	if len(analysis.Full_Houses) > 0 {
		return card_ids(analysis.Full_Houses[0])
	}

	// Lead with lowest triple if we have a higher triple (control strategy)
	if len(analysis.Triples) > 1 {
		return card_ids(analysis.Triples[0])
	}

	// Lead with lowest pair if we have a higher pair
	if len(analysis.Pairs) > 1 {
		return card_ids(analysis.Pairs[0])
	}

	// Lead with lowest single if we have higher singles
	if len(analysis.Singles) > 1 {
		return []int{analysis.Singles[0].Id}
	}

	// If we only have one of each, lead with lowest single
	if len(analysis.Singles) > 0 {
		return []int{analysis.Singles[0].Id}
	}

	// Lead with a pair
	if len(analysis.Pairs) > 0 {
		return card_ids(analysis.Pairs[0])
	}

	// Lead with a triple
	if len(analysis.Triples) > 0 {
		return card_ids(analysis.Triples[0])
	}

	// Last resort: play first card
	return []int{hand[0].Id}
}

// Bot_Choose_Response decides what to play to beat the current lead
func Bot_Choose_Response(hand []Card, lead Combination, level Rank, is_teammate_leading bool) []int {
	if len(hand) == 0 {
		return nil
	}

	// If teammate is leading, pass (let them win the trick)
	if is_teammate_leading {
		return nil
	}

	analysis := Analyze_Hand(hand, level)

	// Try to beat with same combination type first
	switch lead.Type {
	case Comb_Single:
		return find_beating_single(analysis, lead, level)
	case Comb_Pair:
		return find_beating_pair(analysis, lead, level)
	case Comb_Triple:
		return find_beating_triple(analysis, lead, level)
	case Comb_Full_House:
		return find_beating_full_house(analysis, lead, level)
	case Comb_Straight:
		return find_beating_straight(analysis, lead, level)
	case Comb_Tube:
		return find_beating_tube(analysis, lead, level)
	case Comb_Plate:
		return find_beating_plate(analysis, lead, level)
	case Comb_Bomb:
		return find_beating_bomb(analysis, lead, level)
	}

	return nil
}

func find_beating_single(analysis Hand_Analysis, lead Combination, level Rank) []int {
	// Find lowest single that beats lead
	for _, single := range analysis.Singles {
		if Card_Value(single, level) > lead.Rank_Value {
			return []int{single.Id}
		}
	}

	// Could use a card from a pair if desperate, but don't break combos unnecessarily
	// For now, skip this and let the bomb logic handle it

	return nil
}

func find_beating_pair(analysis Hand_Analysis, lead Combination, level Rank) []int {
	// Find lowest pair that beats lead
	for _, pair := range analysis.Pairs {
		if Card_Value(pair[0], level) > lead.Rank_Value {
			return card_ids(pair)
		}
	}
	return nil
}

func find_beating_triple(analysis Hand_Analysis, lead Combination, level Rank) []int {
	// Find lowest triple that beats lead
	for _, triple := range analysis.Triples {
		if Card_Value(triple[0], level) > lead.Rank_Value {
			return card_ids(triple)
		}
	}
	return nil
}

func find_beating_full_house(analysis Hand_Analysis, lead Combination, level Rank) []int {
	// Find lowest full house that beats lead
	for _, fh := range analysis.Full_Houses {
		combo := Detect_Combination(fh, level)
		if combo.Type == Comb_Full_House && combo.Rank_Value > lead.Rank_Value {
			return card_ids(fh)
		}
	}

	// Try to construct a full house from available triples and pairs
	for _, triple := range analysis.Triples {
		triple_value := Card_Value(triple[0], level)
		if triple_value <= lead.Rank_Value {
			continue
		}
		// Find any pair to go with it
		for _, pair := range analysis.Pairs {
			if pair[0].Rank != triple[0].Rank {
				fh := append(triple, pair...)
				return card_ids(fh)
			}
		}
	}

	return nil
}

func find_beating_straight(analysis Hand_Analysis, lead Combination, level Rank) []int {
	for _, straight := range analysis.Straights {
		combo := Detect_Combination(straight, level)
		if combo.Type == Comb_Straight && combo.Rank_Value > lead.Rank_Value {
			return card_ids(straight)
		}
	}
	return nil
}

func find_beating_tube(analysis Hand_Analysis, lead Combination, level Rank) []int {
	for _, tube := range analysis.Tubes {
		combo := Detect_Combination(tube, level)
		if combo.Type == Comb_Tube && combo.Rank_Value > lead.Rank_Value {
			return card_ids(tube)
		}
	}
	return nil
}

func find_beating_plate(analysis Hand_Analysis, lead Combination, level Rank) []int {
	for _, plate := range analysis.Plates {
		combo := Detect_Combination(plate, level)
		if combo.Type == Comb_Plate && combo.Rank_Value > lead.Rank_Value {
			return card_ids(plate)
		}
	}
	return nil
}

func find_beating_bomb(analysis Hand_Analysis, lead Combination, level Rank) []int {
	// Find lowest bomb that beats the lead bomb
	for _, bomb := range analysis.Bombs {
		combo := detect_bomb(bomb, level)
		if combo.Type == Comb_Bomb && combo.Bomb_Power > lead.Bomb_Power {
			return card_ids(bomb)
		}
	}
	return nil
}

// Bot_Should_Bomb decides if the bot should use a bomb
func Bot_Should_Bomb(analysis Hand_Analysis, lead Combination, level Rank, opponent_cards_remaining int) bool {
	if len(analysis.Bombs) == 0 {
		return false
	}

	// Don't bomb if lead is already a high bomb (save our bombs)
	if lead.Type == Comb_Bomb && lead.Bomb_Power >= 800 {
		return false
	}

	// Bomb if opponent is close to winning (few cards left)
	if opponent_cards_remaining <= 5 {
		return true
	}

	// Bomb high-value plays (aces, level cards)
	if lead.Rank_Value >= 90 {
		return true
	}

	// Bomb tubes and plates (they're efficient plays)
	if lead.Type == Comb_Tube || lead.Type == Comb_Plate {
		return true
	}

	return false
}

// Bot_Get_Bomb returns the lowest bomb to use
func Bot_Get_Bomb(analysis Hand_Analysis, level Rank) []int {
	if len(analysis.Bombs) == 0 {
		return nil
	}
	return card_ids(analysis.Bombs[0])
}

func card_ids(cards []Card) []int {
	ids := make([]int, len(cards))
	for i, c := range cards {
		ids[i] = c.Id
	}
	return ids
}

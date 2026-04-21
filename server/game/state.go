package game

type Game_Phase int

const (
	Phase_Waiting Game_Phase = iota
	Phase_Deal
	Phase_Play
	Phase_Tribute
	Phase_End
)

type Tribute_Info struct {
	From_Seat    int
	To_Seat      int
	Done         bool
	Card_Value   int  // Value of the tributed card (set when tribute is paid)
	Return_Done  bool // Whether the winner has given back a card
}

type Game_State struct {
	Phase          Game_Phase
	Level          Rank
	Team_Levels    [2]int
	Hands          [4][]Card
	Current_Turn   int
	Current_Lead   Combination
	Lead_Player    int
	Pass_Count     int
	Finish_Order   []int
	Tributes       []Tribute_Info
	Tribute_Leader int
}

func New_Game_State() *Game_State {
	return &Game_State{
		Phase:        Phase_Waiting,
		Level:        Rank_Two,
		Team_Levels:  [2]int{0, 0},
		Finish_Order: make([]int, 0, 4),
	}
}

func (g *Game_State) Get_Cards_By_Id(seat int, ids []int) []Card {
	id_set := make(map[int]bool)
	for _, id := range ids {
		id_set[id] = true
	}

	var cards []Card
	for _, card := range g.Hands[seat] {
		if id_set[card.Id] {
			cards = append(cards, card)
			delete(id_set, card.Id)
		}
	}

	if len(id_set) > 0 {
		return nil
	}

	return cards
}

func (g *Game_State) Get_Card_By_Id(seat int, id int) *Card {
	for i := range g.Hands[seat] {
		if g.Hands[seat][i].Id == id {
			return &g.Hands[seat][i]
		}
	}
	return nil
}

func (g *Game_State) Remove_Cards(seat int, ids []int) {
	id_set := make(map[int]bool)
	for _, id := range ids {
		id_set[id] = true
	}

	var remaining []Card
	for _, card := range g.Hands[seat] {
		if !id_set[card.Id] {
			remaining = append(remaining, card)
		}
	}
	g.Hands[seat] = remaining
}

func (g *Game_State) Setup_Tributes() {
	g.Tributes = nil

	if len(g.Finish_Order) < 2 {
		return
	}

	// Organize players by finish position (0=1st, 1=2nd, 2=3rd, 3=4th)
	var players_by_position [4]int

	// Add finished players
	for i := 0; i < len(g.Finish_Order); i++ {
		players_by_position[i] = g.Finish_Order[i]
	}

	// Find unfinished players and add them at the end
	unfinished_idx := len(g.Finish_Order)
	for s := 0; s < 4; s++ {
		found := false
		for _, f := range g.Finish_Order {
			if f == s {
				found = true
				break
			}
		}
		if !found && unfinished_idx < 4 {
			players_by_position[unfinished_idx] = s
			unfinished_idx++
		}
	}

	first_place := players_by_position[0]

	// 4th place always gives to 1st place (even if teammates in a 1-4 win)
	fourth_place := players_by_position[3]
	g.Tributes = append(g.Tributes, Tribute_Info{
		From_Seat: fourth_place,
		To_Seat:   first_place,
	})

	// If double win (1st and 2nd on same team): 3rd place gives to 2nd place
	if g.is_double_win() {
		second_place := players_by_position[1]
		third_place := players_by_position[2]
		g.Tributes = append(g.Tributes, Tribute_Info{
			From_Seat: third_place,
			To_Seat:   second_place,
		})
	}

	g.Tribute_Leader = first_place
}

func (g *Game_State) is_double_win() bool {
	if len(g.Finish_Order) < 2 {
		return false
	}
	return g.Finish_Order[0]%2 == g.Finish_Order[1]%2
}

// Check_Kang_Gong implements the "refuse tribute" rule (抗贡): if the tribute
// payers collectively hold both red jokers in their freshly dealt hands, they
// may refuse to pay. Caller must invoke this after the new hands are dealt.
// Returns true when tribute is refused. Relies on the invariant that all
// From_Seats in Tributes belong to the same (losing) team, which Setup_Tributes
// guarantees.
func (g *Game_State) Check_Kang_Gong() bool {
	if len(g.Tributes) == 0 {
		return false
	}

	red_jokers := 0
	for _, t := range g.Tributes {
		for _, card := range g.Hands[t.From_Seat] {
			if card.Rank == Rank_Red_Joker {
				red_jokers++
			}
		}
	}

	if red_jokers >= 2 {
		g.Tributes = nil
		return true
	}
	return false
}

func (g *Game_State) Get_Tribute_Info(seat int) *Tribute_Info {
	for i := range g.Tributes {
		if g.Tributes[i].From_Seat == seat && !g.Tributes[i].Done {
			return &g.Tributes[i]
		}
	}
	return nil
}

func (g *Game_State) Mark_Tribute_Done(seat int) {
	for i := range g.Tributes {
		if g.Tributes[i].From_Seat == seat && !g.Tributes[i].Done {
			g.Tributes[i].Done = true
			break
		}
	}
}

func (g *Game_State) Mark_Tribute_Done_With_Value(seat int, card_value int) {
	for i := range g.Tributes {
		if g.Tributes[i].From_Seat == seat && !g.Tributes[i].Done {
			g.Tributes[i].Done = true
			g.Tributes[i].Card_Value = card_value
			break
		}
	}
}

// Determine_First_Player returns the seat that should play first.
// Per Guan Dan rules: the player who pays the higher ranked tribute goes first.
// If equal tributes or no tributes, the first finisher from previous hand goes first.
func (g *Game_State) Determine_First_Player() int {
	if len(g.Tributes) == 0 {
		// No tributes - first finisher goes first
		return g.Tribute_Leader
	}

	// Find the tribute with the highest card value
	highest_value := -1
	highest_seat := g.Tribute_Leader // Default to first finisher

	for _, t := range g.Tributes {
		if t.Card_Value > highest_value {
			highest_value = t.Card_Value
			highest_seat = t.From_Seat
		}
	}

	return highest_seat
}

func (g *Game_State) All_Tributes_Done() bool {
	for _, t := range g.Tributes {
		if !t.Done {
			return false
		}
	}
	return true
}

func (g *Game_State) All_Returns_Done() bool {
	for _, t := range g.Tributes {
		if !t.Return_Done {
			return false
		}
	}
	return true
}

func (g *Game_State) Get_Pending_Return(seat int) *Tribute_Info {
	for i := range g.Tributes {
		// The winner (To_Seat) needs to return a card, and tribute must be done first
		if g.Tributes[i].To_Seat == seat && g.Tributes[i].Done && !g.Tributes[i].Return_Done {
			return &g.Tributes[i]
		}
	}
	return nil
}

func (g *Game_State) Mark_Return_Done(seat int) {
	for i := range g.Tributes {
		if g.Tributes[i].To_Seat == seat && g.Tributes[i].Done && !g.Tributes[i].Return_Done {
			g.Tributes[i].Return_Done = true
			break
		}
	}
}

func (g *Game_State) Reset_Hand() {
	g.Current_Lead = Combination{Type: Comb_Invalid}
	g.Lead_Player = 0
	g.Pass_Count = 0
	g.Finish_Order = g.Finish_Order[:0]
	// Don't clear Tributes here - they're set up before dealing and processed after

	winning_team := g.Tribute_Leader % 2
	g.Level = Rank(g.Team_Levels[winning_team])
}

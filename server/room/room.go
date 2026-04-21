package room

import (
	"log"
	"time"

	"guandanbtw/game"
	"guandanbtw/protocol"
)

type Play_Action struct {
	client   *Client
	card_ids []int
}

type Tribute_Action struct {
	client  *Client
	card_id int
}

type Reconnect_Request struct {
	new_client    *Client
	session_token string
}

type Disconnected_Player struct {
	session_token string
	seat          int
	name          string
}

type Pick_Seat_Action struct {
	client *Client
	seat   int
}

type Room struct {
	id                   string
	host                 *Client
	clients              [4]*Client
	game                 *game.Game_State
	join                 chan *Client
	leave                chan *Client
	play                 chan Play_Action
	pass                 chan *Client
	tribute              chan Tribute_Action
	tribute_return       chan Tribute_Action
	fill_bots            chan *Client
	start_game_req       chan *Client
	pick_seat            chan Pick_Seat_Action
	ready                chan *Client
	bot_turn             chan int
	reconnect            chan Reconnect_Request
	expire_disconnected  chan string // session_token
	disconnected_players map[string]*Disconnected_Player // session_token -> player info
}

func new_room(id string) *Room {
	return &Room{
		id:                   id,
		join:                 make(chan *Client),
		leave:                make(chan *Client),
		play:                 make(chan Play_Action),
		pass:                 make(chan *Client),
		tribute:              make(chan Tribute_Action),
		tribute_return:       make(chan Tribute_Action),
		fill_bots:            make(chan *Client),
		start_game_req:       make(chan *Client),
		pick_seat:            make(chan Pick_Seat_Action),
		ready:                make(chan *Client),
		bot_turn:             make(chan int),
		reconnect:            make(chan Reconnect_Request),
		expire_disconnected:  make(chan string),
		disconnected_players: make(map[string]*Disconnected_Player),
	}
}

func (r *Room) run() {
	defer func() {
		if err := recover(); err != nil {
			log.Printf("[ERROR] room %s panic: %v", r.id, err)
			// Notify connected clients that the room crashed
			for _, client := range r.clients {
				if client != nil && !client.disconnected {
					client.send_error("room encountered an error")
				}
			}
		}
	}()

	for {
		select {
		case client := <-r.join:
			r.handle_join(client)
		case client := <-r.leave:
			r.handle_leave(client)
		case req := <-r.reconnect:
			r.handle_reconnect(req)
		case token := <-r.expire_disconnected:
			r.handle_expire_disconnected(token)
		case action := <-r.play:
			r.handle_play(action)
		case client := <-r.pass:
			r.handle_pass(client)
		case action := <-r.tribute:
			r.handle_tribute(action)
		case action := <-r.tribute_return:
			r.handle_tribute_return(action)
		case client := <-r.start_game_req:
			r.handle_start_game(client)
		case action := <-r.pick_seat:
			r.handle_pick_seat(action)
		case client := <-r.ready:
			r.handle_ready(client)
		case <-r.fill_bots:
			r.handle_fill_bots()
		case seat := <-r.bot_turn:
			r.handle_bot_turn(seat)
		}
	}
}

func (r *Room) handle_join(client *Client) {
	// Check if this player name matches a disconnected player — rejoin them
	for token, dp := range r.disconnected_players {
		if dp.name == client.name {
			log.Printf("[DEBUG] handle_join: player %s matches disconnected player at seat %d, rejoining", client.name, dp.seat)

			old_client := r.clients[dp.seat]
			if old_client != nil {
				client.id = old_client.id
				client.session_token = old_client.session_token
			}
			client.room = r
			r.clients[dp.seat] = client
			delete(r.disconnected_players, token)

			r.send_reconnect_state(client, dp.seat)
			r.broadcast(&protocol.Message{
				Type: protocol.Msg_Player_Reconnected,
				Payload: protocol.Player_Status_Payload{
					Player_Id: client.id,
					Seat:      dp.seat,
					Name:      client.name,
				},
			})
			return
		}
	}

	seat := r.find_empty_seat()
	if seat == -1 {
		client.send_error("room is full")
		return
	}

	r.clients[seat] = client
	client.room = r

	if r.host == nil {
		r.host = client
	}

	r.broadcast_room_state()
}

func (r *Room) handle_leave(client *Client) {
	// Skip if already disconnected (prevents double-processing)
	if client.disconnected {
		return
	}

	seat := -1
	for i := range 4 {
		if r.clients[i] == client {
			seat = i
			break
		}
	}
	if seat == -1 {
		return
	}

	// If game is active, mark as disconnected instead of removing
	if r.game != nil && !client.is_bot {
		log.Printf("[DEBUG] handle_leave: player %s (seat %d) disconnected during game, saving session", client.name, seat)

		// Save disconnected player info for reconnection
		r.disconnected_players[client.session_token] = &Disconnected_Player{
			session_token: client.session_token,
			seat:          seat,
			name:          client.name,
		}

		// Mark client as disconnected but keep in seat
		// Don't touch conn or send - read_pump's defer already closed the conn,
		// and write_pump will exit on its next ping attempt
		client.disconnected = true

		// Notify other players
		r.broadcast(&protocol.Message{
			Type: protocol.Msg_Player_Disconnected,
			Payload: protocol.Player_Status_Payload{
				Player_Id: client.id,
				Seat:      seat,
				Name:      client.name,
			},
		})

		// If it was this player's turn, advance to the next player
		if r.game.Current_Turn == seat {
			log.Printf("[DEBUG] handle_leave: it was seat %d's turn, advancing", seat)
			r.advance_turn()
		}

		// Set a timeout to fully remove the player if they don't reconnect
		go func(token string, s int) {
			time.Sleep(60 * time.Second) // 60 second reconnect window
			r.expire_disconnected <- token
		}(client.session_token, seat)

		return
	}

	// No game active - fully remove the player
	r.clients[seat] = nil
	client.room = nil

	// Transfer host if the leaving player was host
	if r.host == client {
		r.host = nil
		for _, c := range r.clients {
			if c != nil && !c.disconnected && !c.is_bot {
				r.host = c
				break
			}
		}
	}

	r.broadcast(&protocol.Message{
		Type: protocol.Msg_Player_Left,
		Payload: protocol.Player_Info{
			Id:   client.id,
			Name: client.name,
		},
	})

	r.broadcast_room_state()
}

func (r *Room) handle_reconnect(req Reconnect_Request) {
	log.Printf("[DEBUG] handle_reconnect: session_token=%s", req.session_token)

	// Find the disconnected player
	dp, exists := r.disconnected_players[req.session_token]
	if !exists {
		req.new_client.send_error("session not found or expired")
		return
	}

	// Get the old client from the seat
	old_client := r.clients[dp.seat]
	if old_client == nil {
		req.new_client.send_error("seat no longer available")
		delete(r.disconnected_players, req.session_token)
		return
	}

	// Transfer identity from old client to the new connection
	// (new client already has its own goroutines running)
	req.new_client.id = old_client.id
	req.new_client.name = dp.name
	req.new_client.session_token = old_client.session_token
	req.new_client.room = r

	// Replace old client with new one in the seat
	r.clients[dp.seat] = req.new_client

	// Remove from disconnected list
	delete(r.disconnected_players, req.session_token)

	log.Printf("[DEBUG] handle_reconnect: player %s reconnected to seat %d", dp.name, dp.seat)

	// Send full game state to reconnected player
	r.send_reconnect_state(req.new_client, dp.seat)

	// Notify other players
	r.broadcast(&protocol.Message{
		Type: protocol.Msg_Player_Reconnected,
		Payload: protocol.Player_Status_Payload{
			Player_Id: req.new_client.id,
			Seat:      dp.seat,
			Name:      dp.name,
		},
	})
}

func (r *Room) handle_expire_disconnected(token string) {
	dp, exists := r.disconnected_players[token]
	if !exists {
		return // Already reconnected
	}

	log.Printf("[DEBUG] handle_expire_disconnected: player at seat %d timed out", dp.seat)

	// Fully remove the player
	if r.clients[dp.seat] != nil {
		r.clients[dp.seat] = nil
	}
	delete(r.disconnected_players, token)

	// Notify other players
	r.broadcast(&protocol.Message{
		Type: protocol.Msg_Player_Left,
		Payload: protocol.Player_Info{
			Name: dp.name,
			Seat: dp.seat,
		},
	})

	// If it was the expired player's turn, advance to the next player
	if r.game != nil && r.game.Current_Turn == dp.seat {
		log.Printf("[DEBUG] handle_expire_disconnected: it was seat %d's turn, advancing", dp.seat)
		r.advance_turn()
	}
}

func (r *Room) send_reconnect_state(client *Client, seat int) {
	if r.game == nil {
		// No active game, just send room state
		r.broadcast_room_state()
		return
	}

	// Build card counts
	card_counts := [4]int{}
	for i := 0; i < 4; i++ {
		card_counts[i] = len(r.game.Hands[i])
	}

	// Build players list
	players := make([]protocol.Player_Info, 0)
	for i, c := range r.clients {
		if c != nil {
			players = append(players, protocol.Player_Info{
				Id:   c.id,
				Name: c.name,
				Seat: i,
				Team: i % 2,
			})
		}
	}

	// Get current table cards and combo type
	var table_cards []game.Card
	combo_type := ""
	if r.game.Current_Lead.Type != game.Comb_Invalid {
		table_cards = r.game.Current_Lead.Cards
		combo_type = combo_type_name(r.game.Current_Lead.Type)
	}

	// Send reconnect success with full game state
	client.send_message(&protocol.Message{
		Type: protocol.Msg_Reconnect_Success,
		Payload: protocol.Reconnect_Success_Payload{
			Session_Token: client.session_token,
			Room_Id:       r.id,
			Players:       players,
			Your_Id:       client.id,
			Seat:          seat,
			Cards:         r.game.Hands[seat],
			Level:         r.game.Level,
			Current_Turn:  r.game.Current_Turn,
			Can_Pass:      r.game.Current_Lead.Type != game.Comb_Invalid,
			Table_Cards:   table_cards,
			Combo_Type:    combo_type,
			Card_Counts:   card_counts,
			Team_Levels:   r.game.Team_Levels,
			Leading_Seat:  r.game.Lead_Player,
			Game_Active:   true,
		},
	})
}

func (r *Room) handle_play(action Play_Action) {
	if r.game == nil {
		return
	}

	seat := r.get_seat(action.client)
	if seat == -1 || seat != r.game.Current_Turn {
		action.client.send_error("not your turn")
		return
	}

	cards := r.game.Get_Cards_By_Id(seat, action.card_ids)
	if cards == nil {
		action.client.send_error("invalid cards")
		return
	}

	combo := game.Detect_Combination(cards, r.game.Level)
	if combo.Type == game.Comb_Invalid {
		action.client.send_error("invalid combination")
		return
	}

	if r.game.Current_Lead.Type != game.Comb_Invalid {
		if !game.Can_Beat(combo, r.game.Current_Lead) {
			action.client.send_error("cannot beat current play")
			return
		}
	}

	r.game.Remove_Cards(seat, action.card_ids)
	r.game.Current_Lead = combo
	r.game.Lead_Player = seat
	r.game.Pass_Count = 0

	r.broadcast(&protocol.Message{
		Type: protocol.Msg_Play_Made,
		Payload: protocol.Play_Made_Payload{
			Player_Id:  action.client.id,
			Seat:       seat,
			Cards:      cards,
			Combo_Type: combo_type_name(combo.Type),
			Is_Pass:    false,
		},
	})

	if len(r.game.Hands[seat]) == 0 {
		log.Printf("[DEBUG] handle_play: seat %d finished! Adding to Finish_Order", seat)
		r.game.Finish_Order = append(r.game.Finish_Order, seat)
		if r.check_hand_end() {
			log.Printf("[DEBUG] handle_play: hand ended, returning")
			return
		}
		log.Printf("[DEBUG] handle_play: hand not ended, continuing")
	}

	r.advance_turn()
}

func (r *Room) handle_pass(client *Client) {
	if r.game == nil {
		return
	}

	seat := r.get_seat(client)
	log.Printf("[DEBUG] handle_pass: seat=%d, Current_Turn=%d", seat, r.game.Current_Turn)

	if seat == -1 || seat != r.game.Current_Turn {
		client.send_error("not your turn")
		return
	}

	if r.game.Current_Lead.Type == game.Comb_Invalid {
		client.send_error("cannot pass when leading")
		return
	}

	r.game.Pass_Count++
	log.Printf("[DEBUG] handle_pass: Pass_Count now %d", r.game.Pass_Count)

	r.broadcast(&protocol.Message{
		Type: protocol.Msg_Play_Made,
		Payload: protocol.Play_Made_Payload{
			Player_Id: client.id,
			Seat:      seat,
			Is_Pass:   true,
		},
	})

	// Calculate how many passes needed: all active (unfinished) players,
	// minus the lead player only if they're still active. If the lead just
	// finished by playing their last card, every remaining player still needs
	// a chance to respond before the trick resets.
	passes_needed := 4 - len(r.game.Finish_Order)
	if !r.is_finished(r.game.Lead_Player) {
		passes_needed--
	}

	if r.game.Pass_Count >= passes_needed {
		log.Printf("[DEBUG] handle_pass: %d passes (needed %d), resetting lead. Lead_Player=%d", r.game.Pass_Count, passes_needed, r.game.Lead_Player)
		r.game.Current_Lead = game.Combination{Type: game.Comb_Invalid}

		// After everyone passes, the lead player leads again
		lead_player := r.game.Lead_Player
		var next_leader int

		if !r.is_finished(lead_player) && r.clients[lead_player] != nil && !r.clients[lead_player].disconnected {
			log.Printf("[DEBUG] handle_pass: lead player %d is unfinished, they lead again", lead_player)
			next_leader = lead_player
		} else {
			// If lead player is finished or absent, their teammate leads
			teammate := (lead_player + 2) % 4
			if !r.is_finished(teammate) && r.clients[teammate] != nil && !r.clients[teammate].disconnected {
				log.Printf("[DEBUG] handle_pass: lead player finished/absent, teammate %d leads", teammate)
				next_leader = teammate
			} else {
				// Otherwise, find next unfinished and present player in counterclockwise order
				log.Printf("[DEBUG] handle_pass: lead player and teammate finished/absent, finding next available")
				for i := 1; i <= 4; i++ {
					candidate := (lead_player - i + 4) % 4
					if !r.is_finished(candidate) && r.clients[candidate] != nil && !r.clients[candidate].disconnected {
						log.Printf("[DEBUG] handle_pass: found available player %d", candidate)
						next_leader = candidate
						break
					}
				}
			}
		}

		log.Printf("[DEBUG] handle_pass: next_leader=%d", next_leader)
		r.game.Current_Turn = next_leader
		r.game.Pass_Count = 0
		r.send_turn_notification()
		r.trigger_bot_turn_if_needed()
		return
	}

	r.advance_turn()
}

func (r *Room) handle_tribute(action Tribute_Action) {
	log.Printf("[DEBUG] handle_tribute: received tribute action from client")

	if r.game == nil || r.game.Phase != game.Phase_Tribute {
		log.Printf("[DEBUG] handle_tribute: wrong phase, returning")
		return
	}

	seat := r.get_seat(action.client)
	log.Printf("[DEBUG] handle_tribute: seat=%d, card_id=%d", seat, action.card_id)

	tribute_info := r.game.Get_Tribute_Info(seat)
	if tribute_info == nil {
		log.Printf("[DEBUG] handle_tribute: no tribute info for seat %d", seat)
		action.client.send_error("you don't need to give tribute")
		return
	}

	card := r.game.Get_Card_By_Id(seat, action.card_id)
	if card == nil {
		log.Printf("[DEBUG] handle_tribute: card not found")
		action.client.send_error("invalid card")
		return
	}

	if game.Is_Wild(*card, r.game.Level) {
		log.Printf("[DEBUG] handle_tribute: card is wild, rejecting")
		action.client.send_error("cannot tribute wild cards")
		return
	}

	largestRank, ok := find_largest_tribute_rank(r.game.Hands[seat], r.game.Level)
	if ok && card.Rank != largestRank {
		log.Printf("[DEBUG] handle_tribute: card rank %d is not the largest (%d), rejecting", card.Rank, largestRank)
		action.client.send_error("must tribute your largest card")
		return
	}

	log.Printf("[DEBUG] handle_tribute: tributing card %v to seat %d", card, tribute_info.To_Seat)
	card_value := game.Card_Value(*card, r.game.Level)
	r.game.Remove_Cards(seat, []int{action.card_id})
	r.game.Hands[tribute_info.To_Seat] = append(r.game.Hands[tribute_info.To_Seat], *card)

	if r.clients[tribute_info.To_Seat] != nil {
		r.clients[tribute_info.To_Seat].send_message(&protocol.Message{
			Type: protocol.Msg_Tribute_Recv,
			Payload: protocol.Tribute_Recv_Payload{
				Card: *card,
			},
		})
	}

	// Confirm to the giver that the tribute was accepted
	action.client.send_message(&protocol.Message{
		Type:    protocol.Msg_Tribute_Give_Ok,
		Payload: protocol.Tribute_Ok_Payload{Card_Id: action.card_id},
	})

	r.game.Mark_Tribute_Done_With_Value(seat, card_value)
	log.Printf("[DEBUG] handle_tribute: marked done with value %d, All_Tributes_Done=%v", card_value, r.game.All_Tributes_Done())

	// Notify the winner they need to give a card back
	winner_seat := tribute_info.To_Seat
	log.Printf("[DEBUG] handle_tribute: notifying seat %d to return a card to seat %d", winner_seat, seat)
	if r.clients[winner_seat] != nil {
		r.clients[winner_seat].send_message(&protocol.Message{
			Type: protocol.Msg_Tribute_Return,
			Payload: protocol.Tribute_Return_Payload{
				To_Seat: seat,
			},
		})
	}

	// Trigger next bot tribute if there are more pending
	r.trigger_bot_tributes()

	// Trigger bot return if winner is a bot
	r.trigger_bot_returns()
}

func find_largest_tribute_rank(hand []game.Card, level game.Rank) (game.Rank, bool) {
	maxValue := -1
	var maxRank game.Rank
	found := false
	for _, c := range hand {
		if game.Is_Wild(c, level) {
			continue
		}
		v := game.Card_Value(c, level)
		if v > maxValue {
			maxValue = v
			maxRank = c.Rank
			found = true
		}
	}
	return maxRank, found
}

func (r *Room) handle_tribute_return(action Tribute_Action) {
	log.Printf("[DEBUG] handle_tribute_return: received return action from client")

	if r.game == nil || r.game.Phase != game.Phase_Tribute {
		log.Printf("[DEBUG] handle_tribute_return: wrong phase, returning")
		return
	}

	seat := r.get_seat(action.client)
	log.Printf("[DEBUG] handle_tribute_return: seat=%d, card_id=%d", seat, action.card_id)

	return_info := r.game.Get_Pending_Return(seat)
	if return_info == nil {
		log.Printf("[DEBUG] handle_tribute_return: no pending return for seat %d", seat)
		action.client.send_error("you don't need to return a card")
		return
	}

	card := r.game.Get_Card_By_Id(seat, action.card_id)
	if card == nil {
		log.Printf("[DEBUG] handle_tribute_return: card not found")
		action.client.send_error("invalid card")
		return
	}

	// Card must be ≤10 (not face card, not wild)
	if card.Rank > game.Rank_Ten || game.Is_Wild(*card, r.game.Level) {
		log.Printf("[DEBUG] handle_tribute_return: card rank %d is too high or wild", card.Rank)
		action.client.send_error("return card must be 10 or lower")
		return
	}

	loser_seat := return_info.From_Seat
	log.Printf("[DEBUG] handle_tribute_return: returning card %v to seat %d", card, loser_seat)
	r.game.Remove_Cards(seat, []int{action.card_id})
	r.game.Hands[loser_seat] = append(r.game.Hands[loser_seat], *card)

	// Notify the loser they received a card back
	if r.clients[loser_seat] != nil {
		r.clients[loser_seat].send_message(&protocol.Message{
			Type: protocol.Msg_Tribute_Recv,
			Payload: protocol.Tribute_Recv_Payload{
				Card: *card,
			},
		})
	}

	// Confirm to the returner that the return was accepted
	action.client.send_message(&protocol.Message{
		Type:    protocol.Msg_Tribute_Return_Ok,
		Payload: protocol.Tribute_Ok_Payload{Card_Id: action.card_id},
	})

	r.game.Mark_Return_Done(seat)
	log.Printf("[DEBUG] handle_tribute_return: marked return done, All_Returns_Done=%v", r.game.All_Returns_Done())

	if r.game.All_Returns_Done() {
		if r.game.All_Tributes_Done() {
			// All tributes and returns complete, start play
			first_player := r.game.Determine_First_Player()
			log.Printf("[DEBUG] handle_tribute_return: all done, first player is seat %d", first_player)
			r.game.Phase = game.Phase_Play
			r.game.Current_Turn = first_player
			r.send_turn_notification()
			r.trigger_bot_turn_if_needed()
		} else {
			// More tributes to process
			r.trigger_bot_tributes()
		}
	} else {
		// More returns to process
		r.trigger_bot_returns()
	}
}

func (r *Room) trigger_bot_returns() {
	for _, t := range r.game.Tributes {
		if !t.Done || t.Return_Done {
			continue
		}

		winner_seat := t.To_Seat
		client := r.clients[winner_seat]
		if client == nil || !client.is_bot {
			continue
		}

		log.Printf("[DEBUG] trigger_bot_returns: bot at seat %d needs to return a card", winner_seat)

		// Find a card ≤10 to return (pick the lowest)
		hand := r.game.Hands[winner_seat]
		var best_card *game.Card
		best_value := 999

		for i := range hand {
			card := &hand[i]
			// Must be ≤10 and not wild
			if card.Rank > game.Rank_Ten || game.Is_Wild(*card, r.game.Level) {
				continue
			}
			value := game.Card_Value(*card, r.game.Level)
			if value < best_value {
				best_value = value
				best_card = card
			}
		}

		if best_card == nil {
			log.Printf("[DEBUG] trigger_bot_returns: no valid return card found for bot at seat %d", winner_seat)
			continue
		}

		log.Printf("[DEBUG] trigger_bot_returns: bot returning card %v", best_card)

		go func(seat int, card_id int) {
			time.Sleep(500 * time.Millisecond)
			r.tribute_return <- Tribute_Action{
				client:  r.clients[seat],
				card_id: card_id,
			}
		}(winner_seat, best_card.Id)

		return // Only one at a time
	}
}

func (r *Room) start_game() {
	r.game = game.New_Game_State()

	deck := game.New_Deck()
	deck.Shuffle()
	hands := deck.Deal()

	for i := 0; i < 4; i++ {
		r.game.Hands[i] = hands[i]
	}

	for i := 0; i < 4; i++ {
		if r.clients[i] != nil {
			r.clients[i].send_message(&protocol.Message{
				Type: protocol.Msg_Deal_Cards,
				Payload: protocol.Deal_Cards_Payload{
					Cards: r.game.Hands[i],
					Level: r.game.Level,
				},
			})
		}
	}

	r.game.Phase = game.Phase_Play
	r.game.Current_Turn = game.Random_Seat()
	r.send_turn_notification()
	r.trigger_bot_turn_if_needed()
}

func (r *Room) check_hand_end() bool {
	log.Printf("[DEBUG] check_hand_end: Finish_Order=%v, len=%d", r.game.Finish_Order, len(r.game.Finish_Order))

	if len(r.game.Finish_Order) < 2 {
		log.Printf("[DEBUG] check_hand_end: returning false (< 2 finished)")
		return false
	}

	first := r.game.Finish_Order[0]
	second := r.game.Finish_Order[1]

	first_team := first % 2
	second_team := second % 2

	log.Printf("[DEBUG] check_hand_end: first=%d (team %d), second=%d (team %d)", first, first_team, second, second_team)

	if first_team == second_team {
		log.Printf("[DEBUG] check_hand_end: same team finished 1-2, ending hand")
		r.end_hand(first_team, r.calculate_level_advance())
		return true
	}

	if len(r.game.Finish_Order) >= 3 {
		third := r.game.Finish_Order[2]
		third_team := third % 2

		log.Printf("[DEBUG] check_hand_end: 3+ finished, third=%d (team %d), ending hand", third, third_team)
		winning_team := first_team
		r.end_hand(winning_team, r.calculate_level_advance())
		return true
		_ = third_team
	}

	log.Printf("[DEBUG] check_hand_end: returning false (2 finished, different teams)")
	return false
}

func (r *Room) calculate_level_advance() int {
	if len(r.game.Finish_Order) < 2 {
		return 0
	}

	first := r.game.Finish_Order[0]
	first_team := first % 2

	// Find where the teammate (partner) finished
	partner_pos := -1
	for i, seat := range r.game.Finish_Order {
		if seat%2 == first_team && i != 0 {
			partner_pos = i
			break
		}
	}

	// If partner hasn't finished yet, they're 4th (position 3)
	if partner_pos == -1 {
		partner_pos = 3
	}

	log.Printf("[DEBUG] calculate_level_advance: first=%d, first_team=%d, partner_pos=%d", first, first_team, partner_pos)

	// 1-2 win (partner at position 1): +3
	// 1-3 win (partner at position 2): +2
	// 1-4 win (partner at position 3): +1
	switch partner_pos {
	case 1:
		return 3
	case 2:
		return 2
	default:
		return 1
	}
}

func (r *Room) end_hand(winning_team int, level_advance int) {
	log.Printf("[DEBUG] end_hand: winning_team=%d, level_advance=%d", winning_team, level_advance)

	old_level := r.game.Team_Levels[winning_team]
	new_level := old_level + level_advance
	if new_level > 12 {
		new_level = 12
	}
	r.game.Team_Levels[winning_team] = new_level

	log.Printf("[DEBUG] end_hand: broadcasting Hand_End, old_level=%d, new_level=%d", old_level, new_level)
	r.broadcast(&protocol.Message{
		Type: protocol.Msg_Hand_End,
		Payload: protocol.Hand_End_Payload{
			Finish_Order:  seats_to_ids(r.game.Finish_Order, r.clients),
			Winning_Team:  winning_team,
			Level_Advance: level_advance,
			New_Levels:    r.game.Team_Levels,
		},
	})

	if new_level >= 12 && game.Rank(old_level) == game.Rank_Ace {
		log.Printf("[DEBUG] end_hand: game over!")
		r.broadcast(&protocol.Message{
			Type: protocol.Msg_Game_End,
			Payload: protocol.Game_End_Payload{
				Winning_Team: winning_team,
				Final_Levels: r.game.Team_Levels,
			},
		})
		return
	}

	log.Printf("[DEBUG] end_hand: calling setup_tribute")
	r.setup_tribute()
}

func (r *Room) setup_tribute() {
	log.Printf("[DEBUG] setup_tribute: calling Setup_Tributes")
	r.game.Setup_Tributes()

	log.Printf("[DEBUG] setup_tribute: Tributes=%v, len=%d", r.game.Tributes, len(r.game.Tributes))

	// Deal new cards FIRST - players need cards to tribute from
	r.deal_new_cards()

	// Kang gong: if the paying side holds both red jokers, skip tribute.
	// Capture the original payers before the check clears Tributes so we can
	// tell clients who would have paid.
	// TODO(future): refactor the tribute phase UI to be more public —
	// currently only the paying/receiving seats see what's happening. The
	// whole table should see tribute cards, returns, and kang gong events.
	pre_kang_gong_payers := make([]int, 0, len(r.game.Tributes))
	for _, t := range r.game.Tributes {
		pre_kang_gong_payers = append(pre_kang_gong_payers, t.From_Seat)
	}
	if r.game.Check_Kang_Gong() {
		log.Printf("[DEBUG] setup_tribute: kang gong triggered, skipping tribute")
		r.broadcast(&protocol.Message{
			Type: protocol.Msg_Kang_Gong,
			Payload: protocol.Kang_Gong_Payload{
				From_Seats: pre_kang_gong_payers,
				Leader:     r.game.Tribute_Leader,
			},
		})
	}

	if len(r.game.Tributes) == 0 {
		// No tributes (e.g., tribute payer had both red jokers) - first finisher goes first
		log.Printf("[DEBUG] setup_tribute: no tributes, first finisher (seat %d) starts", r.game.Tribute_Leader)
		r.game.Phase = game.Phase_Play
		r.game.Current_Turn = r.game.Tribute_Leader
		r.send_turn_notification()
		r.trigger_bot_turn_if_needed()
		return
	}

	log.Printf("[DEBUG] setup_tribute: sending tribute messages")
	for _, t := range r.game.Tributes {
		if r.clients[t.From_Seat] != nil {
			r.clients[t.From_Seat].send_message(&protocol.Message{
				Type: protocol.Msg_Tribute,
				Payload: protocol.Tribute_Payload{
					From_Seat: t.From_Seat,
					To_Seat:   t.To_Seat,
				},
			})
		}
	}

	log.Printf("[DEBUG] setup_tribute: entering tribute phase")
	r.game.Phase = game.Phase_Tribute

	// Trigger bot tributes
	r.trigger_bot_tributes()
}

func (r *Room) trigger_bot_tributes() {
	// Only trigger ONE bot tribute at a time - the next will be triggered after this one completes
	for _, t := range r.game.Tributes {
		if t.Done {
			continue
		}

		client := r.clients[t.From_Seat]
		if client == nil || !client.is_bot {
			continue
		}

		log.Printf("[DEBUG] trigger_bot_tributes: bot at seat %d needs to tribute", t.From_Seat)

		// Find a non-wild card to tribute (pick the highest value card)
		hand := r.game.Hands[t.From_Seat]
		var best_card *game.Card
		best_value := 0

		for i := range hand {
			card := &hand[i]
			if game.Is_Wild(*card, r.game.Level) {
				continue
			}
			value := game.Card_Value(*card, r.game.Level)
			if value > best_value {
				best_value = value
				best_card = card
			}
		}

		if best_card == nil {
			log.Printf("[DEBUG] trigger_bot_tributes: no valid card found for bot at seat %d", t.From_Seat)
			continue
		}

		log.Printf("[DEBUG] trigger_bot_tributes: bot tributing card %v", best_card)

		// Perform the tribute - only one at a time
		go func(seat int, card_id int) {
			time.Sleep(500 * time.Millisecond)
			r.tribute <- Tribute_Action{
				client:  r.clients[seat],
				card_id: card_id,
			}
		}(t.From_Seat, best_card.Id)

		// Return after scheduling one tribute - the next will be triggered after this completes
		return
	}
}

func (r *Room) deal_new_cards() {
	log.Printf("[DEBUG] deal_new_cards: resetting and dealing")
	r.game.Reset_Hand()

	deck := game.New_Deck()
	deck.Shuffle()
	hands := deck.Deal()

	for i := 0; i < 4; i++ {
		r.game.Hands[i] = hands[i]
	}

	log.Printf("[DEBUG] deal_new_cards: sending Deal_Cards to all clients")
	for i := 0; i < 4; i++ {
		if r.clients[i] != nil {
			r.clients[i].send_message(&protocol.Message{
				Type: protocol.Msg_Deal_Cards,
				Payload: protocol.Deal_Cards_Payload{
					Cards: r.game.Hands[i],
					Level: r.game.Level,
				},
			})
		}
	}
}

func (r *Room) start_new_hand() {
	log.Printf("[DEBUG] start_new_hand: dealing cards and starting play")
	r.deal_new_cards()

	r.game.Phase = game.Phase_Play
	r.game.Current_Turn = r.game.Tribute_Leader
	r.send_turn_notification()
	r.trigger_bot_turn_if_needed()
}

func (r *Room) advance_turn() {
	log.Printf("[DEBUG] advance_turn: Current_Turn=%d, Finish_Order=%v", r.game.Current_Turn, r.game.Finish_Order)
	// Counterclockwise: 0 → 3 → 2 → 1 → 0
	for i := 1; i <= 4; i++ {
		next := (r.game.Current_Turn - i + 4) % 4
		finished := r.is_finished(next)
		absent := r.clients[next] == nil || r.clients[next].disconnected
		log.Printf("[DEBUG] advance_turn: checking seat %d, finished=%v, absent=%v", next, finished, absent)
		if !finished && !absent {
			log.Printf("[DEBUG] advance_turn: setting turn to seat %d", next)
			r.game.Current_Turn = next
			r.send_turn_notification()
			r.trigger_bot_turn_if_needed()
			return
		}
	}
	log.Printf("[DEBUG] advance_turn: no available player found!")
}

func (r *Room) is_finished(seat int) bool {
	for _, s := range r.game.Finish_Order {
		if s == seat {
			return true
		}
	}
	return false
}

func (r *Room) send_turn_notification() {
	can_pass := r.game.Current_Lead.Type != game.Comb_Invalid

	player_id := ""
	if c := r.clients[r.game.Current_Turn]; c != nil {
		player_id = c.id
	}

	r.broadcast(&protocol.Message{
		Type: protocol.Msg_Turn,
		Payload: protocol.Turn_Payload{
			Player_Id: player_id,
			Seat:      r.game.Current_Turn,
			Can_Pass:  can_pass,
		},
	})
}

func (r *Room) broadcast(msg *protocol.Message) {
	for _, client := range r.clients {
		if client != nil && !client.disconnected {
			client.send_message(msg)
		}
	}
}

func (r *Room) broadcast_room_state() {
	players := make([]protocol.Player_Info, 0)
	for i, c := range r.clients {
		if c != nil && !c.disconnected {
			players = append(players, protocol.Player_Info{
				Id:       c.id,
				Name:     c.name,
				Seat:     i,
				Team:     i % 2,
				Is_Ready: c.ready,
			})
		}
	}

	for _, client := range r.clients {
		if client != nil && !client.disconnected {
			client.send_message(&protocol.Message{
				Type: protocol.Msg_Room_State,
				Payload: protocol.Room_State_Payload{
					Room_Id:       r.id,
					Players:       players,
					Game_Active:   r.game != nil,
					Your_Id:       client.id,
					Session_Token: client.session_token,
					Is_Host:       r.host == client,
				},
			})
		}
	}
}

func (r *Room) find_empty_seat() int {
	for i := 0; i < 4; i++ {
		if r.clients[i] == nil {
			return i
		}
	}
	return -1
}

func (r *Room) is_full() bool {
	for _, c := range r.clients {
		if c == nil {
			return false
		}
	}
	return true
}

func (r *Room) get_seat(client *Client) int {
	for i, c := range r.clients {
		if c == client {
			return i
		}
	}
	return -1
}

func combo_type_name(t game.Combination_Type) string {
	names := map[game.Combination_Type]string{
		game.Comb_Single:     "single",
		game.Comb_Pair:       "pair",
		game.Comb_Triple:     "triple",
		game.Comb_Full_House: "full_house",
		game.Comb_Straight:   "straight",
		game.Comb_Tube:       "tube",
		game.Comb_Plate:      "plate",
		game.Comb_Bomb:       "bomb",
	}
	return names[t]
}

func seats_to_ids(seats []int, clients [4]*Client) []string {
	ids := make([]string, len(seats))
	for i, seat := range seats {
		if clients[seat] != nil {
			ids[i] = clients[seat].id
		}
	}
	return ids
}

func (r *Room) handle_pick_seat(action Pick_Seat_Action) {
	if r.game != nil {
		action.client.send_error("game already started")
		return
	}

	if action.seat < 0 || action.seat > 3 {
		action.client.send_error("invalid seat")
		return
	}

	if r.clients[action.seat] != nil && r.clients[action.seat] != action.client {
		action.client.send_error("seat is taken")
		return
	}

	// Find current seat and move
	for i := range 4 {
		if r.clients[i] == action.client {
			r.clients[i] = nil
			break
		}
	}
	r.clients[action.seat] = action.client
	action.client.ready = false // Reset ready when changing seats

	r.broadcast_room_state()
}

func (r *Room) handle_ready(client *Client) {
	if r.game != nil {
		return
	}

	client.ready = !client.ready
	r.broadcast_room_state()
}

func (r *Room) handle_start_game(client *Client) {
	if r.game != nil {
		return
	}
	if client != r.host {
		client.send_error("only the host can start the game")
		return
	}
	if !r.is_full() {
		client.send_error("need 4 players to start")
		return
	}
	// Check all human players are ready
	for _, c := range r.clients {
		if c != nil && !c.is_bot && !c.ready && c != r.host {
			client.send_error("not all players are ready")
			return
		}
	}
	r.start_game()
}

func (r *Room) handle_fill_bots() {
	bot_idx := 0
	for i := 0; i < 4; i++ {
		if r.clients[i] == nil && bot_idx < len(bot_names) {
			bot := new_bot(generate_id(), bot_names[bot_idx])
			bot.room = r
			bot.ready = true
			r.clients[i] = bot
			bot_idx++
		}
	}

	r.broadcast_room_state()
}

func (r *Room) handle_bot_turn(seat int) {
	log.Printf("[DEBUG] handle_bot_turn: seat=%d, Current_Turn=%d", seat, r.game.Current_Turn)

	if r.game == nil || r.game.Current_Turn != seat {
		log.Printf("[DEBUG] handle_bot_turn: returning early (game nil or not this bot's turn)")
		return
	}

	client := r.clients[seat]
	if client == nil || !client.is_bot {
		log.Printf("[DEBUG] handle_bot_turn: returning early (not a bot)")
		return
	}

	time.Sleep(1500 * time.Millisecond)

	hand := r.game.Hands[seat]
	log.Printf("[DEBUG] handle_bot_turn: seat=%d has %d cards", seat, len(hand))

	if len(hand) == 0 {
		log.Printf("[DEBUG] handle_bot_turn: bot has no cards, advancing turn")
		r.advance_turn()
		return
	}

	// No current lead - bot is leading
	if r.game.Current_Lead.Type == game.Comb_Invalid {
		play := game.Bot_Choose_Lead(hand, r.game.Level)
		if play == nil {
			log.Printf("[DEBUG] handle_bot_turn: Bot_Choose_Lead returned nil, using first card")
			play = []int{hand[0].Id}
		}
		log.Printf("[DEBUG] handle_bot_turn: leading with %v", play)
		r.handle_play(Play_Action{
			client:   client,
			card_ids: play,
		})
		return
	}

	// There is a current lead - bot must respond
	lead_team := r.game.Lead_Player % 2
	bot_team := seat % 2
	is_teammate_leading := lead_team == bot_team
	log.Printf("[DEBUG] handle_bot_turn: responding, lead_team=%d, bot_team=%d, teammate=%v", lead_team, bot_team, is_teammate_leading)

	// If teammate is leading, usually pass
	if is_teammate_leading {
		log.Printf("[DEBUG] handle_bot_turn: teammate is leading, passing")
		r.handle_pass(client)
		return
	}

	// Try to find a response
	play := game.Bot_Choose_Response(hand, r.game.Current_Lead, r.game.Level, is_teammate_leading)
	if play != nil {
		log.Printf("[DEBUG] handle_bot_turn: responding with %v", play)
		r.handle_play(Play_Action{
			client:   client,
			card_ids: play,
		})
		return
	}

	// No direct response - consider bombing
	analysis := game.Analyze_Hand(hand, r.game.Level)
	opponent_seat := (seat + 1) % 4 // Check one opponent
	opponent_cards := len(r.game.Hands[opponent_seat])

	if game.Bot_Should_Bomb(analysis, r.game.Current_Lead, r.game.Level, opponent_cards) {
		bomb := game.Bot_Get_Bomb(analysis, r.game.Level)
		if bomb != nil {
			// Verify the bomb actually beats the lead
			bomb_cards := r.game.Get_Cards_By_Id(seat, bomb)
			if bomb_cards != nil {
				combo := game.Detect_Combination(bomb_cards, r.game.Level)
				if game.Can_Beat(combo, r.game.Current_Lead) {
					log.Printf("[DEBUG] handle_bot_turn: bombing with %v", bomb)
					r.handle_play(Play_Action{
						client:   client,
						card_ids: bomb,
					})
					return
				}
			}
		}
	}

	log.Printf("[DEBUG] handle_bot_turn: no valid play or bomb, passing")
	r.handle_pass(client)
}

func (r *Room) trigger_bot_turn_if_needed() {
	if r.game == nil {
		return
	}

	seat := r.game.Current_Turn
	client := r.clients[seat]
	if client != nil && client.is_bot {
		go func() {
			r.bot_turn <- seat
		}()
	}
}

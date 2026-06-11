package protocol

import "guandanbtw/game"

type Msg_Type string

const (
	Msg_Join_Room           Msg_Type = "join_room"
	Msg_Create_Room         Msg_Type = "create_room"
	Msg_Room_State          Msg_Type = "room_state"
	Msg_Game_Start          Msg_Type = "game_start"
	Msg_Deal_Cards          Msg_Type = "deal_cards"
	Msg_Play_Cards          Msg_Type = "play_cards"
	Msg_Pass                Msg_Type = "pass"
	Msg_Turn                Msg_Type = "turn"
	Msg_Play_Made           Msg_Type = "play_made"
	Msg_Hand_End            Msg_Type = "hand_end"
	Msg_Tribute             Msg_Type = "tribute"
	Msg_Tribute_Give        Msg_Type = "tribute_give"
	Msg_Tribute_Recv        Msg_Type = "tribute_recv"
	Msg_Tribute_Return      Msg_Type = "tribute_return"
	Msg_Tribute_Return_Give Msg_Type = "tribute_return_give"
	Msg_Tribute_Give_Ok     Msg_Type = "tribute_give_ok"
	Msg_Tribute_Return_Ok   Msg_Type = "tribute_return_ok"
	Msg_Kang_Gong           Msg_Type = "kang_gong"        // no tax if 2 red jokers
	Msg_Tribute_Paid        Msg_Type = "tribute_paid"     // server -> clients: a tribute card changed hands
	Msg_Tribute_Returned    Msg_Type = "tribute_returned" // server -> clients: a return card changed hands
	Msg_Game_End            Msg_Type = "game_end"
	Msg_Error               Msg_Type = "error"
	Msg_Player_Joined       Msg_Type = "player_joined"
	Msg_Player_Left         Msg_Type = "player_left"
	Msg_Fill_Bots           Msg_Type = "fill_bots"
	Msg_Reconnect           Msg_Type = "reconnect"
	Msg_Reconnect_Success   Msg_Type = "reconnect_success"
	Msg_Player_Disconnected Msg_Type = "player_disconnected"
	Msg_Player_Reconnected  Msg_Type = "player_reconnected"
	Msg_Start_Game          Msg_Type = "start_game"
	Msg_Pick_Seat           Msg_Type = "pick_seat"
	Msg_Ready               Msg_Type = "ready"
	Msg_Leave_Room          Msg_Type = "leave_room"
	Msg_Queue_Join          Msg_Type = "queue_join"
	Msg_Queue_Leave         Msg_Type = "queue_leave"
	Msg_Queue_Status        Msg_Type = "queue_status"
	Msg_Requeued            Msg_Type = "requeued"
)

type Message struct {
	Type    Msg_Type    `json:"type"`
	Payload interface{} `json:"payload"`
}

type Join_Room_Payload struct {
	Room_Id     string `json:"room_id"`
	Player_Name string `json:"player_name"`
}

type Create_Room_Payload struct {
	Player_Name string `json:"player_name"`
}

type Room_State_Payload struct {
	Room_Id       string        `json:"room_id"`
	Players       []Player_Info `json:"players"`
	Game_Active   bool          `json:"game_active"`
	Your_Id       string        `json:"your_id"`
	Session_Token string        `json:"session_token,omitempty"`
	Is_Host       bool          `json:"is_host"`
	Quick_Match   bool          `json:"quick_match"`
}

type Queue_Join_Payload struct {
	Player_Name string `json:"player_name"`
}

type Queue_Status_Payload struct {
	Found  int `json:"found"`
	Needed int `json:"needed"`
}

type Player_Info struct {
	Id       string `json:"id"`
	Name     string `json:"name"`
	Seat     int    `json:"seat"`
	Team     int    `json:"team"`
	Is_Ready bool   `json:"is_ready"`
}

type Deal_Cards_Payload struct {
	Cards []game.Card `json:"cards"`
	Level game.Rank   `json:"level"`
}

type Play_Cards_Payload struct {
	Card_Ids []int `json:"card_ids"`
}

type Turn_Payload struct {
	Player_Id       string           `json:"player_id"`
	Seat            int              `json:"seat"`
	Lead_Combo_Type game.Combination `json:"lead_combo_type,omitempty"`
	Can_Pass        bool             `json:"can_pass"`
}

type Play_Made_Payload struct {
	Player_Id  string      `json:"player_id"`
	Seat       int         `json:"seat"`
	Cards      []game.Card `json:"cards"`
	Combo_Type string      `json:"combo_type"`
	Is_Pass    bool        `json:"is_pass"`
}

type Hand_End_Payload struct {
	Finish_Order  []string `json:"finish_order"`
	Winning_Team  int      `json:"winning_team"`
	Level_Advance int      `json:"level_advance"`
	New_Levels    [2]int   `json:"new_levels"`
}

type Tribute_Payload struct {
	From_Seat int `json:"from_seat"`
	To_Seat   int `json:"to_seat"`
}

type Tribute_Give_Payload struct {
	Card_Id int `json:"card_id"`
}

type Tribute_Recv_Payload struct {
	Card game.Card `json:"card"`
}

type Tribute_Return_Payload struct {
	To_Seat int `json:"to_seat"`
}

type Tribute_Ok_Payload struct {
	Card_Id int `json:"card_id"`
}

type Tribute_Public_Payload struct {
	From_Seat int       `json:"from_seat"`
	To_Seat   int       `json:"to_seat"`
	Card      game.Card `json:"card"`
}

type Kang_Gong_Payload struct {
	From_Seats []int `json:"from_seats"`
	Leader     int   `json:"leader"`
}

type Game_End_Payload struct {
	Winning_Team int    `json:"winning_team"`
	Final_Levels [2]int `json:"final_levels"`
}

type Error_Payload struct {
	Message string `json:"message"`
}

type Reconnect_Payload struct {
	Session_Token string `json:"session_token"`
	Room_Id       string `json:"room_id"`
}

type Reconnect_Success_Payload struct {
	Session_Token string        `json:"session_token"`
	Room_Id       string        `json:"room_id"`
	Players       []Player_Info `json:"players"`
	Your_Id       string        `json:"your_id"`
	Seat          int           `json:"seat"`
	Cards         []game.Card   `json:"cards"`
	Level         game.Rank     `json:"level"`
	Current_Turn  int           `json:"current_turn"`
	Can_Pass      bool          `json:"can_pass"`
	Table_Cards   []game.Card   `json:"table_cards"`
	Combo_Type    string        `json:"combo_type"`
	Card_Counts   [4]int        `json:"card_counts"`
	Team_Levels   [2]int        `json:"team_levels"`
	Leading_Seat  int           `json:"leading_seat"`
	Game_Active   bool          `json:"game_active"`
}

type Player_Status_Payload struct {
	Player_Id string `json:"player_id"`
	Seat      int    `json:"seat"`
	Name      string `json:"name"`
}

type Pick_Seat_Payload struct {
	Seat int `json:"seat"`
}

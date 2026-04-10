package room

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"guandanbtw/protocol"
)

const (
	write_wait       = 10 * time.Second
	pong_wait        = 60 * time.Second
	ping_period      = (pong_wait * 9) / 10
	max_message_size = 4096
)

type Client struct {
	id            string
	name          string
	session_token string
	room          *Room
	conn          *websocket.Conn
	send          chan []byte
	mu            sync.Mutex
	is_bot        bool
	disconnected  bool
}

func new_client(id string, conn *websocket.Conn) *Client {
	return &Client{
		id:            id,
		session_token: generate_id(), // Unique session token for reconnection
		conn:          conn,
		send:          make(chan []byte, 256),
	}
}

var bot_names = []string{"Bot Alice", "Bot Bob", "Bot Charlie"}

func new_bot(id string, name string) *Client {
	return &Client{
		id:     id,
		name:   name,
		send:   make(chan []byte, 256),
		is_bot: true,
	}
}

func (c *Client) read_pump(hub *Hub) {
	defer func() {
		if c.room != nil {
			c.room.leave <- c
		}
		hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(max_message_size)
	c.conn.SetReadDeadline(time.Now().Add(pong_wait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pong_wait))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}

		var msg protocol.Message
		if err := json.Unmarshal(data, &msg); err != nil {
			c.send_error("invalid message format")
			continue
		}

		c.handle_message(hub, &msg)
	}
}

func (c *Client) write_pump() {
	ticker := time.NewTicker(ping_period)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(write_wait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(write_wait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handle_message(hub *Hub, msg *protocol.Message) {
	switch msg.Type {
	case protocol.Msg_Create_Room:
		c.handle_create_room(hub, msg)
	case protocol.Msg_Join_Room:
		c.handle_join_room(hub, msg)
	case protocol.Msg_Reconnect:
		c.handle_reconnect(hub, msg)
	case protocol.Msg_Play_Cards:
		c.handle_play_cards(msg)
	case protocol.Msg_Pass:
		c.handle_pass()
	case protocol.Msg_Tribute_Give:
		c.handle_tribute_give(msg)
	case protocol.Msg_Tribute_Return_Give:
		c.handle_tribute_return_give(msg)
	case protocol.Msg_Fill_Bots:
		c.handle_fill_bots()
	}
}

func (c *Client) handle_fill_bots() {
	if c.room == nil {
		return
	}
	c.room.fill_bots <- c
}

func (c *Client) handle_create_room(hub *Hub, msg *protocol.Message) {
	payload_bytes, _ := json.Marshal(msg.Payload)
	var payload protocol.Create_Room_Payload
	json.Unmarshal(payload_bytes, &payload)

	c.name = payload.Player_Name
	room := hub.create_room()
	room.join <- c
}

func (c *Client) handle_join_room(hub *Hub, msg *protocol.Message) {
	payload_bytes, _ := json.Marshal(msg.Payload)
	var payload protocol.Join_Room_Payload
	json.Unmarshal(payload_bytes, &payload)

	c.name = payload.Player_Name
	room := hub.get_room(payload.Room_Id)
	if room == nil {
		c.send_error("room not found")
		return
	}
	room.join <- c
}

func (c *Client) handle_reconnect(hub *Hub, msg *protocol.Message) {
	payload_bytes, _ := json.Marshal(msg.Payload)
	var payload protocol.Reconnect_Payload
	json.Unmarshal(payload_bytes, &payload)

	room := hub.get_room(payload.Room_Id)
	if room == nil {
		c.send_error("room not found")
		return
	}

	// Try to reconnect using session token
	room.reconnect <- Reconnect_Request{
		new_client:    c,
		session_token: payload.Session_Token,
	}
}

func (c *Client) handle_play_cards(msg *protocol.Message) {
	if c.room == nil {
		return
	}

	payload_bytes, _ := json.Marshal(msg.Payload)
	var payload protocol.Play_Cards_Payload
	json.Unmarshal(payload_bytes, &payload)

	c.room.play <- Play_Action{
		client:   c,
		card_ids: payload.Card_Ids,
	}
}

func (c *Client) handle_pass() {
	if c.room == nil {
		return
	}

	c.room.pass <- c
}

func (c *Client) handle_tribute_give(msg *protocol.Message) {
	if c.room == nil {
		return
	}

	payload_bytes, _ := json.Marshal(msg.Payload)
	var payload protocol.Tribute_Give_Payload
	json.Unmarshal(payload_bytes, &payload)

	c.room.tribute <- Tribute_Action{
		client:  c,
		card_id: payload.Card_Id,
	}
}

func (c *Client) handle_tribute_return_give(msg *protocol.Message) {
	if c.room == nil {
		return
	}

	payload_bytes, _ := json.Marshal(msg.Payload)
	var payload protocol.Tribute_Give_Payload
	json.Unmarshal(payload_bytes, &payload)

	c.room.tribute_return <- Tribute_Action{
		client:  c,
		card_id: payload.Card_Id,
	}
}

func (c *Client) send_message(msg *protocol.Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	select {
	case c.send <- data:
	default:
	}
}

func (c *Client) send_error(message string) {
	c.send_message(&protocol.Message{
		Type: protocol.Msg_Error,
		Payload: protocol.Error_Payload{
			Message: message,
		},
	})
}

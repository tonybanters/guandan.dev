package room

import (
	"crypto/rand"
	"encoding/hex"
	"github.com/gorilla/websocket"
	"guandanbtw/protocol"
	"net/http"
	"sync"
)

type Hub struct {
	rooms      map[string]*Room
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex

	queue       []*Client
	queue_join  chan *Client
	queue_leave chan *Client

	// buffered so a room goroutine disbanding never blocks on the hub
	requeue chan []*Client
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func New_Hub() *Hub {
	return &Hub{
		rooms:       make(map[string]*Room),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		queue_join:  make(chan *Client),
		queue_leave: make(chan *Client),
		requeue:     make(chan []*Client, 8),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			_ = client
		case client := <-h.unregister:
			h.remove_from_queue(client)
			if client.room != nil {
				client.room.leave <- client
			}
		case client := <-h.queue_join:
			h.handle_queue_join(client)
		case client := <-h.queue_leave:
			h.remove_from_queue(client)
			h.broadcast_queue_status()
		case clients := <-h.requeue:
			h.queue = append(clients, h.queue...)
			h.try_match()
			h.broadcast_queue_status()
		}
	}
}

func (h *Hub) handle_queue_join(client *Client) {
	for _, c := range h.queue {
		if c == client {
			return
		}
	}
	h.queue = append(h.queue, client)
	h.try_match()
	h.broadcast_queue_status()
}

func (h *Hub) remove_from_queue(client *Client) {
	for i, c := range h.queue {
		if c == client {
			h.queue = append(h.queue[:i], h.queue[i+1:]...)
			return
		}
	}
}

func (h *Hub) try_match() {
	for len(h.queue) >= 4 {
		matched := make([]*Client, 4)
		copy(matched, h.queue[:4])
		h.queue = h.queue[4:]

		room := h.create_room()
		room.is_quick_match = true

		for _, c := range matched {
			c.ready = true
		}
		for _, c := range matched {
			room.join <- c
		}
		room.start_game_req <- matched[0]
	}
}

func (h *Hub) broadcast_queue_status() {
	for _, c := range h.queue {
		c.send_message(&protocol.Message{
			Type: protocol.Msg_Queue_Status,
			Payload: protocol.Queue_Status_Payload{
				Found:  len(h.queue),
				Needed: 4,
			},
		})
	}
}

func (h *Hub) Handle_Websocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := new_client(generate_id(), conn)

	h.register <- client

	go client.write_pump()
	go client.read_pump(h)
}

func (h *Hub) create_room() *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	room := new_room(generate_room_code())
	room.hub = h
	h.rooms[room.id] = room
	go room.run()

	return room
}

func (h *Hub) get_room(id string) *Room {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return h.rooms[id]
}

func (h *Hub) delete_room(id string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.rooms, id)
}

func generate_id() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generate_room_code() string {
	b := make([]byte, 3)
	rand.Read(b)
	return hex.EncodeToString(b)
}

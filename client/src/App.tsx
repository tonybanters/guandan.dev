import { useCallback, useEffect, useState } from 'react'
import { use_websocket } from './hooks/use_websocket'
import { Lobby } from './components/Lobby'
import { Game } from './components/Game'
import {
  Card,
  Player_Info,
  Rank,
  Rank_Two,
  Message,
} from './game/types'
import {
  find_same_rank,
} from './game/combos'

interface Deal_Cards_Payload {
  cards: Card[]
  level: Rank
}

interface Room_State_Payload {
  room_id: string
  players: Player_Info[]
  game_active: boolean
  your_id: string
}

interface Turn_Payload {
  player_id: string
  seat: number
  can_pass: boolean
}

interface Play_Made_Payload {
  player_id: string
  seat: number
  cards: Card[]
  combo_type: string
  is_pass: boolean
}

interface Error_Payload {
  message: string
}

interface Reconnect_Success_Payload {
  session_token: string
  room_id: string
  players: Player_Info[]
  your_id: string
  seat: number
  cards: Card[]
  level: Rank
  current_turn: number
  can_pass: boolean
  table_cards: Card[]
  combo_type: string
  card_counts: [number, number, number, number]
  team_levels: [number, number]
  leading_seat: number
  game_active: boolean
}

function get_ws_url(): string {
  // In production, use the configured URL
  if (import.meta.env.VITE_WS_URL && import.meta.env.PROD) {
    return import.meta.env.VITE_WS_URL
  }
  // In development, use the Vite proxy so it works from any device on the network
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

export default function App() {
  const ws_url = get_ws_url()
  const { connected, reconnecting, send, on } = use_websocket(ws_url)

  const [room_id, set_room_id] = useState<string | null>(null)
  const [players, set_players] = useState<Player_Info[]>([])
  const [game_active, set_game_active] = useState(false)

  const [hand, set_hand] = useState<Card[]>([])
  const [level, set_level] = useState<Rank>(Rank_Two)
  const [selected_ids, set_selected_ids] = useState<Set<number>>(new Set())
  const [current_turn, set_current_turn] = useState(0)
  const [my_seat, set_my_seat] = useState(0)
  const [can_pass, set_can_pass] = useState(false)
  const [table_cards, set_table_cards] = useState<Card[]>([])
  const [combo_type, set_combo_type] = useState('')
  const [player_card_counts, set_player_card_counts] = useState([27, 27, 27, 27])
  const [team_levels, set_team_levels] = useState<[number, number]>([0, 0])
  const [error, set_error] = useState<string | null>(null)
  const [players_map, set_players_map] = useState<Record<number, string>>({})
  const [last_play_seat, set_last_play_seat] = useState<number | null>(null)
  const [player_plays, set_player_plays] = useState<Record<number, { cards: Card[], is_pass: boolean }>>({})
  const [leading_seat, set_leading_seat] = useState<number | null>(null)
  const [tribute_target, set_tribute_target] = useState<number | null>(null) // seat to give tribute to
  const [return_target, set_return_target] = useState<number | null>(null) // seat to return card to
  const [received_tribute_card, set_received_tribute_card] = useState<Card | null>(null)

  useEffect(() => {
    const unsub_room_state = on('room_state', (msg: Message) => {
      const payload = msg.payload as Room_State_Payload
      set_room_id(payload.room_id)
      set_players(payload.players)
      set_game_active(payload.game_active)

      const me = payload.players.find((p) => p.id === payload.your_id)
      if (me) {
        set_my_seat(me.seat)
      }
      const pmap: Record<number, string> = {}
      payload.players.forEach((p) => {
        pmap[p.seat] = p.name
      })
      set_players_map(pmap)
    })

    const unsub_deal = on('deal_cards', (msg: Message) => {
      const payload = msg.payload as Deal_Cards_Payload
      set_hand(sort_cards(payload.cards, payload.level))
      set_level(payload.level)
      set_game_active(true)
      set_table_cards([])
      set_combo_type('')
      set_selected_ids(new Set())
      set_player_card_counts([27, 27, 27, 27])
      set_player_plays({})
      set_leading_seat(null)
      set_tribute_target(null)
      set_return_target(null)
    })

    const unsub_turn = on('turn', (msg: Message) => {
      const payload = msg.payload as Turn_Payload
      set_current_turn(payload.seat)
      set_can_pass(payload.can_pass)
      // When can_pass is false, this player has control (new trick starting)
      if (!payload.can_pass) {
        set_player_plays({})
        set_leading_seat(null)
      }
    })

    const unsub_play_made = on('play_made', (msg: Message) => {
      const payload = msg.payload as Play_Made_Payload

      set_last_play_seat(payload.seat)
      setTimeout(() => set_last_play_seat(null), 800)

      // Track this player's play
      set_player_plays(prev => ({
        ...prev,
        [payload.seat]: { cards: payload.cards, is_pass: payload.is_pass }
      }))

      if (!payload.is_pass) {
        set_table_cards(payload.cards)
        set_combo_type(payload.combo_type)
        set_leading_seat(payload.seat)
        set_player_card_counts((prev) => {
          const next = [...prev]
          next[payload.seat] -= payload.cards.length
          return next as [number, number, number, number]
        })
        const played_ids = new Set(payload.cards.map((c) => c.Id))
        set_hand((prev) => prev.filter((c) => !played_ids.has(c.Id)))
      }
    })

    const unsub_hand_end = on('hand_end', (msg: Message) => {
      const payload = msg.payload as { new_levels: [number, number] }
      set_team_levels(payload.new_levels)
    })

    const unsub_error = on('error', (msg: Message) => {
      const payload = msg.payload as Error_Payload
      set_error(payload.message)
      setTimeout(() => set_error(null), 3000)
    })

    const unsub_tribute = on('tribute', (msg: Message) => {
      const payload = msg.payload as { from_seat: number; to_seat: number }
      // Server tells us we need to give tribute to someone
      set_tribute_target(payload.to_seat)
    })

    const unsub_tribute_return = on('tribute_return', (msg: Message) => {
      const payload = msg.payload as { to_seat: number }
      // Server tells us we need to return a card to someone
      set_return_target(payload.to_seat)
    })

    const unsub_tribute_recv = on('tribute_recv', (msg: Message) => {
      const payload = msg.payload as { card: Card }
      // We received a card from tribute - add to hand
      set_hand((prev) => sort_cards([...prev, payload.card], level))
      // Show UI notification of received card
      set_received_tribute_card(payload.card)
      setTimeout(() => set_received_tribute_card(null), 2500)
    })

    const unsub_tribute_give_ok = on('tribute_give_ok', (msg: Message) => {
      const payload = msg.payload as { card_id: number }
      set_tribute_target(null)
      set_hand((prev) => prev.filter((c) => c.Id !== payload.card_id))
    })

    const unsub_tribute_return_ok = on('tribute_return_ok', (msg: Message) => {
      const payload = msg.payload as { card_id: number }
      set_return_target(null)
      set_hand((prev) => prev.filter((c) => c.Id !== payload.card_id))
    })

    const unsub_reconnect_success = on('reconnect_success', (msg: Message) => {
      const payload = msg.payload as Reconnect_Success_Payload
      // Restore full game state from reconnection
      set_room_id(payload.room_id)
      set_players(payload.players)
      set_game_active(payload.game_active)
      set_my_seat(payload.seat)
      set_hand(sort_cards(payload.cards, payload.level))
      set_level(payload.level)
      set_current_turn(payload.current_turn)
      set_can_pass(payload.can_pass)
      set_table_cards(payload.table_cards || [])
      set_combo_type(payload.combo_type || '')
      set_player_card_counts(payload.card_counts)
      set_team_levels(payload.team_levels)
      set_leading_seat(payload.leading_seat)
      set_selected_ids(new Set())
      set_player_plays({})

      const pmap: Record<number, string> = {}
      payload.players.forEach((p) => {
        pmap[p.seat] = p.name
      })
      set_players_map(pmap)
    })

    const unsub_player_disconnected = on('player_disconnected', (msg: Message) => {
      const payload = msg.payload as { player_id: string; seat: number; name: string }
      set_players_map((prev) => ({
        ...prev,
        [payload.seat]: `${prev[payload.seat] || payload.name} (disconnected)`,
      }))
    })

    const unsub_player_reconnected = on('player_reconnected', (msg: Message) => {
      const payload = msg.payload as { player_id: string; seat: number; name: string }
      set_players_map((prev) => ({
        ...prev,
        [payload.seat]: payload.name,
      }))
    })

    return () => {
      unsub_room_state()
      unsub_deal()
      unsub_turn()
      unsub_play_made()
      unsub_hand_end()
      unsub_error()
      unsub_tribute()
      unsub_tribute_return()
      unsub_tribute_recv()
      unsub_tribute_give_ok()
      unsub_tribute_return_ok()
      unsub_reconnect_success()
      unsub_player_disconnected()
      unsub_player_reconnected()
    }
  }, [on, level])

  const handle_create_room = useCallback(
    (name: string) => {
      send({
        type: 'create_room',
        payload: { player_name: name },
      })
    },
    [send]
  )

  const handle_join_room = useCallback(
    (room_code: string, name: string) => {
      send({
        type: 'join_room',
        payload: { room_id: room_code, player_name: name },
      })
    },
    [send]
  )

  const handle_fill_bots = useCallback(() => {
    send({ type: 'fill_bots', payload: {} })
  }, [send])

  const handle_card_click = useCallback((id: number) => {
    set_selected_ids((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handle_clear_selection = useCallback(() => {
    set_selected_ids(new Set())
  }, [])

  const handle_select_same_rank = useCallback((rank: number) => {
    set_hand((current_hand) => {
      const same_rank_cards = find_same_rank(current_hand, rank)
      set_selected_ids((prev) => {
        const next = new Set(prev)
        // Toggle: if all are selected, deselect all; otherwise select all
        const all_selected = same_rank_cards.every(c => prev.has(c.Id))
        if (all_selected) {
          same_rank_cards.forEach(c => next.delete(c.Id))
        } else {
          same_rank_cards.forEach(c => next.add(c.Id))
        }
        return next
      })
      return current_hand
    })
  }, [])

  const handle_play = useCallback(() => {
    if (selected_ids.size === 0) return

    send({
      type: 'play_cards',
      payload: { card_ids: Array.from(selected_ids) },
    })

    set_selected_ids(new Set())
  }, [send, selected_ids])

  const handle_pass = useCallback(() => {
    send({ type: 'pass', payload: {} })
  }, [send])

  const handle_give_tribute = useCallback((card_id: number) => {
    send({ type: 'tribute_give', payload: { card_id } })
  }, [send])

  const handle_give_return = useCallback((card_id: number) => {
    send({ type: 'tribute_return_give', payload: { card_id } })
  }, [send])

  const handle_tribute_play = useCallback(() => {
    if (selected_ids.size !== 1) return
    const card_id = Array.from(selected_ids)[0]
    if (tribute_target !== null) {
      handle_give_tribute(card_id)
    } else if (return_target !== null) {
      handle_give_return(card_id)
    }
    set_selected_ids(new Set())
  }, [selected_ids, tribute_target, return_target, handle_give_tribute, handle_give_return])

  if (!connected || reconnecting) {
    return (
      <div style={styles.connecting}>
        <div>{reconnecting ? 'Reconnecting...' : 'Connecting...'}</div>
      </div>
    )
  }

  if (!game_active) {
    return (
      <>
        <Lobby
          room_id={room_id}
          players={players}
          on_create_room={handle_create_room}
          on_join_room={handle_join_room}
          on_fill_bots={handle_fill_bots}
        />
        {error && <div style={styles.error}>{error}</div>}
      </>
    )
  }

  return (
    <>
      <Game
        hand={hand}
        level={level}
        selected_ids={selected_ids}
        on_card_click={handle_card_click}
        on_select_same_rank={handle_select_same_rank}
        on_clear_selection={handle_clear_selection}
        on_play={handle_play}
        on_pass={handle_pass}
        table_cards={table_cards}
        combo_type={combo_type}
        current_turn={current_turn}
        my_seat={my_seat}
        can_pass={can_pass}
        player_card_counts={player_card_counts}
        team_levels={team_levels}
        players_map={players_map}
        last_play_seat={last_play_seat}
        player_plays={player_plays}
        leading_seat={leading_seat}
        is_tribute_mode={tribute_target !== null ? 'give' : return_target !== null ? 'return' : false}
        tribute_target_name={tribute_target !== null ? (players_map[tribute_target] || `Player ${tribute_target + 1}`) : (return_target !== null ? (players_map[return_target] || `Player ${return_target + 1}`) : undefined)}
        on_tribute={handle_tribute_play}
        received_tribute_card={received_tribute_card}
      />
      {error && <div style={styles.error}>{error}</div>}
    </>
  )
}

function sort_cards(cards: Card[], level: Rank): Card[] {
  return [...cards].sort((a, b) => {
    const va = card_sort_value(a, level)
    const vb = card_sort_value(b, level)
    if (va !== vb) return va - vb
    return a.Suit - b.Suit
  })
}

function card_sort_value(card: Card, level: Rank): number {
  if (card.Rank === 14) return 100
  if (card.Rank === 13) return 99
  if (card.Rank === level) return 98

  const base_order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  return base_order[card.Rank] ?? 0
}

const styles: Record<string, React.CSSProperties> = {
  connecting: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontSize: 24,
  },
  error: {
    position: 'fixed',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    backgroundColor: '#dc3545',
    color: '#fff',
    borderRadius: 8,
    zIndex: 1000,
  },
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { use_websocket } from './hooks/use_websocket'
import { Home } from './components/Home'
import { Lobby } from './components/Lobby'
import { Game } from './components/Game'
import {
    Card,
    Player_Info,
    Rank,
    Rank_Two,
    Message,
    Tribute_Event,
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
    is_host: boolean
    quick_match: boolean
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
    if (import.meta.env.VITE_WS_URL && import.meta.env.PROD) {
        return import.meta.env.VITE_WS_URL
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}/ws`
}

function get_room_id_from_url(): string | null {
    const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]+)$/)
    return match ? match[1] : null
}

export default function App() {
    const ws_url = get_ws_url()
    const { connected, reconnecting, send, on, logout, saved_session, try_reconnect } = use_websocket(ws_url)
    const practice_pending = useRef(false)

    const [pending_room_id] = useState<string | null>(get_room_id_from_url)
    const [room_id, set_room_id] = useState<string | null>(null)
    const [players, set_players] = useState<Player_Info[]>([])
    const [game_active, set_game_active] = useState(false)
    const [is_host, set_is_host] = useState(false)

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
    const [tribute_target, set_tribute_target] = useState<number | null>(null)
    const [return_target, set_return_target] = useState<number | null>(null)
    const [tribute_events, set_tribute_events] = useState<Tribute_Event[]>([])
    const tribute_event_id = useRef(0)

    const [in_queue, set_in_queue] = useState(false)
    const [queue_found, set_queue_found] = useState(1)
    const [is_quick_match, set_is_quick_match] = useState(false)
    const [round_winner, set_round_winner] = useState<number | null>(null)

    useEffect(() => {
        if (!connected) set_in_queue(false)
    }, [connected])

    useEffect(() => {
        const unsub_room_state = on('room_state', (msg: Message) => {
            const payload = msg.payload as Room_State_Payload
            set_room_id(payload.room_id)
            set_players(payload.players)
            set_game_active(payload.game_active)
            set_is_host(payload.is_host)
            set_is_quick_match(payload.quick_match)
            set_in_queue(false)
            window.history.replaceState({}, '', `/room/${payload.room_id}`)

            const me = payload.players.find((p) => p.id === payload.your_id)
            if (me) {
                set_my_seat(me.seat)
            }
            const pmap: Record<number, string> = {}
            payload.players.forEach((p) => {
                pmap[p.seat] = p.name
            })
            set_players_map(pmap)

            if (practice_pending.current && payload.is_host && !payload.game_active) {
                practice_pending.current = false
                send({ type: 'fill_bots', payload: {} })
                send({ type: 'start_game', payload: {} })
            }
        })

        const unsub_deal = on('deal_cards', (msg: Message) => {
            const payload = msg.payload as Deal_Cards_Payload
            set_hand(sort_cards(payload.cards, payload.level))
            set_level(payload.level)
            set_game_active(true)
            set_round_winner(null)
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

            if (!payload.can_pass) {
                set_player_plays({})
                set_leading_seat(null)
            }
        })

        const unsub_play_made = on('play_made', (msg: Message) => {
            const payload = msg.payload as Play_Made_Payload

            set_last_play_seat(payload.seat)
            setTimeout(() => set_last_play_seat(null), 800)

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
            const payload = msg.payload as { new_levels: [number, number]; winning_team: number }
            set_team_levels(payload.new_levels)
            set_round_winner(payload.winning_team)
        })

        const unsub_queue_status = on('queue_status', (msg: Message) => {
            const payload = msg.payload as { found: number }
            set_queue_found(payload.found)
            set_in_queue(true)
        })

        const unsub_requeued = on('requeued', () => {
            set_room_id(null)
            set_game_active(false)
            set_players([])
            set_hand([])
            set_selected_ids(new Set())
            set_player_plays({})
            set_round_winner(null)
            set_in_queue(true)
            set_queue_found(1)
            window.history.replaceState({}, '', '/')
        })

        const unsub_error = on('error', (msg: Message) => {
            const payload = msg.payload as Error_Payload
            set_error(payload.message)
            setTimeout(() => set_error(null), 3000)
        })

        const unsub_tribute = on('tribute', (msg: Message) => {
            const payload = msg.payload as { from_seat: number; to_seat: number }
            set_tribute_target(payload.to_seat)
        })

        const unsub_tribute_return = on('tribute_return', (msg: Message) => {
            const payload = msg.payload as { to_seat: number }
            set_return_target(payload.to_seat)
        })

        const unsub_tribute_recv = on('tribute_recv', (msg: Message) => {
            const payload = msg.payload as { card: Card }
            set_hand((prev) => sort_cards([...prev, payload.card], level))
        })

        const push_tribute_event = (kind: Tribute_Event['kind'], from_seat: number, to_seat: number, card: Card | null) => {
            const id = ++tribute_event_id.current
            set_tribute_events((prev) => [...prev, { id, kind, from_seat, to_seat, card }])
            setTimeout(() => set_tribute_events((prev) => prev.filter((e) => e.id !== id)), 7000)
        }

        const unsub_tribute_paid = on('tribute_paid', (msg: Message) => {
            const payload = msg.payload as { from_seat: number; to_seat: number; card: Card }
            push_tribute_event('pay', payload.from_seat, payload.to_seat, payload.card)
        })

        const unsub_tribute_returned = on('tribute_returned', (msg: Message) => {
            const payload = msg.payload as { from_seat: number; to_seat: number; card: Card }
            push_tribute_event('return', payload.from_seat, payload.to_seat, payload.card)
        })

        const unsub_kang_gong = on('kang_gong', () => {
            push_tribute_event('kang_gong', -1, -1, null)
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
            set_room_id(payload.room_id)
            window.history.replaceState({}, '', `/room/${payload.room_id}`)
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
            unsub_tribute_paid()
            unsub_tribute_returned()
            unsub_kang_gong()
            unsub_tribute_give_ok()
            unsub_tribute_return_ok()
            unsub_reconnect_success()
            unsub_player_disconnected()
            unsub_player_reconnected()
            unsub_queue_status()
            unsub_requeued()
        }
    }, [on, send, level])

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

    const handle_start_game = useCallback(() => {
        send({ type: 'start_game', payload: {} })
    }, [send])

    const handle_pick_seat = useCallback((seat: number) => {
        send({ type: 'pick_seat', payload: { seat } })
    }, [send])

    const handle_ready = useCallback(() => {
        send({ type: 'ready', payload: {} })
    }, [send])

    const handle_leave = useCallback(() => {
        send({ type: 'leave_room', payload: {} })
        logout()
        setTimeout(() => {
            window.location.href = '/'
        }, 100)
    }, [send, logout])

    const handle_quick_match = useCallback(
        (name: string) => {
            send({ type: 'queue_join', payload: { player_name: name } })
            set_in_queue(true)
            set_queue_found(1)
        },
        [send]
    )

    const handle_cancel_queue = useCallback(() => {
        send({ type: 'queue_leave', payload: {} })
        set_in_queue(false)
    }, [send])

    const handle_practice = useCallback(
        (name: string) => {
            practice_pending.current = true
            send({
                type: 'create_room',
                payload: { player_name: name },
            })
        },
        [send]
    )

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
                {room_id ? (
                    <Lobby
                        room_id={room_id}
                        players={players}
                        on_fill_bots={handle_fill_bots}
                        on_start_game={handle_start_game}
                        on_pick_seat={handle_pick_seat}
                        on_ready={handle_ready}
                        on_leave={handle_leave}
                        is_host={is_host}
                        my_seat={my_seat}
                        quick_match={is_quick_match}
                        my_team_won={is_quick_match && round_winner !== null ? round_winner === my_seat % 2 : null}
                    />
                ) : (
                    <Home
                        pending_room_id={pending_room_id}
                        session_room_id={saved_session?.room_id ?? null}
                        on_rejoin={try_reconnect}
                        on_discard_session={logout}
                        on_create_room={handle_create_room}
                        on_join_room={handle_join_room}
                        on_practice={handle_practice}
                        on_quick_match={handle_quick_match}
                        in_queue={in_queue}
                        queue_found={queue_found}
                        on_cancel_queue={handle_cancel_queue}
                    />
                )}
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
                tribute_events={tribute_events}
                on_leave={handle_leave}
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

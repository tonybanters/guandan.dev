import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Player_Info } from '../game/types'

interface Lobby_Props {
    room_id: string | null
    players: Player_Info[]
    on_create_room: (name: string) => void
    on_join_room: (room_id: string, name: string) => void
    on_fill_bots: () => void
    on_start_game: () => void
    on_pick_seat: (seat: number) => void
    on_ready: () => void
    pending_room_id: string | null
    is_host: boolean
    my_seat: number
}

export function Lobby({ room_id, players, on_create_room, on_join_room, on_fill_bots, on_start_game, on_pick_seat, on_ready, pending_room_id, is_host, my_seat }: Lobby_Props) {
    const [name, set_name] = useState('')
    const [join_code, set_join_code] = useState('')
    const [mode, set_mode] = useState<'select' | 'create' | 'join'>('select')
    const [copied, set_copied] = useState(false)

    useEffect(() => {
        if (pending_room_id) {
            set_mode('join')
            set_join_code(pending_room_id)
        }
    }, [pending_room_id])

    const handle_create = () => {
        if (name.trim()) {
            on_create_room(name.trim())
        }
    }

    const handle_join = () => {
        if (name.trim() && join_code.trim()) {
            on_join_room(join_code.trim(), name.trim())
        }
    }

    if (room_id) {
        const me = players.find(p => p.seat === my_seat)
        const all_ready = players.length > 0 && players.every(p => p.is_ready)
        const human_count = players.length

        return (
            <div style={styles.container}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={styles.card}
                >
                    <h2 style={styles.title}>Lobby</h2>
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            const link = `${window.location.origin}/room/${room_id}`
                            navigator.clipboard.writeText(link)
                            set_copied(true)
                            setTimeout(() => set_copied(false), 2000)
                        }}
                        style={styles.invite_link}
                    >
                        <span style={styles.invite_text}>{`${window.location.host}/room/${room_id}`}</span>
                        <span style={styles.copy_hint}>{copied ? 'Copied!' : 'Click to copy invite link'}</span>
                    </motion.div>

                    <div style={styles.players_grid}>
                        {[0, 1, 2, 3].map((seat) => {
                            const player = players.find((p) => p.seat === seat)
                            const team = seat % 2
                            const is_me = seat === my_seat && me
                            const team_color = team === 0
                                ? { bg: '#1a3a5c', border: '#2196f3' }
                                : { bg: '#4a1a2e', border: '#e91e63' }

                            return (
                                <motion.div
                                    key={seat}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: seat * 0.1 }}
                                    whileHover={!player ? { scale: 1.05 } : undefined}
                                    onClick={() => {
                                        if (!player) on_pick_seat(seat)
                                    }}
                                    style={{
                                        ...styles.player_slot,
                                        backgroundColor: team_color.bg,
                                        borderColor: player?.is_ready ? '#4caf50' : team_color.border,
                                        cursor: !player ? 'pointer' : 'default',
                                        boxShadow: is_me ? '0 0 0 2px #fff' : 'none',
                                    }}
                                >
                                    <div style={styles.team_label}>Team {team + 1}</div>
                                    {player ? (
                                        <>
                                            <div style={styles.player_name}>
                                                {player.name}
                                                {is_me && ' (you)'}
                                            </div>
                                            <div style={{
                                                ...styles.ready_status,
                                                color: player.is_ready ? '#4caf50' : '#ff9800'
                                            }}>
                                                {player.is_ready ? 'Ready' : 'Not Ready'}
                                            </div>
                                        </>
                                    ) : (
                                        <div style={styles.empty_slot}>
                                            Click to sit here
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>

                    <div style={styles.buttons}>
                        {me && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={on_ready}
                                style={{
                                    ...styles.button,
                                    backgroundColor: me.is_ready ? '#6c757d' : '#4caf50',
                                }}
                            >
                                {me.is_ready ? 'Unready' : 'Ready'}
                            </motion.button>
                        )}

                        {is_host && (
                            <>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={on_fill_bots}
                                    style={{ ...styles.button, backgroundColor: '#ff9800' }}
                                >
                                    Fill with Bots
                                </motion.button>
                                <motion.button
                                    whileHover={human_count + (4 - players.length) >= 4 && all_ready ? { scale: 1.05 } : undefined}
                                    whileTap={human_count + (4 - players.length) >= 4 && all_ready ? { scale: 0.95 } : undefined}
                                    onClick={on_start_game}
                                    style={{
                                        ...styles.button,
                                        backgroundColor: all_ready && players.length === 4 ? '#28a745' : '#555',
                                        cursor: all_ready && players.length === 4 ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    Start Game
                                </motion.button>
                            </>
                        )}
                    </div>

                    <p style={styles.hint}>Share the invite link with friends to join</p>
                </motion.div>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={styles.card}
            >
                <h1 style={styles.logo}>掼蛋</h1>
                <h2 style={styles.title}>Guan Dan</h2>

                {mode === 'select' && (
                    <div style={styles.buttons}>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => set_mode('create')}
                            style={styles.button}
                        >
                            Create Room
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => set_mode('join')}
                            style={{ ...styles.button, backgroundColor: '#28a745' }}
                        >
                            Join Room
                        </motion.button>
                    </div>
                )}

                {mode === 'create' && (
                    <div style={styles.form}>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => set_name(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handle_create()}
                            style={styles.input}
                            autoFocus
                        />
                        <div style={styles.buttons}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handle_create}
                                style={styles.button}
                            >
                                Create
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => set_mode('select')}
                                style={{ ...styles.button, backgroundColor: '#6c757d' }}
                            >
                                Back
                            </motion.button>
                        </div>
                    </div>
                )}

                {mode === 'join' && (
                    <div style={styles.form}>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => set_name(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handle_join()}
                            style={styles.input}
                            autoFocus
                        />
                        {!pending_room_id && (
                            <input
                                type="text"
                                placeholder="Room code"
                                value={join_code}
                                onChange={(e) => set_join_code(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handle_join()}
                                style={styles.input}
                            />
                        )}
                        <div style={styles.buttons}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handle_join}
                                style={{ ...styles.button, backgroundColor: '#28a745' }}
                            >
                                Join
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    set_mode('select')
                                    if (pending_room_id) {
                                        window.history.replaceState({}, '', '/')
                                    }
                                }}
                                style={{ ...styles.button, backgroundColor: '#6c757d' }}
                            >
                                Back
                            </motion.button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#1a1a2e',
    },
    card: {
        backgroundColor: '#16213e',
        padding: 40,
        borderRadius: 16,
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        minWidth: 360,
    },
    logo: {
        fontSize: 64,
        margin: 0,
        color: '#fff',
    },
    title: {
        color: '#fff',
        marginTop: 8,
        marginBottom: 24,
    },
    buttons: {
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        flexWrap: 'wrap' as const,
    },
    button: {
        padding: '12px 24px',
        fontSize: 16,
        border: 'none',
        borderRadius: 8,
        backgroundColor: '#007bff',
        color: '#fff',
        cursor: 'pointer',
    },
    form: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
    },
    input: {
        padding: '12px 16px',
        fontSize: 16,
        border: '2px solid #333',
        borderRadius: 8,
        backgroundColor: '#0f3460',
        color: '#fff',
        outline: 'none',
    },
    players_grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 24,
    },
    player_slot: {
        padding: 16,
        borderRadius: 8,
        border: '2px solid',
        minHeight: 80,
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
    },
    team_label: {
        fontSize: 11,
        color: '#888',
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
    },
    player_name: {
        fontWeight: 'bold',
        color: '#fff',
        fontSize: 16,
    },
    ready_status: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    empty_slot: {
        color: '#666',
        fontSize: 14,
    },
    hint: {
        color: '#666',
        fontSize: 12,
        marginTop: 16,
    },
    invite_link: {
        backgroundColor: '#0f3460',
        padding: '12px 16px',
        borderRadius: 8,
        marginBottom: 24,
        cursor: 'pointer',
        border: '1px solid #333',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 4,
    },
    invite_text: {
        color: '#7ec8e3',
        fontSize: 14,
        fontFamily: 'monospace',
    },
    copy_hint: {
        color: '#888',
        fontSize: 11,
    },
}

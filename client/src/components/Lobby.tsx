import { useState } from 'react'
import { motion } from 'framer-motion'
import { Player_Info } from '../game/types'

interface Lobby_Props {
    room_id: string | null
    players: Player_Info[]
    on_create_room: (name: string) => void
    on_join_room: (room_id: string, name: string) => void
    on_fill_bots: () => void
}

export function Lobby({ room_id, players, on_create_room, on_join_room, on_fill_bots }: Lobby_Props) {
    const [name, set_name] = useState('')
    const [join_code, set_join_code] = useState('')
    const [mode, set_mode] = useState<'select' | 'create' | 'join'>('select')

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
        return (
            <div style={styles.container}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={styles.card}
                >
                    <h2 style={styles.title}>Room: {room_id}</h2>
                    <p style={styles.subtitle}>Waiting for players... ({players.length}/4)</p>

                    <div style={styles.players_grid}>
                        {[0, 1, 2, 3].map((seat) => {
                            const player = players.find((p) => p.seat === seat)
                            const team = seat % 2
                            return (
                                <motion.div
                                    key={seat}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: seat * 0.1 }}
                                    style={{
                                        ...styles.player_slot,
                                        backgroundColor: team === 0 ? '#e3f2fd' : '#fce4ec',
                                        borderColor: team === 0 ? '#2196f3' : '#e91e63',
                                    }}
                                >
                                    {player ? (
                                        <>
                                            <div style={styles.player_name}>{player.name}</div>
                                            <div style={styles.player_team}>Team {team + 1}</div>
                                        </>
                                    ) : (
                                        <div style={styles.empty_slot}>Empty</div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={on_fill_bots}
                        style={{ ...styles.button, backgroundColor: '#ff9800', marginBottom: 16 }}
                    >
                        Fill with Bots
                    </motion.button>

                    <p style={styles.hint}>Share room code with friends to join</p>
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
                            style={styles.input}
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
                            style={styles.input}
                        />
                        <input
                            type="text"
                            placeholder="Room code"
                            value={join_code}
                            onChange={(e) => set_join_code(e.target.value)}
                            style={styles.input}
                        />
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
                                onClick={() => set_mode('select')}
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
    subtitle: {
        color: '#aaa',
        marginBottom: 24,
    },
    buttons: {
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
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
        flexDirection: 'column',
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
    },
    player_name: {
        fontWeight: 'bold',
        color: '#333',
    },
    player_team: {
        fontSize: 12,
        color: '#666',
    },
    empty_slot: {
        color: '#999',
    },
    hint: {
        color: '#666',
        fontSize: 12,
    },
}

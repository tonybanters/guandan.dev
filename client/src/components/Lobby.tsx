import { useState } from 'react'
import { motion } from 'framer-motion'
import { Player_Info } from '../game/types'
import { use_is_mobile } from '../hooks/use_is_mobile'

interface Lobby_Props {
    room_id: string
    players: Player_Info[]
    on_fill_bots: () => void
    on_start_game: () => void
    on_pick_seat: (seat: number) => void
    on_ready: () => void
    on_leave: () => void
    is_host: boolean
    my_seat: number
    quick_match: boolean
    my_team_won: boolean | null
}

export function Lobby({ room_id, players, on_fill_bots, on_start_game, on_pick_seat, on_ready, on_leave, is_host, my_seat, quick_match, my_team_won }: Lobby_Props) {
    const [copied, set_copied] = useState(false)
    const is_mobile = use_is_mobile()
    const styles = is_mobile ? { ...desktop_styles, ...mobile_styles } : desktop_styles

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
                <h2 style={styles.title}>{quick_match ? 'Quick Match' : 'Lobby'}</h2>

                {/* Round result - quick match between rounds */}
                {quick_match && my_team_won !== null && (
                    <div style={{
                        padding: '8px 12px',
                        marginBottom: 12,
                        borderRadius: 8,
                        fontWeight: 'bold',
                        backgroundColor: my_team_won ? 'rgba(40, 167, 69, 0.15)' : 'rgba(220, 53, 69, 0.15)',
                        border: `1px solid ${my_team_won ? '#28a745' : '#dc3545'}`,
                        color: my_team_won ? '#7bd88a' : '#e57373',
                    }}>
                        {my_team_won ? 'Your team won the round!' : 'Your team lost the round'}
                    </div>
                )}

                {!quick_match && (
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
                )}

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

                    {is_host && !quick_match && (
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

                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={on_leave}
                        style={{ ...styles.button, backgroundColor: '#dc3545' }}
                    >
                        Leave
                    </motion.button>
                </div>

                <p style={styles.hint}>
                    {quick_match
                        ? 'Next round starts when all 4 players ready up'
                        : 'Share the invite link with friends to join'}
                </p>
            </motion.div>
        </div>
    )
}

const desktop_styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100dvh',
        overflowY: 'auto',
        backgroundColor: '#1a1a2e',
    },
    card: {
        backgroundColor: '#16213e',
        padding: 40,
        borderRadius: 16,
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        minWidth: 360,
        maxWidth: '95vw',
        margin: 'auto',
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

const mobile_styles: Record<string, React.CSSProperties> = {
    card: {
        backgroundColor: '#16213e',
        padding: '14px 18px',
        borderRadius: 12,
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        maxWidth: '95vw',
        margin: 'auto',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        marginTop: 2,
        marginBottom: 10,
    },
    button: {
        padding: '8px 14px',
        fontSize: 14,
        border: 'none',
        borderRadius: 8,
        backgroundColor: '#007bff',
        color: '#fff',
        cursor: 'pointer',
    },
    players_grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
        marginBottom: 10,
    },
    player_slot: {
        padding: 8,
        borderRadius: 8,
        border: '2px solid',
        minHeight: 54,
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2,
    },
    team_label: {
        fontSize: 9,
        color: '#888',
        textTransform: 'uppercase' as const,
        letterSpacing: 1,
    },
    player_name: {
        fontWeight: 'bold',
        color: '#fff',
        fontSize: 13,
    },
    ready_status: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    empty_slot: {
        color: '#666',
        fontSize: 12,
    },
    invite_link: {
        backgroundColor: '#0f3460',
        padding: '6px 10px',
        borderRadius: 8,
        marginBottom: 10,
        cursor: 'pointer',
        border: '1px solid #333',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 2,
    },
    invite_text: {
        color: '#7ec8e3',
        fontSize: 12,
        fontFamily: 'monospace',
    },
    hint: {
        color: '#666',
        fontSize: 10,
        marginTop: 8,
    },
}

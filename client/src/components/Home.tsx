import { useState } from 'react'
import { motion } from 'framer-motion'
import { use_is_mobile } from '../hooks/use_is_mobile'
import { tokyo, tokyo_fg_a, tokyo_muted_a, tokyo_green_a } from '../theme'

const NAME_KEY = 'guandan_name'

function get_saved_name(): string {
    try {
        return localStorage.getItem(NAME_KEY) || ''
    } catch {
        return ''
    }
}

interface Home_Props {
    pending_room_id: string | null
    session_room_id: string | null
    on_rejoin: () => void
    on_discard_session: () => void
    on_create_room: (name: string) => void
    on_join_room: (room_id: string, name: string) => void
    on_practice: (name: string) => void
    on_quick_match: (name: string) => void
    on_tutorial: () => void
    in_queue: boolean
    queue_found: number
    on_cancel_queue: () => void
}

export function Home({ pending_room_id, session_room_id, on_rejoin, on_discard_session, on_create_room, on_join_room, on_practice, on_quick_match, on_tutorial, in_queue, queue_found, on_cancel_queue }: Home_Props) {
    const [name, set_name] = useState(get_saved_name)
    const [join_code, set_join_code] = useState('')
    const [view, set_view] = useState<'menu' | 'friends'>('menu')
    const is_mobile = use_is_mobile()
    const styles = is_mobile ? { ...desktop_styles, ...mobile_styles } : desktop_styles

    const has_name = name.trim().length > 0

    const handle_name_change = (value: string) => {
        set_name(value)
        try {
            localStorage.setItem(NAME_KEY, value.trim())
        } catch {
            // ignore
        }
    }

    const handle_join_pending = () => {
        if (has_name && pending_room_id) {
            on_join_room(pending_room_id, name.trim())
        }
    }

    const handle_join_code = () => {
        if (has_name && join_code.trim()) {
            on_join_room(join_code.trim(), name.trim())
        }
    }

    const disabled_style: React.CSSProperties = { opacity: 0.5, cursor: 'not-allowed' }

    if (in_queue) {
        return (
            <div style={styles.container}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={styles.card}
                >
                    <h1 style={styles.logo}>掼蛋</h1>
                    <h2 style={styles.title}>Quick Match</h2>
                    <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ repeat: Infinity, duration: 1.6 }}
                        style={{ color: tokyo.cyan, fontSize: 18, fontWeight: 'bold' }}
                    >
                        Searching for players… {queue_found}/4
                    </motion.div>
                    <p style={styles.hint}>The match starts as soon as 4 players are found</p>
                    <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={on_cancel_queue}
                        style={{ ...styles.menu_button, backgroundColor: tokyo_fg_a(0.12), color: tokyo.muted }}
                    >
                        Cancel
                    </motion.button>
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

                <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => handle_name_change(e.target.value)}
                    style={styles.input}
                    maxLength={20}
                />

                {/* Rejoin banner - a previous game session exists */}
                {session_room_id && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={styles.rejoin_banner}
                    >
                        <div style={styles.rejoin_text}>Game in progress in room {session_room_id}</div>
                        <div style={styles.rejoin_buttons}>
                            <button onClick={on_rejoin} style={{ ...styles.small_button, backgroundColor: tokyo.green }}>
                                Rejoin
                            </button>
                            <button onClick={on_discard_session} style={{ ...styles.small_button, backgroundColor: tokyo_fg_a(0.12), color: tokyo.muted }}>
                                Discard
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Invite link landed here - offer to join that room directly
                    (unless the rejoin banner already points at the same room) */}
                {pending_room_id && pending_room_id !== session_room_id && (
                    <motion.button
                        whileHover={has_name ? { scale: 1.03 } : undefined}
                        whileTap={has_name ? { scale: 0.97 } : undefined}
                        onClick={handle_join_pending}
                        style={{
                            ...styles.menu_button,
                            backgroundColor: tokyo.green,
                            ...(has_name ? {} : disabled_style),
                        }}
                    >
                        Join Room {pending_room_id}
                    </motion.button>
                )}

                {view === 'menu' && (
                    <>
                        <motion.button
                            whileHover={has_name ? { scale: 1.03 } : undefined}
                            whileTap={has_name ? { scale: 0.97 } : undefined}
                            onClick={() => { if (has_name) set_view('friends') }}
                            style={{ ...styles.menu_button, ...(has_name ? {} : disabled_style) }}
                        >
                            Play with Friends
                        </motion.button>
                        <motion.button
                            whileHover={has_name ? { scale: 1.03 } : undefined}
                            whileTap={has_name ? { scale: 0.97 } : undefined}
                            onClick={() => { if (has_name) on_practice(name.trim()) }}
                            style={{
                                ...styles.menu_button,
                                backgroundColor: tokyo.yellow,
                                ...(has_name ? {} : disabled_style),
                            }}
                        >
                            Practice vs Bots
                        </motion.button>
                        <motion.button
                            whileHover={has_name ? { scale: 1.03 } : undefined}
                            whileTap={has_name ? { scale: 0.97 } : undefined}
                            onClick={() => { if (has_name) on_quick_match(name.trim()) }}
                            style={{
                                ...styles.menu_button,
                                backgroundColor: tokyo.magenta,
                                ...(has_name ? {} : disabled_style),
                            }}
                        >
                            Quick Match
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={on_tutorial}
                            style={{ ...styles.menu_button, backgroundColor: tokyo.cyan }}
                        >
                            How to Play
                        </motion.button>
                        {!has_name && <p style={styles.hint}>Enter a name to play</p>}
                    </>
                )}

                {view === 'friends' && (
                    <>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => on_create_room(name.trim())}
                            style={styles.menu_button}
                        >
                            Create Room
                        </motion.button>
                        <div style={styles.join_row}>
                            <input
                                type="text"
                                placeholder="Room code"
                                value={join_code}
                                onChange={(e) => set_join_code(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handle_join_code()}
                                style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                            />
                            <motion.button
                                whileHover={join_code.trim() ? { scale: 1.05 } : undefined}
                                whileTap={join_code.trim() ? { scale: 0.95 } : undefined}
                                onClick={handle_join_code}
                                style={{
                                    ...styles.small_button,
                                    backgroundColor: tokyo.green,
                                    ...(join_code.trim() ? {} : disabled_style),
                                }}
                            >
                                Join
                            </motion.button>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => set_view('menu')}
                            style={{ ...styles.menu_button, backgroundColor: tokyo_fg_a(0.12), color: tokyo.muted }}
                        >
                            Back
                        </motion.button>
                    </>
                )}
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
        backgroundColor: tokyo.bg,
    },
    card: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 12,
        backgroundColor: tokyo.panel,
        border: `1px solid ${tokyo_fg_a(0.08)}`,
        padding: 40,
        borderRadius: 16,
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        width: 360,
        maxWidth: '95vw',
        margin: 'auto',
    },
    logo: {
        fontSize: 64,
        margin: 0,
        color: tokyo.fg,
    },
    title: {
        color: tokyo.fg,
        marginTop: 0,
        marginBottom: 12,
    },
    input: {
        padding: '12px 16px',
        fontSize: 16,
        border: `2px solid ${tokyo_fg_a(0.15)}`,
        borderRadius: 8,
        backgroundColor: tokyo.bg,
        color: tokyo.fg,
        outline: 'none',
        textAlign: 'center',
    },
    menu_button: {
        padding: '14px 24px',
        fontSize: 16,
        fontWeight: 'bold',
        border: 'none',
        borderRadius: 8,
        backgroundColor: tokyo.blue,
        color: tokyo.bg,
        cursor: 'pointer',
        width: '100%',
    },
    small_button: {
        padding: '8px 16px',
        fontSize: 14,
        border: 'none',
        borderRadius: 8,
        color: tokyo.bg,
        cursor: 'pointer',
    },
    join_row: {
        display: 'flex',
        gap: 8,
        alignItems: 'stretch',
    },
    rejoin_banner: {
        backgroundColor: tokyo_green_a(0.1),
        border: `1px solid ${tokyo_green_a(0.6)}`,
        borderRadius: 8,
        padding: 12,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 8,
    },
    rejoin_text: {
        color: tokyo.green,
        fontSize: 14,
    },
    rejoin_buttons: {
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
    },
    hint: {
        color: tokyo_muted_a(0.7),
        fontSize: 12,
        margin: 0,
    },
}

const mobile_styles: Record<string, React.CSSProperties> = {
    card: {
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 8,
        backgroundColor: tokyo.panel,
        border: `1px solid ${tokyo_fg_a(0.08)}`,
        padding: '14px 18px',
        borderRadius: 12,
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        width: 340,
        maxWidth: '95vw',
        margin: 'auto',
    },
    logo: {
        fontSize: 28,
        margin: 0,
        color: tokyo.fg,
    },
    title: {
        color: tokyo.fg,
        fontSize: 16,
        marginTop: 0,
        marginBottom: 4,
    },
    input: {
        padding: '8px 12px',
        fontSize: 16,
        border: `2px solid ${tokyo_fg_a(0.15)}`,
        borderRadius: 8,
        backgroundColor: tokyo.bg,
        color: tokyo.fg,
        outline: 'none',
        textAlign: 'center',
    },
    menu_button: {
        padding: '10px 20px',
        fontSize: 14,
        fontWeight: 'bold',
        border: 'none',
        borderRadius: 8,
        backgroundColor: tokyo.blue,
        color: tokyo.bg,
        cursor: 'pointer',
        width: '100%',
    },
    rejoin_banner: {
        backgroundColor: tokyo_green_a(0.1),
        border: `1px solid ${tokyo_green_a(0.6)}`,
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 6,
    },
    rejoin_text: {
        color: tokyo.green,
        fontSize: 12,
    },
}

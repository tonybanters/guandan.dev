import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Game } from './Game'
import {
    Card as Card_Type, Rank, Suit, Rank_Two, Tribute_Event,
    Suit_Spades, Suit_Hearts, Suit_Clubs, Suit_Diamonds,
} from '../game/types'
import { use_is_mobile } from '../hooks/use_is_mobile'
import { tokyo, tokyo_fg_a, tokyo_muted_a, tokyo_yellow_a } from '../theme'

interface Tutorial_Props {
    on_exit: () => void
}

const ME = 0
const WEST = 1
const PARTNER = 2
const EAST = 3

const card = (id: number, rank: Rank, suit: Suit): Card_Type => ({ Id: id, Rank: rank, Suit: suit })

const STARTING_HAND: Card_Type[] = [
    card(101, 8, Suit_Clubs),
    card(102, 7, Suit_Spades),
    card(103, 7, Suit_Diamonds),
    card(104, 7, Suit_Clubs),
    card(105, 1, Suit_Diamonds),
    card(106, 2, Suit_Spades),
    card(107, 3, Suit_Hearts),
    card(108, 4, Suit_Clubs),
    card(109, 5, Suit_Diamonds),
    card(110, 6, Suit_Spades),
    card(111, 6, Suit_Hearts),
    card(112, 6, Suit_Diamonds),
    card(113, 6, Suit_Clubs),
    card(114, 0, Suit_Hearts),
]

const WEST_QUEEN = [card(201, 10, Suit_Clubs)]
const PARTNER_ACE = [card(202, 12, Suit_Spades)]
const PARTNER_FOURS = [card(203, 2, Suit_Hearts), card(204, 2, Suit_Clubs), card(205, 2, Suit_Diamonds)]
const EAST_TENS = [card(206, 8, Suit_Spades), card(207, 8, Suit_Hearts), card(208, 8, Suit_Diamonds)]
const EAST_FULL_HOUSE = [
    card(211, 11, Suit_Spades), card(212, 11, Suit_Hearts), card(213, 11, Suit_Clubs),
    card(214, 4, Suit_Spades), card(215, 4, Suit_Diamonds),
]
const TRIBUTE_PAY = card(220, 11, Suit_Diamonds)
const TRIBUTE_RETURN = card(221, 3, Suit_Diamonds)

type Expect =
    | { kind: 'play'; ids: number[]; hint: string }
    | { kind: 'pass' }
    | null

interface Step {
    text: string
    expect: Expect
    turn: number
    can_pass: boolean
    dialog_low?: boolean
    anchors?: string[][]
    highlight_cards?: number[]
}

const STEPS: Step[] = [
    {
        text: 'Welcome to Guan Dan! You and your partner (top) play as a team against West and East. Be the first team to empty your hands.',
        expect: null, turn: -1, can_pass: false,
    },
    {
        text: 'The badge in the top left shows the level, this hand\'s trump rank. Level cards beat aces. Your gold 2 of HEARTS is wild: it can stand in for almost any card.',
        expect: null, turn: -1, can_pass: false,
        anchors: [['[data-tut="level"]']], highlight_cards: [114],
    },
    {
        text: 'The table is empty and it\'s your turn, so you may lead anything. Tap your 10 of clubs to select it, then hit Play.',
        expect: { kind: 'play', ids: [101], hint: 'select just the 10 of clubs' }, turn: ME, can_pass: false,
        highlight_cards: [101],
    },
    {
        text: 'West beat your 10 with a queen. To play on someone you must beat their play with the SAME combo type, or pass.',
        expect: null, turn: ME, can_pass: false,
    },
    {
        text: 'Beating the queen would waste your good cards. Sometimes passing is right. Hit Pass.',
        expect: { kind: 'pass' }, turn: ME, can_pass: true,
        anchors: [['[data-tut="pass"]']],
    },
    {
        text: 'Your partner took the trick with an ace and East passed. When everyone passes, the trick ends and its winner leads the next one.',
        expect: null, turn: PARTNER, can_pass: false,
    },
    {
        text: 'Partner leads three 4s, a triple. Triples can only be beaten by higher triples (or bombs). East plays three 10s...',
        expect: null, turn: EAST, can_pass: false,
    },
    {
        text: 'You cannot beat three 10s with your three 9s. No problem, just pass for now and save them.',
        expect: { kind: 'pass' }, turn: ME, can_pass: true,
        anchors: [['[data-tut="pass"]']],
    },
    {
        text: 'East won the trick and leads a full house: a triple plus a pair. You have no full house to answer with...',
        expect: null, turn: ME, can_pass: false,
    },
    {
        text: '...but you have FOUR 8s, a bomb! Bombs beat any non-bomb play, no matter the combo type. Double-tap one of your 8s to grab all four, then Play.',
        expect: { kind: 'play', ids: [110, 111, 112, 113], hint: 'double-tap an 8 to select all four' }, turn: ME, can_pass: false,
        highlight_cards: [110, 111, 112, 113],
    },
    {
        text: 'Boom. Nobody can answer a bomb that big, so you lead again. Now play a straight: select 3-4-5-6-7 (tap each card or swipe across them) and Play. The full combo list lives under the ? Combos button, bottom left.',
        expect: { kind: 'play', ids: [105, 106, 107, 108, 109], hint: 'select the 3, 4, 5, 6 and 7' }, turn: ME, can_pass: false,
        anchors: [['[data-tut="cheat"]']], highlight_cards: [105, 106, 107, 108, 109],
    },
    {
        text: 'Everyone passes again. Time to go out in style: your wild 2 of HEARTS can stand in for a fourth 9. Select your three 9s and the wild 2 to play them as a BOMB.',
        expect: { kind: 'play', ids: [102, 103, 104, 114], hint: 'double-tap a 9 to grab all three, then tap the gold 2 of hearts' }, turn: ME, can_pass: false,
        highlight_cards: [102, 103, 104, 114],
    },
    {
        text: 'You finished 1st! Your team climbs levels based on where your partner lands: 1st + 2nd is 3 levels, 1st + 3rd is 2, 1st + 4th is 1. First team to win at level A takes the game.',
        expect: null, turn: WEST, can_pass: false,
    },
    {
        text: 'One more thing: TRIBUTE. Next hand, last place pays their best card to the winner, who returns any card of 10 or lower. It shows on the table like this.',
        expect: null, turn: WEST, can_pass: false, dialog_low: true,
    },
    {
        text: 'That\'s the core of Guan Dan. Check ? Combos for tubes, plates, straight flushes and the joker bomb. Good luck!',
        expect: null, turn: -1, can_pass: false,
        anchors: [['[data-tut="cheat"]']],
    },
]

interface Ring {
    left: number
    top: number
    width: number
    height: number
}

/*
 * draws pulsing highlight rings over the dom elements a tutorial step talks
 * about. each anchor group is a list of selectors whose bounding boxes are
 * unioned into one ring. positions are re-measured on an interval because
 * cards animate and the layout shifts as plays land.
 */
function Spotlights({ anchors }: { anchors: string[][] }) {
    const [rings, set_rings] = useState<Ring[]>([])
    const last = useRef('')

    useEffect(() => {
        const measure = () => {
            const out: Ring[] = []
            for (const group of anchors) {
                let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
                for (const sel of group) {
                    const el = document.querySelector(sel)
                    if (!el) continue
                    const b = el.getBoundingClientRect()
                    left = Math.min(left, b.left)
                    top = Math.min(top, b.top)
                    right = Math.max(right, b.right)
                    bottom = Math.max(bottom, b.bottom)
                }
                if (left !== Infinity) {
                    out.push({ left, top, width: right - left, height: bottom - top })
                }
            }
            const key = JSON.stringify(out)
            if (key !== last.current) {
                last.current = key
                set_rings(out)
            }
        }
        measure()
        const iv = window.setInterval(measure, 250)
        window.addEventListener('resize', measure)
        return () => {
            window.clearInterval(iv)
            window.removeEventListener('resize', measure)
        }
    }, [anchors])

    return (
        <>
            {rings.map((r, i) => (
                <motion.div
                    key={i}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1.4 }}
                    style={{
                        position: 'fixed',
                        left: r.left - 5,
                        top: r.top - 5,
                        width: r.width + 10,
                        height: r.height + 10,
                        border: `2px solid ${tokyo.yellow}`,
                        borderRadius: 10,
                        boxShadow: `0 0 14px ${tokyo_yellow_a(0.6)}`,
                        pointerEvents: 'none',
                        zIndex: 240,
                    }}
                />
            ))}
        </>
    )
}

/*
 * drives a fully scripted mock round through the real game ui. all state
 * lives here; opponent plays are staged with timeouts when a step is
 * entered, and action steps only advance when the expected cards are played.
 */
export function Tutorial({ on_exit }: Tutorial_Props) {
    const is_mobile = use_is_mobile()
    const [step, set_step] = useState(0)
    const [hand, set_hand] = useState<Card_Type[]>(STARTING_HAND)
    const [selected_ids, set_selected_ids] = useState<Set<number>>(new Set())
    const [player_plays, set_player_plays] = useState<Record<number, { cards: Card_Type[], is_pass: boolean }>>({})
    const [leading_seat, set_leading_seat] = useState<number | null>(null)
    const [counts, set_counts] = useState([14, 14, 14, 14])
    const [tribute_events, set_tribute_events] = useState<Tribute_Event[]>([])
    const [hint, set_hint] = useState<string | null>(null)

    const timers = useRef<number[]>([])
    const entered_step = useRef(-1)

    // on action steps the dialogue docks above the pass/play buttons so it
    // never covers them on short screens
    const [dialog_bottom, set_dialog_bottom] = useState<number | null>(null)
    const current_expect = STEPS[step].expect !== null
    useEffect(() => {
        if (!current_expect) {
            set_dialog_bottom(null)
            return
        }
        const measure = () => {
            const el = document.querySelector('[data-tut="play"]')
            if (!el) {
                set_dialog_bottom(null)
                return
            }
            const r = el.getBoundingClientRect()
            set_dialog_bottom(prev => {
                const next = Math.round(window.innerHeight - r.top + 10)
                return prev === next ? prev : next
            })
        }
        measure()
        const iv = window.setInterval(measure, 400)
        window.addEventListener('resize', measure)
        return () => {
            window.clearInterval(iv)
            window.removeEventListener('resize', measure)
        }
    }, [step, current_expect])

    const schedule = (fn: () => void, delay: number) => {
        timers.current.push(window.setTimeout(fn, delay))
    }

    const seat_plays = (seat: number, cards: Card_Type[], delay: number) => {
        schedule(() => {
            set_player_plays(prev => ({ ...prev, [seat]: { cards, is_pass: false } }))
            set_leading_seat(seat)
            set_counts(prev => prev.map((c, i) => (i === seat ? c - cards.length : c)))
        }, delay)
    }

    const seat_passes = (seat: number, delay: number) => {
        schedule(() => {
            set_player_plays(prev => ({ ...prev, [seat]: { cards: [], is_pass: true } }))
        }, delay)
    }

    const new_trick = (delay: number) => {
        schedule(() => {
            set_player_plays({})
            set_leading_seat(null)
        }, delay)
    }

    useEffect(() => {
        if (entered_step.current === step) return
        entered_step.current = step

        switch (step) {
            case 3:
                seat_plays(WEST, WEST_QUEEN, 700)
                break
            case 5:
                seat_plays(PARTNER, PARTNER_ACE, 600)
                seat_passes(EAST, 1400)
                break
            case 6:
                new_trick(0)
                seat_plays(PARTNER, PARTNER_FOURS, 700)
                seat_plays(EAST, EAST_TENS, 1700)
                break
            case 8:
                seat_passes(WEST, 600)
                seat_passes(PARTNER, 1200)
                new_trick(2200)
                seat_plays(EAST, EAST_FULL_HOUSE, 2900)
                break
            case 10:
                seat_passes(EAST, 500)
                seat_passes(WEST, 1100)
                seat_passes(PARTNER, 1700)
                new_trick(2600)
                break
            case 11:
                seat_passes(WEST, 500)
                seat_passes(PARTNER, 1100)
                seat_passes(EAST, 1700)
                new_trick(2600)
                break
            case 13:
                schedule(() => {
                    set_tribute_events([
                        { id: 1, kind: 'pay', from_seat: EAST, to_seat: ME, card: TRIBUTE_PAY },
                    ])
                }, 500)
                schedule(() => {
                    set_tribute_events(prev => [
                        ...prev,
                        { id: 2, kind: 'return', from_seat: ME, to_seat: EAST, card: TRIBUTE_RETURN },
                    ])
                }, 1700)
                break
            case 14:
                set_tribute_events([])
                set_player_plays({})
                break
        }

        return () => {
            timers.current.forEach(window.clearTimeout)
            timers.current = []
        }
    }, [step])

    const current = STEPS[step]

    const advance = () => {
        set_hint(null)
        if (step < STEPS.length - 1) {
            set_step(step + 1)
        } else {
            on_exit()
        }
    }

    const handle_card_click = (id: number) => {
        set_selected_ids(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handle_select_same_rank = (rank: number) => {
        const same = hand.filter(c => c.Rank === rank)
        set_selected_ids(prev => {
            const next = new Set(prev)
            const all_selected = same.every(c => prev.has(c.Id))
            same.forEach(c => (all_selected ? next.delete(c.Id) : next.add(c.Id)))
            return next
        })
    }

    const handle_play = () => {
        if (!current.expect || current.expect.kind !== 'play') return
        const want = new Set(current.expect.ids)
        const got = selected_ids
        const matches = want.size === got.size && [...want].every(id => got.has(id))
        if (!matches) {
            set_hint(current.expect.hint)
            return
        }
        const played = hand.filter(c => want.has(c.Id))
        set_hand(prev => prev.filter(c => !want.has(c.Id)))
        set_selected_ids(new Set())
        set_player_plays(prev => ({ ...prev, [ME]: { cards: played, is_pass: false } }))
        set_leading_seat(ME)
        advance()
    }

    const handle_pass = () => {
        if (!current.expect || current.expect.kind !== 'pass') return
        set_player_plays(prev => ({ ...prev, [ME]: { cards: [], is_pass: true } }))
        advance()
    }

    return (
        <div style={{ position: 'relative', height: '100dvh' }}>
            <Game
                hand={hand}
                level={Rank_Two}
                selected_ids={selected_ids}
                on_card_click={handle_card_click}
                on_select_same_rank={handle_select_same_rank}
                on_clear_selection={() => set_selected_ids(new Set())}
                on_play={handle_play}
                on_pass={handle_pass}
                table_cards={[]}
                combo_type=""
                current_turn={current.turn}
                my_seat={ME}
                can_pass={current.can_pass}
                player_card_counts={counts}
                team_levels={[0, 0]}
                players_map={{ [ME]: 'You', [WEST]: 'West', [PARTNER]: 'Partner', [EAST]: 'East' }}
                last_play_seat={null}
                player_plays={player_plays}
                leading_seat={leading_seat}
                is_tribute_mode={false}
                tribute_events={tribute_events}
                on_leave={on_exit}
                highlight_ids={current.highlight_cards ? new Set(current.highlight_cards) : undefined}
            />

            {current.anchors && <Spotlights key={step} anchors={current.anchors} />}

            {/* dialogue box */}
            <div style={{
                position: 'fixed',
                ...(dialog_bottom !== null
                    ? { bottom: dialog_bottom }
                    : { top: current.dialog_low ? '58%' : is_mobile ? '30%' : '32%' }),
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                zIndex: 250,
                pointerEvents: 'none',
            }}>
            <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                    width: is_mobile ? 'min(440px, 92vw)' : 460,
                    backgroundColor: tokyo.panel,
                    border: `1px solid ${tokyo_yellow_a(0.5)}`,
                    borderRadius: 12,
                    padding: is_mobile ? '10px 14px' : '14px 18px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    pointerEvents: 'auto',
                }}
            >
                <div style={{
                    color: tokyo.fg,
                    fontSize: is_mobile ? 12 : 14,
                    lineHeight: 1.45,
                }}>
                    {current.text}
                </div>

                {hint && (
                    <div style={{
                        color: tokyo.yellow,
                        fontSize: is_mobile ? 11 : 12,
                        fontWeight: 'bold',
                        marginTop: 6,
                    }}>
                        Hint: {hint}
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: is_mobile ? 8 : 12,
                }}>
                    <button
                        onClick={on_exit}
                        style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            backgroundColor: 'transparent',
                            color: tokyo.muted,
                            border: `1px solid ${tokyo_fg_a(0.2)}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                        }}
                    >
                        Skip tutorial
                    </button>
                    <span style={{ color: tokyo_muted_a(0.7), fontSize: 11 }}>
                        {step + 1}/{STEPS.length}
                    </span>
                    {current.expect === null ? (
                        <button
                            onClick={advance}
                            style={{
                                padding: '6px 18px',
                                fontSize: 13,
                                fontWeight: 'bold',
                                backgroundColor: tokyo.green,
                                color: tokyo.bg,
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                            }}
                        >
                            {step === STEPS.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    ) : (
                        <span style={{
                            color: tokyo.yellow,
                            fontSize: 11,
                            fontWeight: 'bold',
                        }}>
                            {current.expect.kind === 'pass' ? 'hit Pass to continue' : 'your move'}
                        </span>
                    )}
                </div>
            </motion.div>
            </div>
        </div>
    )
}

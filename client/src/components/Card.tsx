import {
    Card as Card_Type, get_suit_symbol, get_rank_symbol, is_red_suit, is_wild, Rank, Rank_Red_Joker, Suit_Joker
} from '../game/types'

type Card_Size = 'small' | 'normal'
type Card_Context = 'hand' | 'table'

interface Card_Props {
    card: Card_Type
    level: Rank
    selected: boolean
    on_click: () => void
    size?: Card_Size
    context?: Card_Context
}

export const CARD_CONFIG = {
    hand: {
        small: {
            width: 65, height: 67,
            rank_font: 18, suit_font: 16,
            center_font: 40, center_top: '65%', center_left: '65%',
            h_visible: 45, v_overlap: 20,
        },
        normal: {
            width: 60, height: 84,
            rank_font: 22, suit_font: 20,
            center_font: 32, center_top: '65%', center_left: '65%',
            h_visible: 25, v_overlap: 28,
        },
    },
    table: {
        small: {
            width: 45, height: 55,
            rank_font: 15, suit_font: 13,
            center_font: 20, center_top: '60%', center_left: '70%',
            h_visible: 20, v_overlap: 0,
        },
        normal: {
            width: 55, height: 67,
            rank_font: 15, suit_font: 13,
            center_font: 24, center_top: '55%', center_left: '50%',
            h_visible: 27, v_overlap: 0,
        },
    },
}

export function Card({ card, level, selected, on_click, size = 'normal', context = 'hand' }: Card_Props) {
    const is_joker = card.Suit === Suit_Joker
    const is_red = is_joker ? card.Rank === Rank_Red_Joker : is_red_suit(card.Suit)
    const is_wild_card = is_wild(card, level)
    const cfg = CARD_CONFIG[context][size]

    const rank_display = is_joker
        ? '王'
        : get_rank_symbol(card.Rank)

    const suit_display = is_joker ? '' : get_suit_symbol(card.Suit)

    return (
        <div
            onClick={on_click}
            style={{
                width: cfg.width,
                height: cfg.height,
                backgroundColor: is_wild_card ? '#fff3cd' : '#fff',
                border: is_wild_card ? '2px solid #ffc107' : '1px solid #ccc',
                borderRadius: 6,
                position: 'relative',
                cursor: 'pointer',
                userSelect: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                overflow: 'hidden',
            }}
        >
            {/* Selection overlay */}
            {selected && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(156, 39, 176, 0.35)',
                        borderRadius: 5,
                        pointerEvents: 'none',
                        zIndex: 10,
                    }}
                />
            )}

            {/* Rank and suit label */}
            <div
                style={{
                    position: 'absolute',
                    top: 3,
                    left: 3,
                    display: 'flex',
                    flexDirection: context === 'hand' ? 'row' : 'column',
                    alignItems: 'center',
                    gap: context === 'hand' ? 1 : 0,
                }}
            >
                <span
                    style={{
                        fontSize: cfg.rank_font,
                        fontWeight: 'bold',
                        color: is_red ? '#dc3545' : '#000',
                        lineHeight: 1,
                    }}
                >
                    {rank_display}
                </span>
                {suit_display && (
                    <span
                        style={{
                            fontSize: cfg.suit_font,
                            color: is_red ? '#dc3545' : '#000',
                            lineHeight: 1,
                        }}
                    >
                        {suit_display}
                    </span>
                )}
            </div>

            {/* Big suit in center */}
            <div
                style={{
                    position: 'absolute',
                    top: cfg.center_top,
                    left: cfg.center_left,
                    transform: 'translate(-50%, -50%)',
                    fontSize: cfg.center_font,
                    color: is_red ? '#dc3545' : '#000',
                    opacity: 0.9,
                }}
            >
                {suit_display}
            </div>
        </div>
    )
}

interface Card_Back_Props {
    size?: Card_Size
    context?: Card_Context
}

export function Card_Back({ size = 'normal', context = 'hand' }: Card_Back_Props) {
    const cfg = CARD_CONFIG[context][size]

    return (
        <div
            style={{
                width: cfg.width,
                height: cfg.height,
                backgroundColor: '#1e3a5f',
                border: '1px solid #0d1b2a',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)',
            }}
        >
            <div style={{ color: '#fff', fontSize: cfg.center_font * 0.5 }}>🀄</div>
        </div>
    )
}

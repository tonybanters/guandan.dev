import {
    Card as Card_Type, get_suit_symbol, get_rank_symbol, is_red_suit, is_wild, Rank, Rank_Red_Joker, Suit_Joker
} from '../game/types'

type Card_Size = 'small' | 'normal'
type Label_Position = 'top' | 'left'

interface Card_Props {
    card: Card_Type
    level: Rank
    selected: boolean
    on_click: () => void
    size?: Card_Size
    label_position?: Label_Position
}

const SIZE_CONFIG = {
    small: { width: 48, height: 67, rank_font: 15, suit_font: 13 },
    normal: { width: 60, height: 84, rank_font: 22, suit_font: 20 },
}

export function Card({ card, level, selected, on_click, size = 'normal', label_position = 'top' }: Card_Props) {
    const is_joker = card.Suit === Suit_Joker
    const is_red = is_joker ? card.Rank === Rank_Red_Joker : is_red_suit(card.Suit)
    const is_wild_card = is_wild(card, level)
    const cfg = SIZE_CONFIG[size]

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

            {/* Rank and suit label - position depends on context */}
            {label_position === 'top' ? (
                // Top center - for cards in hand (vertical stacking)
                <div
                    style={{
                        position: 'absolute',
                        top: 4,
                        left: 0,
                        right: 0,
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
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
            ) : (
                // Left side - for cards on table (horizontal overlap)
                <div
                    style={{
                        position: 'absolute',
                        top: 3,
                        left: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
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
            )}

            {/* Big suit in center */}
            <div
                style={{
                    position: 'absolute',
                    top: '55%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: size === 'small' ? 18 : 32,
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
}

export function Card_Back({ size = 'normal' }: Card_Back_Props) {
    const cfg = SIZE_CONFIG[size]

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
            <div style={{ color: '#fff', fontSize: size === 'small' ? 14 : 22 }}>🀄</div>
        </div>
    )
}

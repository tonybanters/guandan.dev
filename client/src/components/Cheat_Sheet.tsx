import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card } from './Card'
import {
    Card as Card_Type, Rank, Suit, Rank_Two,
    Suit_Spades, Suit_Hearts, Suit_Clubs, Suit_Diamonds, Suit_Joker,
    Rank_Black_Joker, Rank_Red_Joker,
} from '../game/types'
import { use_is_mobile } from '../hooks/use_is_mobile'

interface Combo_Row {
    name: string
    note: string
    cards: Card_Type[]
}

const c = (id: number, rank: Rank, suit: Suit): Card_Type => ({ Id: id, Rank: rank, Suit: suit })

const COMBO_ROWS: Combo_Row[] = [
    { name: 'Single', note: 'one card', cards: [c(1, 5, Suit_Spades)] },
    { name: 'Pair', note: 'two of the same rank', cards: [c(2, 7, Suit_Spades), c(3, 7, Suit_Hearts)] },
    { name: 'Triple', note: 'three of the same rank', cards: [c(4, 10, Suit_Spades), c(5, 10, Suit_Hearts), c(6, 10, Suit_Diamonds)] },
    {
        name: 'Full House', note: 'triple plus a pair',
        cards: [c(7, 11, Suit_Spades), c(8, 11, Suit_Hearts), c(9, 11, Suit_Clubs), c(10, 2, Suit_Spades), c(11, 2, Suit_Diamonds)],
    },
    {
        name: 'Straight', note: 'five consecutive ranks, ace high or low',
        cards: [c(12, 1, Suit_Diamonds), c(13, 2, Suit_Spades), c(14, 3, Suit_Hearts), c(15, 4, Suit_Clubs), c(16, 5, Suit_Diamonds)],
    },
    {
        name: 'Tube', note: 'three consecutive pairs',
        cards: [c(17, 2, Suit_Spades), c(18, 2, Suit_Hearts), c(19, 3, Suit_Clubs), c(20, 3, Suit_Diamonds), c(21, 4, Suit_Spades), c(22, 4, Suit_Hearts)],
    },
    {
        name: 'Plate', note: 'two consecutive triples',
        cards: [c(23, 6, Suit_Spades), c(24, 6, Suit_Hearts), c(25, 6, Suit_Diamonds), c(26, 7, Suit_Clubs), c(27, 7, Suit_Spades), c(28, 7, Suit_Hearts)],
    },
    {
        name: 'Bomb', note: 'four or more of a kind, beats any non-bomb; more cards = stronger',
        cards: [c(29, 4, Suit_Spades), c(30, 4, Suit_Hearts), c(31, 4, Suit_Diamonds), c(32, 4, Suit_Clubs)],
    },
    {
        name: 'Straight Flush', note: 'five consecutive in one suit; beats 4-5 card bombs, loses to 6+ card bombs',
        cards: [c(33, 2, Suit_Hearts), c(34, 3, Suit_Hearts), c(35, 4, Suit_Hearts), c(36, 5, Suit_Hearts), c(37, 6, Suit_Hearts)],
    },
    {
        name: 'Joker Bomb', note: 'all four jokers, beats everything',
        cards: [c(38, Rank_Black_Joker, Suit_Joker), c(39, Rank_Black_Joker, Suit_Joker), c(40, Rank_Red_Joker, Suit_Joker), c(41, Rank_Red_Joker, Suit_Joker)],
    },
    {
        name: 'Wild Card', note: 'the HEARTS card of the current level substitutes for any card except jokers',
        cards: [c(42, Rank_Two, Suit_Hearts)],
    },
]

export function Cheat_Sheet() {
    const [open, set_open] = useState(false)
    const is_mobile = use_is_mobile()

    return (
        <>
            <button
                onClick={() => set_open(true)}
                style={{
                    position: 'absolute',
                    left: is_mobile ? 2 : 6,
                    bottom: is_mobile ? 4 : 8,
                    padding: is_mobile ? '4px 8px' : '7px 12px',
                    fontSize: is_mobile ? 11 : 13,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    color: '#7ec8e3',
                    border: '1px solid rgba(126, 200, 227, 0.4)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    zIndex: 60,
                }}
            >
                ? Combos
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => set_open(false)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.65)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 300,
                        }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.15 }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: '#16213e',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 12,
                                padding: is_mobile ? 12 : 20,
                                width: is_mobile ? '95vw' : 560,
                                maxHeight: '85dvh',
                                overflowY: 'auto',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: is_mobile ? 8 : 12,
                            }}>
                                <div style={{ color: '#fff', fontWeight: 'bold', fontSize: is_mobile ? 16 : 18 }}>
                                    Combos
                                </div>
                                <button
                                    onClick={() => set_open(false)}
                                    style={{
                                        padding: '4px 12px',
                                        fontSize: 13,
                                        backgroundColor: '#6c757d',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                    }}
                                >
                                    Close
                                </button>
                            </div>

                            {COMBO_ROWS.map((row) => (
                                <div
                                    key={row.name}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: is_mobile ? 8 : 12,
                                        padding: is_mobile ? '5px 0' : '7px 0',
                                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    }}
                                >
                                    <div style={{ width: is_mobile ? 78 : 100, flexShrink: 0 }}>
                                        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: is_mobile ? 12 : 13 }}>
                                            {row.name}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexShrink: 0 }}>
                                        {row.cards.map((card, idx) => (
                                            <div key={card.Id} style={{ marginLeft: idx > 0 ? (is_mobile ? -26 : -30) : 0 }}>
                                                <Card
                                                    card={card}
                                                    level={Rank_Two}
                                                    selected={false}
                                                    on_click={() => {}}
                                                    size="tiny"
                                                    context="table"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ color: '#999', fontSize: is_mobile ? 10 : 12, lineHeight: 1.3 }}>
                                        {row.note}
                                    </div>
                                </div>
                            ))}

                            <div style={{ color: '#7ec8e3', fontSize: is_mobile ? 10 : 12, marginTop: is_mobile ? 8 : 12 }}>
                                Rank order: 2 &lt; 3 &lt; … &lt; A &lt; level card &lt; black joker &lt; red joker.
                                Bombs beat any non-bomb. In straights, tubes and plates the ace can play low (A-2-3-4-5).
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

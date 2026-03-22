import { useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card as Card_Type, Rank, Suit_Hearts, Suit_Diamonds, Suit_Clubs, Suit_Spades } from '../game/types'
import { Card } from './Card'
import { use_is_mobile } from '../hooks/use_is_mobile'

interface Hand_Props {
  cards: Card_Type[]
  level: Rank
  selected_ids: Set<number>
  on_card_click: (id: number) => void
  on_toggle_selection: (id: number) => void
  on_select_same_rank: (rank: number) => void
  on_play: () => void
  on_pass: () => void
  is_my_turn: boolean
  can_pass: boolean
}

interface Column {
  id: string
  card_ids: number[]
  is_custom: boolean
}

export function Hand({ cards, level, selected_ids, on_card_click, on_toggle_selection, on_select_same_rank, on_play, on_pass, is_my_turn, can_pass }: Hand_Props) {
  const is_mobile = use_is_mobile()
  const last_click = useRef<{ id: number; time: number } | null>(null)
  const [custom_columns, set_custom_columns] = useState<Map<string, number[]>>(new Map())

  // Swipe-to-select state
  const [is_swiping, set_is_swiping] = useState(false)
  const swipe_start = useRef<{ x: number; y: number } | null>(null)
  const swiped_cards = useRef<Set<number>>(new Set())
  const card_refs = useRef<Map<number, HTMLDivElement>>(new Map())

  const handle_card_click = useCallback((card: Card_Type) => {
    // Don't trigger click if we were swiping
    if (swiped_cards.current.size > 0) {
      swiped_cards.current.clear()
      return
    }

    const now = Date.now()
    const last = last_click.current

    if (last && last.id === card.Id && now - last.time < 300) {
      on_select_same_rank(card.Rank)
      last_click.current = null
    } else {
      on_card_click(card.Id)
      last_click.current = { id: card.Id, time: now }
    }
  }, [on_card_click, on_select_same_rank])

  // Get all card IDs in custom columns
  const cards_in_custom = new Set<number>()
  custom_columns.forEach(ids => ids.forEach(id => cards_in_custom.add(id)))

  // Filter to only cards that still exist in hand
  const valid_card_ids = new Set(cards.map(c => c.Id))

  // Build columns: auto-sorted cards first, then custom columns on right
  const columns: Column[] = []
  const custom_cols: Column[] = []

  // Collect custom columns (filter out cards no longer in hand)
  custom_columns.forEach((card_ids, col_id) => {
    const valid_ids = card_ids.filter(id => valid_card_ids.has(id))
    if (valid_ids.length > 0) {
      custom_cols.push({ id: col_id, card_ids: valid_ids, is_custom: true })
    }
  })

  // Auto-group remaining cards by rank
  const remaining_cards = cards.filter(c => !cards_in_custom.has(c.Id))
  const by_rank = new Map<number, Card_Type[]>()
  remaining_cards.forEach(card => {
    const arr = by_rank.get(card.Rank) || []
    arr.push(card)
    by_rank.set(card.Rank, arr)
  })

  // Sort ranks high to low
  const rank_order = (rank: number): number => {
    if (rank === 14) return 1000
    if (rank === 13) return 999
    if (rank === level) return 998
    if (rank === 0) return 15
    if (rank === 12) return 14
    return rank + 2
  }

  const sorted_ranks = Array.from(by_rank.keys()).sort((a, b) => rank_order(b) - rank_order(a))
  sorted_ranks.forEach(rank => {
    const rank_cards = by_rank.get(rank)!
    columns.push({
      id: `rank-${rank}`,
      card_ids: rank_cards.map(c => c.Id),
      is_custom: false
    })
  })

  // Add custom columns at the end (right side)
  columns.push(...custom_cols)

  // Card lookup
  const card_by_id = new Map(cards.map(c => [c.Id, c]))

  const card_width = is_mobile ? 36 : 56
  const card_height = is_mobile ? 50 : 78
  const v_overlap = is_mobile ? 18 : 30
  const h_gap = is_mobile ? 2 : 3

  // Move selected cards to a new custom pile
  const handle_create_pile = () => {
    if (selected_ids.size === 0) return

    const selected_array = Array.from(selected_ids)
    set_custom_columns(prev => {
      const next = new Map(prev)

      // Remove selected cards from any existing custom columns
      next.forEach((ids, col_id) => {
        const filtered = ids.filter(id => !selected_ids.has(id))
        if (filtered.length === 0) {
          next.delete(col_id)
        } else {
          next.set(col_id, filtered)
        }
      })

      // Create new column with selected cards
      const new_col_id = `custom-${Date.now()}`
      next.set(new_col_id, selected_array)

      return next
    })
  }

  // Reset all custom arrangements
  const handle_reset = () => {
    set_custom_columns(new Map())
  }

  // Select all cards of a given suit
  const handle_select_suit = (suit: number) => {
    const suit_cards = cards.filter(c => c.Suit === suit)
    if (suit_cards.length === 0) return

    // Toggle: if all are selected, deselect; otherwise select all
    const all_selected = suit_cards.every(c => selected_ids.has(c.Id))
    suit_cards.forEach(c => {
      if (all_selected) {
        on_card_click(c.Id) // deselect
      } else if (!selected_ids.has(c.Id)) {
        on_toggle_selection(c.Id) // select
      }
    })
  }

  // Swipe-to-select handlers
  const find_card_at_point = (x: number, y: number): number | null => {
    for (const [card_id, el] of card_refs.current) {
      const rect = el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return card_id
      }
    }
    return null
  }

  const handle_swipe_start = (e: React.MouseEvent | React.TouchEvent) => {
    const point = 'touches' in e ? e.touches[0] : e
    swipe_start.current = { x: point.clientX, y: point.clientY }
    swiped_cards.current.clear()
    set_is_swiping(false)
  }

  const handle_swipe_move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!swipe_start.current) return

    const point = 'touches' in e ? e.touches[0] : e
    const dx = Math.abs(point.clientX - swipe_start.current.x)
    const dy = Math.abs(point.clientY - swipe_start.current.y)

    // Start swiping if moved more than 5px
    if (dx > 5 || dy > 5) {
      set_is_swiping(true)
    }

    if (is_swiping) {
      const card_id = find_card_at_point(point.clientX, point.clientY)
      if (card_id !== null && !swiped_cards.current.has(card_id)) {
        swiped_cards.current.add(card_id)
        on_toggle_selection(card_id)
      }
    }
  }

  const handle_swipe_end = () => {
    swipe_start.current = null
    set_is_swiping(false)
    // Don't clear swiped_cards here - let click handler check it
    setTimeout(() => swiped_cards.current.clear(), 50)
  }

  // Double-tap on custom column to dissolve it
  const handle_column_double_click = (col_id: string) => {
    if (col_id.startsWith('custom-')) {
      set_custom_columns(prev => {
        const next = new Map(prev)
        next.delete(col_id)
        return next
      })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Cards area with swipe detection */}
      <div
        onMouseDown={handle_swipe_start}
        onMouseMove={handle_swipe_move}
        onMouseUp={handle_swipe_end}
        onMouseLeave={handle_swipe_end}
        onTouchStart={handle_swipe_start}
        onTouchMove={handle_swipe_move}
        onTouchEnd={handle_swipe_end}
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: is_mobile ? '4px 8px' : '8px 16px',
          overflowX: 'auto',
          overflowY: 'visible',
          WebkitOverflowScrolling: 'touch',
          width: '100%',
          cursor: is_swiping ? 'crosshair' : 'default',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', gap: h_gap, alignItems: 'flex-end' }}>
          {columns.map((col, col_idx) => {
            const col_cards = col.card_ids.map(id => card_by_id.get(id)!).filter(Boolean)
            const col_height = card_height + (col_cards.length - 1) * v_overlap

            return (
              <div
                key={col.id}
                onDoubleClick={() => handle_column_double_click(col.id)}
                style={{
                  position: 'relative',
                  width: card_width,
                  height: col_height,
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                <AnimatePresence>
                  {col_cards.map((card, card_idx) => {
                    // First card (idx 0) = bottom position, FRONT (highest z-index)
                    // Last card = top position, BACK (lowest z-index, only top peeks out)
                    const from_bottom = card_idx

                    return (
                      <motion.div
                        key={card.Id}
                        ref={(el) => { if (el) card_refs.current.set(card.Id, el) }}
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.8 }}
                        transition={{ delay: (col_idx * 0.3 + card_idx) * 0.01 }}
                        style={{
                          position: 'absolute',
                          bottom: from_bottom * v_overlap,
                          left: 0,
                          zIndex: col_cards.length - card_idx,
                          cursor: 'pointer',
                          touchAction: 'none',
                        }}
                      >
                        <Card
                          card={card}
                          level={level}
                          selected={selected_ids.has(card.Id)}
                          on_click={() => handle_card_click(card)}
                          size="small"
                        />
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>

      {/* Suit filter buttons + action buttons */}
      <div style={{
        display: 'flex',
        gap: is_mobile ? 6 : 10,
        marginTop: is_mobile ? 4 : 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {/* Suit buttons */}
        <div style={{ display: 'flex', gap: is_mobile ? 4 : 6 }}>
          {[
            { suit: Suit_Spades, symbol: '♠', color: '#000' },
            { suit: Suit_Hearts, symbol: '♥', color: '#dc3545' },
            { suit: Suit_Clubs, symbol: '♣', color: '#000' },
            { suit: Suit_Diamonds, symbol: '♦', color: '#dc3545' },
          ].map(({ suit, symbol, color }) => (
            <button
              key={suit}
              onClick={() => handle_select_suit(suit)}
              style={{
                width: is_mobile ? 28 : 34,
                height: is_mobile ? 28 : 34,
                fontSize: is_mobile ? 16 : 20,
                backgroundColor: '#fff',
                color: color,
                border: '1px solid #ccc',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {symbol}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: is_mobile ? 20 : 24, backgroundColor: '#555' }} />

        {/* Action buttons */}
        <button
          onClick={handle_create_pile}
          disabled={selected_ids.size === 0}
          style={{
            padding: is_mobile ? '6px 10px' : '8px 14px',
            fontSize: is_mobile ? 11 : 13,
            backgroundColor: selected_ids.size > 0 ? '#9c27b0' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: selected_ids.size > 0 ? 'pointer' : 'default',
            opacity: selected_ids.size > 0 ? 1 : 0.5,
          }}
        >
          New Pile
        </button>
        <button
          onClick={handle_reset}
          disabled={custom_columns.size === 0}
          style={{
            padding: is_mobile ? '6px 10px' : '8px 14px',
            fontSize: is_mobile ? 11 : 13,
            backgroundColor: custom_columns.size > 0 ? '#607d8b' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: custom_columns.size > 0 ? 'pointer' : 'default',
            opacity: custom_columns.size > 0 ? 1 : 0.5,
          }}
        >
          Reset
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: is_mobile ? 20 : 24, backgroundColor: '#555' }} />

        {/* Play/Pass buttons */}
        <button
          onClick={on_pass}
          disabled={!is_my_turn || !can_pass || cards.length === 0}
          style={{
            padding: is_mobile ? '6px 12px' : '8px 16px',
            fontSize: is_mobile ? 12 : 14,
            backgroundColor: is_my_turn && can_pass && cards.length > 0 ? '#dc3545' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: is_my_turn && can_pass && cards.length > 0 ? 'pointer' : 'default',
            opacity: is_my_turn && can_pass && cards.length > 0 ? 1 : 0.5,
          }}
        >
          Pass
        </button>
        <button
          onClick={on_play}
          disabled={!is_my_turn || selected_ids.size === 0 || cards.length === 0}
          style={{
            padding: is_mobile ? '6px 16px' : '8px 24px',
            fontSize: is_mobile ? 13 : 15,
            fontWeight: 'bold',
            backgroundColor: is_my_turn && selected_ids.size > 0 && cards.length > 0 ? '#28a745' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: is_my_turn && selected_ids.size > 0 && cards.length > 0 ? 'pointer' : 'default',
            opacity: is_my_turn && selected_ids.size > 0 && cards.length > 0 ? 1 : 0.5,
          }}
        >
          Play
        </button>
      </div>
    </div>
  )
}

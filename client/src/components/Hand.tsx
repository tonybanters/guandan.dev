import { useRef, useCallback, useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card as Card_Type, Rank, Rank_Ten, Suit_Hearts, Suit_Diamonds, Suit_Clubs, Suit_Spades, is_wild } from '../game/types'
import { Card, CARD_CONFIG } from './Card'
import { use_is_mobile } from '../hooks/use_is_mobile'
import { detect_combo } from '../game/combos'

interface Hand_Props {
  cards: Card_Type[]
  level: Rank
  selected_ids: Set<number>
  on_card_click: (id: number) => void
  on_toggle_selection: (id: number) => void
  on_select_same_rank: (rank: number) => void
  on_clear_selection: () => void
  on_play: () => void
  on_pass: () => void
  is_my_turn: boolean
  can_pass: boolean
  is_tribute_mode?: 'give' | 'return' | false
}

interface Column {
  id: string
  card_ids: number[]
  is_custom: boolean
}

export function Hand({ cards, level, selected_ids, on_card_click, on_toggle_selection, on_select_same_rank, on_clear_selection, on_play, on_pass, is_my_turn, can_pass, is_tribute_mode }: Hand_Props) {
  const is_mobile = use_is_mobile()
  const last_click = useRef<{ id: number; time: number } | null>(null)
  const [custom_columns, set_custom_columns] = useState<Map<string, number[]>>(new Map())
  const prev_cards_length = useRef(0)

  // Swipe-to-select state
  const [is_swiping, set_is_swiping] = useState(false)
  const swipe_start = useRef<{ x: number; y: number } | null>(null)
  const swiped_cards = useRef<Set<number>>(new Set())
  const card_refs = useRef<Map<number, HTMLDivElement>>(new Map())

  // Reset custom columns when a new hand is dealt (hand size increases)
  useEffect(() => {
    if (cards.length > prev_cards_length.current && prev_cards_length.current > 0) {
      set_custom_columns(new Map())
    }
    prev_cards_length.current = cards.length
  }, [cards.length])

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
  // Jokers are always highest, level card second highest, then natural rank order (2=lowest, Ace=highest non-joker)
  const rank_order = (rank: number): number => {
    if (rank === 14) return 1000  // Red Joker
    if (rank === 13) return 999   // Black Joker
    if (rank === level) return 998  // Level card
    return rank  // Natural order: 0(2) lowest, 12(Ace) highest non-joker
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

  const card_size = is_mobile ? 'small' as const : 'normal' as const
  const cfg = CARD_CONFIG.hand[card_size]
  const card_width = cfg.width
  const card_height = cfg.height
  const v_overlap = cfg.v_overlap
  const h_visible = cfg.h_visible

  // Check if selected cards form a valid combo
  const is_valid_pile = useMemo(() => {
    if (selected_ids.size === 0) return false
    const selected_cards = Array.from(selected_ids)
      .map(id => cards.find(c => c.Id === id))
      .filter((c): c is Card_Type => c !== undefined)
    if (selected_cards.length !== selected_ids.size) return false
    return detect_combo(selected_cards, level) !== null
  }, [selected_ids, cards, level])

  // Move selected cards to a new custom pile
  const handle_create_pile = () => {
    if (!is_valid_pile) return

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

    // Clear selection after creating pile
    on_clear_selection()
  }

  // Reset all custom arrangements
  const handle_reset = () => {
    set_custom_columns(new Map())
  }

  // Track which straight flush index is selected for each suit
  const sf_index_ref = useRef<Map<number, number>>(new Map())

  // Find all valid 5-card straight flushes for a suit, sorted by starting rank
  const find_straight_flushes_for_suit = (suit: number): Card_Type[][] => {
    const suit_cards = cards.filter(c => c.Suit === suit && c.Suit < 4) // Exclude jokers
    const wild_cards = cards.filter(c => c.Rank === level && c.Suit === Suit_Hearts)

    const results: Card_Type[][] = []

    // Try each possible starting rank (excluding 2/rank 0 since straights can't include 2)
    for (let start = 1; start <= 12 - 4; start++) { // 3 through 10 (ranks 1-8)
      const needed_ranks = [start, start + 1, start + 2, start + 3, start + 4]
      const sf_cards: Card_Type[] = []
      let wilds_used = 0

      for (const rank of needed_ranks) {
        const card = suit_cards.find(c => c.Rank === rank)
        if (card) {
          sf_cards.push(card)
        } else if (wilds_used < wild_cards.length) {
          sf_cards.push(wild_cards[wilds_used])
          wilds_used++
        } else {
          break // Can't complete this straight flush
        }
      }

      if (sf_cards.length === 5) {
        results.push(sf_cards)
      }
    }

    return results
  }

  // Check if a specific suit has a straight flush
  const has_straight_flush_for_suit = (suit: number): boolean => {
    return find_straight_flushes_for_suit(suit).length > 0
  }

  // Select the next straight flush for a suit (cycles through options)
  const handle_select_suit = (suit: number) => {
    const straight_flushes = find_straight_flushes_for_suit(suit)
    if (straight_flushes.length === 0) return

    // Check if current selection matches any known SF
    const current_selected_ids = new Set(selected_ids)
    const matching_sf_idx = straight_flushes.findIndex(sf =>
      sf.length === selected_ids.size && sf.every(c => current_selected_ids.has(c.Id))
    )

    // Determine next index
    let next_idx: number
    if (matching_sf_idx !== -1) {
      // Currently have a SF selected, cycle to next (or deselect if at end)
      next_idx = matching_sf_idx + 1
      if (next_idx >= straight_flushes.length) {
        // Deselect all
        on_clear_selection()
        sf_index_ref.current.set(suit, -1)
        return
      }
    } else {
      // No SF selected, start from first
      next_idx = 0
    }

    // Clear current selection and select the new SF
    on_clear_selection()
    const sf_to_select = straight_flushes[next_idx]
    sf_to_select.forEach(c => on_toggle_selection(c.Id))
    sf_index_ref.current.set(suit, next_idx)
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

  const is_valid_tribute_selection = useMemo(() => {
    if (selected_ids.size !== 1) return false
    const card = cards.find(c => c.Id === Array.from(selected_ids)[0])
    if (!card) return false
    if (is_tribute_mode === 'give') return !is_wild(card, level)
    if (is_tribute_mode === 'return') return card.Rank <= Rank_Ten && !is_wild(card, level)
    return false
  }, [selected_ids, cards, level, is_tribute_mode])

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
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          {columns.map((col, col_idx) => {
            const col_cards = col.card_ids.map(id => card_by_id.get(id)!).filter(Boolean)
            const col_height = card_height + (col_cards.length - 1) * v_overlap
            const is_last_col = col_idx === columns.length - 1

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
                  marginRight: is_last_col ? 0 : -(card_width - h_visible),
                  zIndex: col_idx,
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
                          opacity: 1,
                        }}
                      >
                        <Card
                          card={card}
                          level={level}
                          selected={selected_ids.has(card.Id)}
                          on_click={() => handle_card_click(card)}
                          size={card_size}
                          context="hand"
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
        gap: is_mobile ? 5 : 10,
        marginTop: is_mobile ? 3 : 8,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {/* Turn indicator - mobile only, in the row */}
        {is_mobile && is_my_turn && cards.length > 0 && (
          <div style={{
            padding: '4px 10px',
            backgroundColor: '#ffc107',
            color: '#000',
            borderRadius: 4,
            fontWeight: 'bold',
            fontSize: 11,
          }}>
            Your turn
          </div>
        )}

        {/* Suit buttons - available in tribute mode for SF detection, or when SF exists in normal mode */}
        <div style={{ display: 'flex', gap: is_mobile ? 3 : 6 }}>
          {[
            { suit: Suit_Spades, symbol: '♠', color: '#000' },
            { suit: Suit_Hearts, symbol: '♥', color: '#dc3545' },
            { suit: Suit_Clubs, symbol: '♣', color: '#000' },
            { suit: Suit_Diamonds, symbol: '♦', color: '#dc3545' },
          ].map(({ suit, symbol, color }) => {
            const suit_enabled = has_straight_flush_for_suit(suit)
            return (
            <button
              key={suit}
              onClick={() => handle_select_suit(suit)}
              disabled={!suit_enabled}
              title={suit_enabled ? `Select all ${symbol} cards` : `No straight flush in ${symbol}`}
              style={{
                width: is_mobile ? 26 : 34,
                height: is_mobile ? 26 : 34,
                fontSize: is_mobile ? 14 : 20,
                backgroundColor: suit_enabled ? '#fff' : '#f0f0f0',
                color: suit_enabled ? color : '#ccc',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: suit_enabled ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                opacity: suit_enabled ? 1 : 0.5,
              }}
            >
              {symbol}
            </button>
          )})}
        </div>

        {/* Divider */}
        {!is_tribute_mode && <div style={{ width: 1, height: is_mobile ? 20 : 24, backgroundColor: '#555' }} />}

        {/* Action buttons - hidden in tribute mode */}
        {!is_tribute_mode && (
          <>
            <button
              onClick={handle_create_pile}
              disabled={!is_valid_pile}
              title={selected_ids.size === 0 ? 'Select cards' : is_valid_pile ? 'Create pile' : 'Invalid combo'}
              style={{
                padding: is_mobile ? '4px 8px' : '8px 14px',
                fontSize: is_mobile ? 11 : 13,
                backgroundColor: is_valid_pile ? '#9c27b0' : '#444',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: is_valid_pile ? 'pointer' : 'default',
                opacity: is_valid_pile ? 1 : 0.5,
              }}
            >
              Pile
            </button>
            <button
              onClick={handle_reset}
              disabled={custom_columns.size === 0}
              style={{
                padding: is_mobile ? '4px 8px' : '8px 14px',
                fontSize: is_mobile ? 11 : 13,
                backgroundColor: custom_columns.size > 0 ? '#607d8b' : '#444',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: custom_columns.size > 0 ? 'pointer' : 'default',
                opacity: custom_columns.size > 0 ? 1 : 0.5,
              }}
            >
              Reset
            </button>
          </>
        )}

        {/* Divider - hidden in tribute mode */}
        {!is_tribute_mode && <div style={{ width: 1, height: is_mobile ? 20 : 24, backgroundColor: '#555' }} />}

        {/* Play/Pass buttons */}
        {!is_tribute_mode && <button
          onClick={on_pass}
          disabled={!is_my_turn || !can_pass || cards.length === 0}
          style={{
            padding: is_mobile ? '4px 10px' : '8px 16px',
            fontSize: is_mobile ? 12 : 14,
            backgroundColor: is_my_turn && can_pass && cards.length > 0 ? '#dc3545' : '#444',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: is_my_turn && can_pass && cards.length > 0 ? 'pointer' : 'default',
            opacity: is_my_turn && can_pass && cards.length > 0 ? 1 : 0.5,
          }}
        >
          Pass
        </button>}

        {/* Play button (or Tribute button in tribute mode) */}
        <button
          onClick={on_play}
          disabled={is_tribute_mode ? !is_valid_tribute_selection : (!is_my_turn || selected_ids.size === 0 || cards.length === 0)}
          style={{
            padding: is_mobile ? '4px 14px' : '8px 24px',
            fontSize: is_mobile ? 13 : 15,
            fontWeight: 'bold',
            backgroundColor: is_tribute_mode
              ? (is_valid_tribute_selection ? '#ffc107' : '#444')
              : (is_my_turn && selected_ids.size > 0 && cards.length > 0 ? '#28a745' : '#444'),
            color: is_tribute_mode ? '#000' : '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: is_tribute_mode
              ? (is_valid_tribute_selection ? 'pointer' : 'default')
              : (is_my_turn && selected_ids.size > 0 && cards.length > 0 ? 'pointer' : 'default'),
            opacity: (is_tribute_mode ? is_valid_tribute_selection : (is_my_turn && selected_ids.size > 0 && cards.length > 0)) ? 1 : 0.5,
          }}
        >
          {is_tribute_mode ? 'Tribute' : 'Play'}
        </button>
      </div>
    </div>
  )
}

import { useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card as Card_Type, Rank } from '../game/types'
import { Card } from './Card'
import { use_is_mobile } from '../hooks/use_is_mobile'

interface Hand_Props {
  cards: Card_Type[]
  level: Rank
  selected_ids: Set<number>
  on_card_click: (id: number) => void
  on_select_same_rank: (rank: number) => void
}

interface Column {
  id: string
  card_ids: number[]
  is_custom: boolean
}

export function Hand({ cards, level, selected_ids, on_card_click, on_select_same_rank }: Hand_Props) {
  const is_mobile = use_is_mobile()
  const last_click = useRef<{ id: number; time: number } | null>(null)
  const [custom_columns, set_custom_columns] = useState<Map<string, number[]>>(new Map())
  const [drag_card_id, set_drag_card_id] = useState<number | null>(null)
  const [drop_target, set_drop_target] = useState<string | null>(null)

  // Touch drag state
  const touch_start_pos = useRef<{ x: number; y: number } | null>(null)
  const is_touch_dragging = useRef(false)
  const column_refs = useRef<Map<string, HTMLDivElement>>(new Map())
  const new_pile_ref = useRef<HTMLDivElement>(null)

  const handle_card_click = useCallback((card: Card_Type) => {
    // Don't trigger click if we were dragging
    if (is_touch_dragging.current) {
      is_touch_dragging.current = false
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

  // Build columns: custom columns first, then auto-sorted remaining cards
  const columns: Column[] = []

  // Add custom columns (filter out cards no longer in hand)
  custom_columns.forEach((card_ids, col_id) => {
    const valid_ids = card_ids.filter(id => valid_card_ids.has(id))
    if (valid_ids.length > 0) {
      columns.push({ id: col_id, card_ids: valid_ids, is_custom: true })
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

  // Card lookup
  const card_by_id = new Map(cards.map(c => [c.Id, c]))

  const card_width = is_mobile ? 44 : 56
  const card_height = is_mobile ? 62 : 78
  const v_overlap = is_mobile ? 24 : 30
  const h_gap = is_mobile ? 3 : 4
  const selection_lift = 24

  // Find drop target from touch position
  const find_drop_target = (x: number, y: number): string | null => {
    // Check new pile zone
    if (new_pile_ref.current) {
      const rect = new_pile_ref.current.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return 'new'
      }
    }

    // Check custom columns
    for (const [col_id, el] of column_refs.current) {
      if (col_id.startsWith('custom-')) {
        const rect = el.getBoundingClientRect()
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          return col_id
        }
      }
    }

    return null
  }

  // Commit the drop
  const commit_drop = (card_id: number, target: string | null) => {
    if (target === null) {
      set_drag_card_id(null)
      set_drop_target(null)
      return
    }

    set_custom_columns(prev => {
      const next = new Map(prev)

      // Remove from any existing custom column
      next.forEach((ids, col_id) => {
        const filtered = ids.filter(id => id !== card_id)
        if (filtered.length === 0) {
          next.delete(col_id)
        } else {
          next.set(col_id, filtered)
        }
      })

      if (target === 'new') {
        const new_col_id = `custom-${Date.now()}`
        next.set(new_col_id, [card_id])
      } else if (target.startsWith('custom-')) {
        const existing = next.get(target) || []
        next.set(target, [...existing, card_id])
      }

      return next
    })

    set_drag_card_id(null)
    set_drop_target(null)
  }

  // Mouse drag handlers
  const handle_drag_start = (card_id: number) => {
    set_drag_card_id(card_id)
  }

  const handle_drag_end = () => {
    if (drag_card_id !== null && drop_target !== null) {
      commit_drop(drag_card_id, drop_target)
    } else {
      set_drag_card_id(null)
      set_drop_target(null)
    }
  }

  const handle_drag_over_column = (col_id: string) => {
    set_drop_target(col_id)
  }

  const handle_drag_leave = () => {
    set_drop_target(null)
  }

  // Touch handlers
  const handle_touch_start = (_card_id: number, e: React.TouchEvent) => {
    const touch = e.touches[0]
    touch_start_pos.current = { x: touch.clientX, y: touch.clientY }
    is_touch_dragging.current = false
  }

  const handle_touch_move = (card_id: number, e: React.TouchEvent) => {
    if (!touch_start_pos.current) return

    const touch = e.touches[0]
    const dx = Math.abs(touch.clientX - touch_start_pos.current.x)
    const dy = Math.abs(touch.clientY - touch_start_pos.current.y)

    // Start dragging if moved more than 10px
    if (dx > 10 || dy > 10) {
      is_touch_dragging.current = true
      set_drag_card_id(card_id)

      const target = find_drop_target(touch.clientX, touch.clientY)
      set_drop_target(target)
    }
  }

  const handle_touch_end = (_card_id: number) => {
    if (is_touch_dragging.current && drag_card_id !== null) {
      commit_drop(drag_card_id, drop_target)
    }
    touch_start_pos.current = null
    // Don't reset is_touch_dragging here - let click handler check it
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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: is_mobile ? '4px 8px' : '8px 16px',
        paddingTop: selection_lift + (is_mobile ? 4 : 8),
        overflowX: 'auto',
        overflowY: 'visible',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', gap: h_gap, alignItems: 'flex-start' }}>
        {/* New pile drop zone - always visible */}
        <div
          ref={new_pile_ref}
          onDragOver={(e) => { e.preventDefault(); set_drop_target('new') }}
          onDragLeave={handle_drag_leave}
          onDrop={handle_drag_end}
          style={{
            width: card_width,
            height: card_height,
            border: `2px dashed ${drop_target === 'new' ? '#4caf50' : drag_card_id !== null ? '#888' : '#444'}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: drop_target === 'new' ? '#4caf50' : drag_card_id !== null ? '#888' : '#555',
            fontSize: is_mobile ? 18 : 24,
            backgroundColor: drop_target === 'new' ? 'rgba(76,175,80,0.15)' : 'transparent',
            opacity: drag_card_id !== null ? 1 : 0.4,
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          +
        </div>

        {columns.map((col, col_idx) => {
          const col_cards = col.card_ids.map(id => card_by_id.get(id)!).filter(Boolean)
          const col_height = card_height + (col_cards.length - 1) * v_overlap

          return (
            <div
              key={col.id}
              ref={(el) => { if (el) column_refs.current.set(col.id, el) }}
              onDragOver={(e) => { e.preventDefault(); if (col.is_custom) handle_drag_over_column(col.id) }}
              onDragLeave={handle_drag_leave}
              onDrop={handle_drag_end}
              onDoubleClick={() => handle_column_double_click(col.id)}
              style={{
                position: 'relative',
                width: card_width,
                height: col_height,
                borderLeft: col.is_custom ? '2px solid #9c27b0' : 'none',
                paddingLeft: col.is_custom ? 2 : 0,
                backgroundColor: drop_target === col.id ? 'rgba(156,39,176,0.15)' : 'transparent',
                borderRadius: 4,
                flexShrink: 0,
              }}
            >
              {col.is_custom && (
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: 0,
                    fontSize: 8,
                    color: '#9c27b0',
                  }}
                >
                  ✦
                </div>
              )}
              <AnimatePresence>
                {col_cards.map((card, card_idx) => (
                  <motion.div
                    key={card.Id}
                    draggable
                    onDragStart={() => handle_drag_start(card.Id)}
                    onDragEnd={handle_drag_end}
                    onTouchStart={(e) => handle_touch_start(card.Id, e)}
                    onTouchMove={(e) => handle_touch_move(card.Id, e)}
                    onTouchEnd={() => handle_touch_end(card.Id)}
                    initial={{ opacity: 0, x: 20, scale: 0.8 }}
                    animate={{
                      opacity: drag_card_id === card.Id ? 0.5 : 1,
                      x: 0,
                      scale: 1
                    }}
                    exit={{ opacity: 0, x: -20, scale: 0.8 }}
                    transition={{ delay: (col_idx * 0.3 + card_idx) * 0.01 }}
                    style={{
                      position: 'absolute',
                      top: card_idx * v_overlap,
                      left: 0,
                      zIndex: card_idx,
                      cursor: 'grab',
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
                ))}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

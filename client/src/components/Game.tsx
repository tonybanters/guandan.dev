import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card as Card_Type, Rank, Tribute_Event, get_rank_symbol, Rank_Two, Rank_Ten, Rank_King, Rank_Ace, Rank_Black_Joker, Rank_Red_Joker, is_wild } from '../game/types'
import { Hand } from './Hand'
import { Card, CARD_CONFIG } from './Card'
import { Cheat_Sheet } from './Cheat_Sheet'
import { use_is_mobile, use_is_short } from '../hooks/use_is_mobile'
import { get_rank_value } from '../game/combos'

interface Player_Play {
  cards: Card_Type[]
  is_pass: boolean
}

// Sort cards by natural rank order for display, with jokers last. When a
// play uses the ace as the low end of a run (A-2-3-4-5, AA2233, ...) the
// ace sorts before the 2; an ace alongside a king stays high (10-J-Q-K-A).
function sort_played_cards(cards: Card_Type[]): Card_Type[] {
  const has_rank = (r: Rank) => cards.some(c => c.Rank === r)
  const ace_low = has_rank(Rank_Ace) && has_rank(Rank_Two) && !has_rank(Rank_King)

  const natural_order = (rank: Rank): number => {
    if (rank === Rank_Black_Joker) return 100
    if (rank === Rank_Red_Joker) return 101
    if (rank === Rank_Ace) return ace_low ? -1 : 12
    if (rank === Rank_Two) return 0
    return rank // 3-K maps to 1-11
  }

  return [...cards].sort((a, b) => natural_order(a.Rank) - natural_order(b.Rank))
}

interface Game_Props {
  hand: Card_Type[]
  level: Rank
  selected_ids: Set<number>
  on_card_click: (id: number) => void
  on_select_same_rank: (rank: number) => void
  on_clear_selection: () => void
  on_play: () => void
  on_pass: () => void
  table_cards: Card_Type[]
  combo_type: string
  current_turn: number
  my_seat: number
  can_pass: boolean
  player_card_counts: number[]
  team_levels: [number, number]
  players_map: Record<number, string>
  last_play_seat: number | null
  player_plays: Record<number, Player_Play>
  leading_seat: number | null
  // Tribute mode
  is_tribute_mode?: 'give' | 'return' | false
  tribute_target_name?: string
  on_tribute?: () => void
  tribute_events: Tribute_Event[]
  on_leave: () => void
}

export function Game({
  hand,
  level,
  selected_ids,
  on_card_click,
  on_select_same_rank,
  on_clear_selection,
  on_play,
  on_pass,
  current_turn,
  my_seat,
  can_pass,
  player_card_counts,
  team_levels,
  players_map,
  player_plays,
  leading_seat,
  is_tribute_mode,
  tribute_target_name,
  on_tribute,
  tribute_events,
  on_leave,
}: Game_Props) {
  const is_my_turn = current_turn === my_seat
  const relative_positions = get_relative_positions(my_seat)
  const is_mobile = use_is_mobile()
  const [show_leave_confirm, set_show_leave_confirm] = useState(false)

  // Save the original on_card_click for suit buttons to use
  const original_on_card_click = on_card_click

  // Tribute mode: allow selecting any card, but will only be submitted if valid rank
  const tribute_card_click = (id: number) => {
    // Deselect if already selected, otherwise select (replacing any current selection)
    if (selected_ids.has(id)) {
      on_card_click(id)
    } else {
      on_clear_selection()
      on_card_click(id)
    }
  }

  // Tribute mode: disable rank selection
  const tribute_select_same_rank = () => {
    // No-op in tribute mode
  }

  const required_tribute_rank = useMemo((): Rank | null => {
    if (is_tribute_mode !== 'give') return null
    const eligible = hand.filter(c => !is_wild(c, level))
    if (eligible.length === 0) return null
    const max_value = Math.max(...eligible.map(c => get_rank_value(c.Rank, level)))
    const top = eligible.find(c => get_rank_value(c.Rank, level) === max_value)
    return top ? top.Rank : null
  }, [hand, level, is_tribute_mode])

  const is_valid_tribute_selection = useMemo(() => {
    if (selected_ids.size !== 1) return false
    const card = hand.find(c => c.Id === Array.from(selected_ids)[0])
    if (!card) return false
    if (is_tribute_mode === 'give') {
      if (is_wild(card, level)) return false
      if (required_tribute_rank === null) return false
      return card.Rank === required_tribute_rank
    }
    if (is_tribute_mode === 'return') return card.Rank <= Rank_Ten && !is_wild(card, level)
    return false
  }, [selected_ids, hand, level, is_tribute_mode, required_tribute_rank])

  const can_play = is_my_turn && selected_ids.size > 0 && hand.length > 0
  const pass_enabled = is_my_turn && can_pass && hand.length > 0
  const show_actions = hand.length > 0 && (is_tribute_mode ? true : is_my_turn)

  return (
    <div style={is_mobile ? mobile_styles.container : styles.container}>
      {/* Info bar */}
      <div style={is_mobile ? mobile_styles.info_bar : styles.info_bar}>
        <div data-tut="level" style={is_mobile ? mobile_styles.level_badge : styles.level_badge}>
          Lvl: {get_rank_symbol(level)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: is_mobile ? 8 : 12 }}>
          <div style={is_mobile ? mobile_styles.team_scores : styles.team_scores}>
            <span style={{ color: '#64b5f6' }}>T1: {get_rank_symbol(team_levels[0] as Rank)}</span>
            <span style={{ marginLeft: is_mobile ? 8 : 12, color: '#f48fb1' }}>T2: {get_rank_symbol(team_levels[1] as Rank)}</span>
          </div>
          <button
            onClick={() => set_show_leave_confirm(true)}
            style={{
              padding: is_mobile ? '2px 8px' : '3px 10px',
              fontSize: is_mobile ? 10 : 12,
              backgroundColor: 'transparent',
              color: '#e57373',
              border: '1px solid #e57373',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Game area - relative container with absolute positioned elements */}
      <div
        style={is_mobile ? mobile_styles.game_area : styles.game_area}
        onClick={(e) => { if (e.target === e.currentTarget) on_clear_selection() }}
      >
        {/* Top player badge + cards */}
        <Player_Badge
          seat={relative_positions.top}
          name={players_map[relative_positions.top]}
          count={player_card_counts[relative_positions.top]}
          is_turn={current_turn === relative_positions.top}
          is_leading={leading_seat === relative_positions.top}
          position="top"
          is_mobile={is_mobile}
        />
        <Played_Cards
          play={player_plays[relative_positions.top]}
          is_leading={leading_seat === relative_positions.top}
          level={level}
          position="top"
          is_mobile={is_mobile}
        />

        {/* Left player badge + cards */}
        <Player_Badge
          seat={relative_positions.left}
          name={players_map[relative_positions.left]}
          count={player_card_counts[relative_positions.left]}
          is_turn={current_turn === relative_positions.left}
          is_leading={leading_seat === relative_positions.left}
          position="left"
          is_mobile={is_mobile}
        />
        <Played_Cards
          play={player_plays[relative_positions.left]}
          is_leading={leading_seat === relative_positions.left}
          level={level}
          position="left"
          is_mobile={is_mobile}
        />

        {/* Right player badge + cards */}
        <Player_Badge
          seat={relative_positions.right}
          name={players_map[relative_positions.right]}
          count={player_card_counts[relative_positions.right]}
          is_turn={current_turn === relative_positions.right}
          is_leading={leading_seat === relative_positions.right}
          position="right"
          is_mobile={is_mobile}
        />
        <Played_Cards
          play={player_plays[relative_positions.right]}
          is_leading={leading_seat === relative_positions.right}
          level={level}
          position="right"
          is_mobile={is_mobile}
        />

        {/* My played cards - at bottom center of game area */}
        <My_Played_Cards
          play={player_plays[my_seat]}
          is_leading={leading_seat === my_seat}
          level={level}
          is_mobile={is_mobile}
        />

        {/* Turn actions - centered between table and hand, only when it's my turn */}
        {show_actions && (
          <div style={{
            position: 'absolute',
            bottom: is_mobile ? 8 : 14,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            zIndex: 40,
            pointerEvents: 'none',
          }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              display: 'flex',
              gap: is_mobile ? 10 : 16,
              pointerEvents: 'auto',
            }}
          >
            {is_tribute_mode ? (
              <Action_Button
                label="Tribute"
                enabled={is_valid_tribute_selection}
                color="#ffc107"
                text_color="#000"
                on_click={on_tribute!}
                is_mobile={is_mobile}
              />
            ) : (
              <>
                <Action_Button
                  label="Pass"
                  enabled={pass_enabled}
                  color="#dc3545"
                  on_click={on_pass}
                  is_mobile={is_mobile}
                  tut_id="pass"
                />
                <Action_Button
                  label="Play"
                  enabled={can_play}
                  color="#28a745"
                  on_click={on_play}
                  is_mobile={is_mobile}
                  tut_id="play"
                />
              </>
            )}
          </motion.div>
          </div>
        )}
      </div>

      {/* Tribute instruction - centered on screen */}
      {is_tribute_mode && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#ffc107',
          fontWeight: 'bold',
          fontSize: is_mobile ? 16 : 20,
          zIndex: 100,
        }}>
          Select 1 card to give to {tribute_target_name}
        </div>
      )}

      {/* Public tribute feed - everyone sees who paid what to whom */}
      <div style={{
        position: 'fixed',
        top: '26%',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        zIndex: 200,
        pointerEvents: 'none',
      }}>
        <AnimatePresence>
          {tribute_events.map((ev) => (
            <Tribute_Banner
              key={ev.id}
              event={ev}
              level={level}
              my_seat={my_seat}
              players_map={players_map}
              is_mobile={is_mobile}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* My area at bottom */}
      <div style={is_mobile ? mobile_styles.my_area : styles.my_area}>
        <Cheat_Sheet />
        <Hand
          cards={hand}
          level={level}
          selected_ids={selected_ids}
          on_card_click={is_tribute_mode ? tribute_card_click : on_card_click}
          on_toggle_selection={original_on_card_click}
          on_select_same_rank={is_tribute_mode ? tribute_select_same_rank : on_select_same_rank}
          on_clear_selection={on_clear_selection}
          is_tribute_mode={is_tribute_mode}
        />

        {hand.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ ...(is_mobile ? mobile_styles.turn_indicator : styles.turn_indicator), backgroundColor: '#28a745' }}
          >
            You finished!
          </motion.div>
        )}
      </div>

      <Leave_Confirm_Modal
        open={show_leave_confirm}
        on_confirm={on_leave}
        on_cancel={() => set_show_leave_confirm(false)}
        is_mobile={is_mobile}
      />
    </div>
  )
}

interface Leave_Confirm_Modal_Props {
  open: boolean
  on_confirm: () => void
  on_cancel: () => void
  is_mobile: boolean
}

function Leave_Confirm_Modal({ open, on_confirm, on_cancel, is_mobile }: Leave_Confirm_Modal_Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={on_cancel}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#16213e',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: is_mobile ? '16px 20px' : '24px 28px',
              maxWidth: '85vw',
              textAlign: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{
              color: '#fff',
              fontWeight: 'bold',
              fontSize: is_mobile ? 16 : 18,
              marginBottom: 6,
            }}>
              Leave the game?
            </div>
            <div style={{
              color: '#aaa',
              fontSize: is_mobile ? 12 : 13,
              marginBottom: is_mobile ? 14 : 18,
            }}>
              Your seat is held for 60 seconds
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={on_cancel}
                style={{
                  padding: is_mobile ? '8px 18px' : '9px 22px',
                  fontSize: is_mobile ? 13 : 14,
                  backgroundColor: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={on_confirm}
                style={{
                  padding: is_mobile ? '8px 18px' : '9px 22px',
                  fontSize: is_mobile ? 13 : 14,
                  fontWeight: 'bold',
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Leave
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface Tribute_Banner_Props {
  event: Tribute_Event
  level: Rank
  my_seat: number
  players_map: Record<number, string>
  is_mobile: boolean
}

function Tribute_Banner({ event, level, my_seat, players_map, is_mobile }: Tribute_Banner_Props) {
  const seat_name = (seat: number) =>
    seat === my_seat ? 'You' : players_map[seat] || `P${seat + 1}`

  const is_return = event.kind === 'return'
  const accent = is_return ? '#64b5f6' : '#ffc107'

  const name_chip = (seat: number) => (
    <span style={{
      padding: is_mobile ? '2px 8px' : '3px 10px',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 6,
      fontSize: is_mobile ? 12 : 14,
      fontWeight: 'bold',
      color: '#fff',
      maxWidth: is_mobile ? 80 : 120,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {seat_name(seat)}
    </span>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: is_mobile ? 6 : 10,
        backgroundColor: event.kind === 'kang_gong' ? 'rgba(220, 53, 69, 0.85)' : 'rgba(0, 0, 0, 0.72)',
        border: `1px solid ${event.kind === 'kang_gong' ? '#dc3545' : accent}`,
        padding: is_mobile ? '4px 10px' : '6px 14px',
        borderRadius: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {event.kind === 'kang_gong' ? (
        <span style={{ color: '#fff', fontSize: is_mobile ? 12 : 14, fontWeight: 'bold' }}>
          Tribute refused — both red jokers (kang gong)
        </span>
      ) : (
        <>
          <span style={{
            color: accent,
            fontSize: is_mobile ? 9 : 10,
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            {is_return ? 'return' : 'tribute'}
          </span>
          {name_chip(event.from_seat)}
          {event.card && (
            <Card
              card={event.card}
              level={level}
              selected={false}
              on_click={() => {}}
              size={is_mobile ? 'tiny' : 'small'}
              context="table"
            />
          )}
          <span style={{ color: accent, fontSize: is_mobile ? 18 : 24, lineHeight: 1, fontWeight: 'bold' }}>
            →
          </span>
          {name_chip(event.to_seat)}
        </>
      )}
    </motion.div>
  )
}

interface Action_Button_Props {
  label: string
  enabled: boolean
  color: string
  text_color?: string
  on_click: () => void
  is_mobile: boolean
  tut_id?: string
}

function Action_Button({ label, enabled, color, text_color = '#fff', on_click, is_mobile, tut_id }: Action_Button_Props) {
  return (
    <motion.button
      data-tut={tut_id}
      whileTap={enabled ? { scale: 0.95 } : undefined}
      onClick={on_click}
      disabled={!enabled}
      style={{
        padding: is_mobile ? '7px 22px' : '10px 32px',
        fontSize: is_mobile ? 13 : 15,
        fontWeight: 'bold',
        backgroundColor: enabled ? color : 'rgba(60,60,60,0.85)',
        color: enabled ? text_color : 'rgba(255,255,255,0.4)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: 999,
        cursor: enabled ? 'pointer' : 'default',
        boxShadow: enabled ? '0 3px 8px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      {label}
    </motion.button>
  )
}

interface Player_Badge_Props {
  seat: number
  name?: string
  count: number
  is_turn: boolean
  is_leading: boolean
  position: 'top' | 'left' | 'right'
  is_mobile: boolean
}

function Player_Badge({ seat, name, count, is_turn, is_leading, position, is_mobile }: Player_Badge_Props) {
  const get_position_style = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 10,
    }

    if (position === 'top') {
      return {
        ...base,
        top: is_mobile ? 2 : 8,
        left: '50%',
        transform: 'translateX(-50%)',
      }
    }
    if (position === 'left') {
      return {
        ...base,
        left: is_mobile ? 2 : 8,
        top: '40%',
        transform: 'translateY(-50%)',
      }
    }
    // right
    return {
      ...base,
      right: is_mobile ? 2 : 8,
      top: '40%',
      transform: 'translateY(-50%)',
    }
  }

  const get_border_color = () => {
    if (is_leading) return '#4caf50'
    if (is_turn) return '#ffc107'
    return 'rgba(255,255,255,0.2)'
  }

  const get_bg_color = () => {
    if (is_leading) return 'rgba(76, 175, 80, 0.3)'
    if (is_turn) return 'rgba(255, 193, 7, 0.3)'
    return 'rgba(0, 0, 0, 0.6)'
  }

  // Mobile: minimal floating badge with no border/background
  if (is_mobile) {
    return (
      <div
        style={{
          ...get_position_style(),
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{
          color: seat % 2 === 0 ? '#64b5f6' : '#f48fb1',
          fontSize: 9,
          fontWeight: 'bold',
          maxWidth: 50,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name || `P${seat + 1}`}
        </div>
        <div style={{
          color: is_turn ? '#ffc107' : is_leading ? '#4caf50' : '#fff',
          fontSize: 12,
          fontWeight: 'bold',
          lineHeight: 1,
        }}>
          {count}
        </div>
      </div>
    )
  }

  // Desktop: boxed badge
  return (
    <div
      style={{
        ...get_position_style(),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 12px',
        borderRadius: 10,
        border: `2px solid ${get_border_color()}`,
        backgroundColor: get_bg_color(),
        minWidth: 50,
      }}
    >
      <div style={{
        color: seat % 2 === 0 ? '#64b5f6' : '#f48fb1',
        fontSize: 12,
        fontWeight: 'bold',
        maxWidth: 70,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {name || `P${seat + 1}`}
      </div>
      <div style={{
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        lineHeight: 1.2,
      }}>
        {count}
      </div>
    </div>
  )
}

interface Played_Cards_Props {
  play?: Player_Play
  is_leading: boolean
  level: Rank
  position: 'top' | 'left' | 'right'
  is_mobile: boolean
}

function Played_Cards({ play, is_leading, level, position, is_mobile }: Played_Cards_Props) {
  const is_short = use_is_short()
  if (!play) return null

  const get_position_style = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 5,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    }

    // teammate (top) and my plays share the same centered x so equal-length
    // combos line up; opponents' plays sit beside their badges
    if (position === 'top') {
      return {
        ...base,
        top: is_mobile ? 28 : 70,
        left: '50%',
        transform: 'translateX(-50%)',
      }
    }
    if (position === 'left') {
      return {
        ...base,
        left: is_mobile ? 52 : 110,
        top: '40%',
        transform: 'translateY(-50%)',
      }
    }
    // right
    return {
      ...base,
      right: is_mobile ? 52 : 110,
      top: '40%',
      transform: 'translateY(-50%)',
    }
  }

  if (play.is_pass) {
    return (
      <div style={get_position_style()}>
        <div style={{
          color: '#aaa',
          fontSize: is_mobile ? 11 : 16,
          fontStyle: 'italic',
          backgroundColor: 'rgba(0,0,0,0.4)',
          padding: is_mobile ? '2px 8px' : '4px 12px',
          borderRadius: 4,
        }}>
          Pass
        </div>
      </div>
    )
  }

  const table_size = is_short ? 'tiny' as const : is_mobile ? 'small' as const : 'normal' as const
  const table_cfg = CARD_CONFIG.table[table_size]
  const card_overlap = -(table_cfg.width - table_cfg.h_visible)

  // Sort cards by rank for display
  const sorted_cards = sort_played_cards(play.cards)

  return (
    <div style={get_position_style()}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        // No container border on mobile, only on desktop for leading
        padding: (!is_mobile && is_leading) ? 4 : 0,
        borderRadius: 6,
        border: (!is_mobile && is_leading) ? '2px solid #4caf50' : 'none',
        backgroundColor: (!is_mobile && is_leading) ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
      }}>
        {sorted_cards.map((card, idx) => (
          <motion.div
            key={card.Id}
            initial={{ opacity: 0, scale: 0.5, y: position === 'top' ? -20 : 0, x: position === 'left' ? -20 : position === 'right' ? 20 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            style={{ marginLeft: idx > 0 ? card_overlap : 0 }}
          >
            <Card
              card={card}
              level={level}
              selected={false}
              on_click={() => {}}
              size={table_size}
              context="table"
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

interface My_Played_Cards_Props {
  play?: Player_Play
  is_leading: boolean
  level: Rank
  is_mobile: boolean
}

function My_Played_Cards({ play, is_leading, level, is_mobile }: My_Played_Cards_Props) {
  const is_short = use_is_short()
  if (!play) return null

  const base_style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    bottom: is_mobile ? 48 : 70,
    left: '50%',
    transform: 'translateX(-50%)',
  }

  if (play.is_pass) {
    return (
      <div style={base_style}>
        <div style={{
          color: '#aaa',
          fontSize: is_mobile ? 11 : 16,
          fontStyle: 'italic',
          backgroundColor: 'rgba(0,0,0,0.4)',
          padding: is_mobile ? '2px 8px' : '4px 12px',
          borderRadius: 4,
        }}>
          Pass
        </div>
      </div>
    )
  }

  const table_size = is_short ? 'tiny' as const : is_mobile ? 'small' as const : 'normal' as const
  const table_cfg = CARD_CONFIG.table[table_size]
  const card_overlap = -(table_cfg.width - table_cfg.h_visible)

  // Sort cards by rank for display
  const sorted_cards = sort_played_cards(play.cards)

  return (
    <div style={base_style}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        padding: is_leading ? (is_mobile ? 2 : 4) : 0,
        borderRadius: 6,
        border: is_leading ? '2px solid #4caf50' : 'none',
        backgroundColor: is_leading ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
      }}>
        {sorted_cards.map((card, idx) => (
          <motion.div
            key={card.Id}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            style={{ marginLeft: idx > 0 ? card_overlap : 0 }}
          >
            <Card
              card={card}
              level={level}
              selected={false}
              on_click={() => {}}
              size={table_size}
              context="table"
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function get_relative_positions(my_seat: number) {
  return {
    top: (my_seat + 2) % 4,
    left: (my_seat + 1) % 4,
    right: (my_seat + 3) % 4,
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0f3460',
    overflow: 'hidden',
  },
  info_bar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 12px',
    backgroundColor: '#16213e',
    flexShrink: 0,
  },
  level_badge: {
    padding: '3px 8px',
    backgroundColor: '#ffc107',
    color: '#000',
    borderRadius: 6,
    fontWeight: 'bold',
    fontSize: 12,
  },
  team_scores: {
    color: '#fff',
    fontSize: 12,
  },
  game_area: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
    overflow: 'hidden',
  },
  my_area: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 2,
    borderTop: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  turn_indicator: {
    marginTop: 4,
    padding: '4px 10px',
    backgroundColor: '#ffc107',
    color: '#000',
    borderRadius: 6,
    fontWeight: 'bold',
    fontSize: 11,
  },
}

const mobile_styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    backgroundColor: '#0f3460',
    overflow: 'hidden',
    paddingTop: 'env(safe-area-inset-top)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  info_bar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 8px',
    backgroundColor: '#16213e',
    flexShrink: 0,
  },
  level_badge: {
    padding: '2px 6px',
    backgroundColor: '#ffc107',
    color: '#000',
    borderRadius: 6,
    fontWeight: 'bold',
    fontSize: 10,
  },
  team_scores: {
    color: '#fff',
    fontSize: 10,
  },
  game_area: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
    overflow: 'hidden',
  },
  my_area: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: 2,
    flexShrink: 0,
  },
  turn_indicator: {
    marginTop: 2,
    padding: '2px 6px',
    backgroundColor: '#28a745',
    color: '#fff',
    borderRadius: 4,
    fontWeight: 'bold',
    fontSize: 9,
  },
}

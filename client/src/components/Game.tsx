import { motion } from 'framer-motion'
import { Card as Card_Type, Rank, get_rank_symbol, Rank_Two, Rank_Black_Joker, Rank_Red_Joker } from '../game/types'
import { Hand } from './Hand'
import { Card } from './Card'
import { use_is_mobile } from '../hooks/use_is_mobile'

interface Player_Play {
  cards: Card_Type[]
  is_pass: boolean
}

// Sort cards by natural rank order (A, 2, 3, 4, ... K, A) for display
function sort_played_cards(cards: Card_Type[]): Card_Type[] {
  const natural_order = (rank: Rank): number => {
    // Jokers go last
    if (rank === Rank_Black_Joker) return 100
    if (rank === Rank_Red_Joker) return 101
    // Ace can be low (before 2) - use 1
    // For tubes/straights starting with A, we want A-2-3 order
    // Natural order: A=1, 2=2, 3=3, ..., K=13, A(high)=14
    // But for sorting display, we'll use: 2=0, 3=1, ..., A=12 with special handling
    // Actually simpler: just sort by rank value where 2=0, 3=1, ..., K=11, A=12
    if (rank === Rank_Two) return 0
    if (rank >= 1 && rank <= 11) return rank // 3-K maps to 1-11
    if (rank === 12) return 12 // Ace
    return rank
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
  is_tribute_mode?: boolean
  tribute_target_name?: string
  on_tribute?: () => void
  received_tribute_card?: Card_Type | null
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
  combo_type,
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
  received_tribute_card,
}: Game_Props) {
  const is_my_turn = current_turn === my_seat
  const relative_positions = get_relative_positions(my_seat)
  const is_mobile = use_is_mobile()

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

  return (
    <div style={is_mobile ? mobile_styles.container : styles.container}>
      {/* Info bar */}
      <div style={is_mobile ? mobile_styles.info_bar : styles.info_bar}>
        <div style={is_mobile ? mobile_styles.level_badge : styles.level_badge}>
          Lvl: {get_rank_symbol(level)}
        </div>
        <div style={is_mobile ? mobile_styles.team_scores : styles.team_scores}>
          <span style={{ color: '#64b5f6' }}>T1: {get_rank_symbol(team_levels[0] as Rank)}</span>
          <span style={{ marginLeft: is_mobile ? 8 : 12, color: '#f48fb1' }}>T2: {get_rank_symbol(team_levels[1] as Rank)}</span>
        </div>
      </div>

      {/* Game area - relative container with absolute positioned elements */}
      <div style={is_mobile ? mobile_styles.game_area : styles.game_area}>
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
          combo_type={leading_seat === relative_positions.top ? combo_type : ''}
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
          combo_type={leading_seat === relative_positions.left ? combo_type : ''}
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
          combo_type={leading_seat === relative_positions.right ? combo_type : ''}
          level={level}
          position="right"
          is_mobile={is_mobile}
        />

        {/* My played cards - at bottom center of game area */}
        <My_Played_Cards
          play={player_plays[my_seat]}
          is_leading={leading_seat === my_seat}
          combo_type={leading_seat === my_seat ? combo_type : ''}
          level={level}
          is_mobile={is_mobile}
        />
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

      {/* Tribute receipt notification */}
      {received_tribute_card && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'fixed',
            top: '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(76, 175, 80, 0.9)',
            color: '#fff',
            padding: is_mobile ? '8px 16px' : '12px 24px',
            borderRadius: 8,
            fontWeight: 'bold',
            fontSize: is_mobile ? 14 : 16,
            zIndex: 200,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            textAlign: 'center',
          }}>
          You received: {get_rank_symbol(received_tribute_card.Rank)}
        </motion.div>
      )}

      {/* My area at bottom */}
      <div style={is_mobile ? mobile_styles.my_area : styles.my_area}>
        <Hand
          cards={hand}
          level={level}
          selected_ids={selected_ids}
          on_card_click={is_tribute_mode ? tribute_card_click : on_card_click}
          on_toggle_selection={original_on_card_click}
          on_select_same_rank={is_tribute_mode ? tribute_select_same_rank : on_select_same_rank}
          on_clear_selection={on_clear_selection}
          on_play={is_tribute_mode ? on_tribute! : on_play}
          on_pass={on_pass}
          is_my_turn={!is_tribute_mode && is_my_turn}
          can_pass={can_pass}
          is_tribute_mode={is_tribute_mode}
        />

        {/* Turn indicator - desktop only (mobile shows in Hand button row) */}
        {!is_mobile && is_my_turn && hand.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={styles.turn_indicator}
          >
            Your turn!
          </motion.div>
        )}
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
    </div>
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
  combo_type: string
  level: Rank
  position: 'top' | 'left' | 'right'
  is_mobile: boolean
}

function Played_Cards({ play, is_leading, combo_type, level, position, is_mobile }: Played_Cards_Props) {
  if (!play) return null

  const get_position_style = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 5,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    }

    // Cards appear toward the center from the badge
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
        left: is_mobile ? 45 : 80,
        top: '40%',
        transform: 'translateY(-50%)',
      }
    }
    // right
    return {
      ...base,
      right: is_mobile ? 45 : 80,
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

  // Less overlap for played cards so all cards are visible
  const card_overlap = is_mobile ? -20 : -28

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
              size="small"
              label_position="left"
            />
          </motion.div>
        ))}
      </div>
      {is_leading && combo_type && (
        <div style={{
          marginLeft: is_mobile ? 4 : 8,
          padding: is_mobile ? '2px 4px' : '3px 8px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          fontSize: is_mobile ? 8 : 12,
          borderRadius: 4,
        }}>
          {combo_type}
        </div>
      )}
    </div>
  )
}

interface My_Played_Cards_Props {
  play?: Player_Play
  is_leading: boolean
  combo_type: string
  level: Rank
  is_mobile: boolean
}

function My_Played_Cards({ play, is_leading, combo_type, level, is_mobile }: My_Played_Cards_Props) {
  if (!play) return null

  const base_style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    bottom: is_mobile ? 8 : 16,
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

  // Less overlap for played cards so all cards are visible
  const card_overlap = is_mobile ? -20 : -28

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
              size="small"
              label_position="left"
            />
          </motion.div>
        ))}
      </div>
      {is_leading && combo_type && (
        <div style={{
          marginLeft: is_mobile ? 4 : 8,
          padding: is_mobile ? '2px 4px' : '3px 8px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: '#fff',
          fontSize: is_mobile ? 8 : 12,
          borderRadius: 4,
        }}>
          {combo_type}
        </div>
      )}
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 4,
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

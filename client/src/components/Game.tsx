import { motion } from 'framer-motion'
import { Card as Card_Type, Rank, get_rank_symbol } from '../game/types'
import { Hand } from './Hand'
import { Table } from './Table'
import { Card_Back } from './Card'
import { use_is_mobile } from '../hooks/use_is_mobile'

interface Game_Props {
  hand: Card_Type[]
  level: Rank
  selected_ids: Set<number>
  on_card_click: (id: number) => void
  on_select_same_rank: (rank: number) => void
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
}

export function Game({
  hand,
  level,
  selected_ids,
  on_card_click,
  on_select_same_rank,
  on_play,
  on_pass,
  table_cards,
  combo_type,
  current_turn,
  my_seat,
  can_pass,
  player_card_counts,
  team_levels,
  players_map,
  last_play_seat,
}: Game_Props) {
  const is_my_turn = current_turn === my_seat
  const relative_positions = get_relative_positions(my_seat)
  const is_mobile = use_is_mobile()

  if (is_mobile) {
    return (
      <div style={mobile_styles.container}>
        <div style={mobile_styles.info_bar}>
          <div style={mobile_styles.level_badge}>
            Lvl: {get_rank_symbol(level)}
          </div>
          <div style={mobile_styles.team_scores}>
            <span style={{ color: '#2196f3' }}>T1: {get_rank_symbol(team_levels[0] as Rank)}</span>
            <span style={{ marginLeft: 8, color: '#e91e63' }}>T2: {get_rank_symbol(team_levels[1] as Rank)}</span>
          </div>
        </div>

        <Mobile_Opponent_Bar
          positions={relative_positions}
          player_card_counts={player_card_counts}
          current_turn={current_turn}
          last_play_seat={last_play_seat}
          players_map={players_map}
        />

        <div style={mobile_styles.table_area}>
          <Table cards={table_cards} level={level} combo_type={combo_type} last_play_seat={last_play_seat} />
        </div>

        <div style={mobile_styles.my_area}>
          <Hand
            cards={hand}
            level={level}
            selected_ids={selected_ids}
            on_card_click={on_card_click}
            on_toggle_selection={on_card_click}
            on_select_same_rank={on_select_same_rank}
            on_play={on_play}
            on_pass={on_pass}
            is_my_turn={is_my_turn}
            can_pass={can_pass}
          />

          {is_my_turn && hand.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={mobile_styles.turn_indicator}
            >
              Your turn!
            </motion.div>
          )}
          {hand.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ ...mobile_styles.turn_indicator, backgroundColor: '#28a745' }}
            >
              You finished!
            </motion.div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.info_bar}>
        <div style={styles.level_badge}>
          Level: {get_rank_symbol(level)}
        </div>
        <div style={styles.team_scores}>
          <span style={{ color: '#2196f3' }}>Team 1: {get_rank_symbol(team_levels[0] as Rank)}</span>
          <span style={{ marginLeft: 16, color: '#e91e63' }}>Team 2: {get_rank_symbol(team_levels[1] as Rank)}</span>
        </div>
      </div>

      <div style={styles.main_layout}>
        <div style={styles.game_area}>
          <div style={styles.opponent_top}>
            <Opponent_Hand
              count={player_card_counts[relative_positions.top]}
              is_turn={current_turn === relative_positions.top}
              just_played={last_play_seat === relative_positions.top}
              seat={relative_positions.top}
              name={players_map[relative_positions.top]}
            />
          </div>

          <div style={styles.middle_row}>
            <div style={styles.opponent_side}>
              <Opponent_Hand
                count={player_card_counts[relative_positions.left]}
                is_turn={current_turn === relative_positions.left}
                just_played={last_play_seat === relative_positions.left}
                seat={relative_positions.left}
                name={players_map[relative_positions.left]}
              />
            </div>

            <div style={styles.table_area}>
              <Table cards={table_cards} level={level} combo_type={combo_type} last_play_seat={last_play_seat} />
            </div>

            <div style={styles.opponent_side}>
              <Opponent_Hand
                count={player_card_counts[relative_positions.right]}
                is_turn={current_turn === relative_positions.right}
                just_played={last_play_seat === relative_positions.right}
                seat={relative_positions.right}
                name={players_map[relative_positions.right]}
              />
            </div>
          </div>

          <div style={styles.my_area}>
            <Hand
              cards={hand}
              level={level}
              selected_ids={selected_ids}
              on_card_click={on_card_click}
              on_toggle_selection={on_card_click}
              on_select_same_rank={on_select_same_rank}
              on_play={on_play}
              on_pass={on_pass}
              is_my_turn={is_my_turn}
              can_pass={can_pass}
            />

          {is_my_turn && hand.length > 0 && (
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
              style={{ ...styles.turn_indicator, backgroundColor: '#28a745' }}
            >
              You finished!
            </motion.div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Mobile_Opponent_Bar_Props {
  positions: { top: number; left: number; right: number }
  player_card_counts: number[]
  current_turn: number
  last_play_seat: number | null
  players_map: Record<number, string>
}

function Mobile_Opponent_Bar({ positions, player_card_counts, current_turn, last_play_seat, players_map }: Mobile_Opponent_Bar_Props) {
  const opponents = [positions.left, positions.top, positions.right]

  return (
    <div style={mobile_styles.opponent_bar}>
      {opponents.map((seat) => {
        const is_turn = current_turn === seat
        const just_played = last_play_seat === seat

        return (
          <div
            key={seat}
            style={{
              ...mobile_styles.opponent_chip,
              backgroundColor: just_played ? 'rgba(76, 175, 80, 0.3)' : is_turn ? 'rgba(255,193,7,0.3)' : 'rgba(255,255,255,0.1)',
              borderColor: just_played ? '#4caf50' : is_turn ? '#ffc107' : 'transparent',
            }}
          >
            <span style={{ color: seat % 2 === 0 ? '#2196f3' : '#e91e63', fontWeight: 'bold', fontSize: 12 }}>
              {players_map[seat] || `P${seat + 1}`}
            </span>
            <span style={{ color: '#fff', fontSize: 11, marginLeft: 4 }}>
              ({player_card_counts[seat]})
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface Opponent_Hand_Props {
  count: number
  is_turn: boolean
  just_played?: boolean
  seat: number
  name?: string
}

function Opponent_Hand({ count, is_turn, just_played, seat, name }: Opponent_Hand_Props) {
  const get_highlight_style = () => {
    if (just_played) return { backgroundColor: 'rgba(76, 175, 80, 0.3)', border: '2px solid #4caf50' }
    if (is_turn) return { backgroundColor: 'rgba(255,193,7,0.2)', border: '2px solid #ffc107' }
    return { backgroundColor: 'transparent', border: '2px solid transparent' }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 8,
        borderRadius: 8,
        transition: 'all 0.2s ease',
        ...get_highlight_style(),
      }}
    >
      <div style={{ position: 'relative' }}>
        <Card_Back size="small" />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 16,
            padding: '4px 8px',
            borderRadius: 4,
            minWidth: 24,
            textAlign: 'center',
          }}
        >
          {count}
        </div>
      </div>
      <div style={{ color: '#fff', fontSize: 11 }}>
        {name || `P${seat + 1}`}
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
    padding: '8px 12px',
    backgroundColor: '#16213e',
    flexShrink: 0,
  },
  level_badge: {
    padding: '6px 12px',
    backgroundColor: '#ffc107',
    color: '#000',
    borderRadius: 8,
    fontWeight: 'bold',
    fontSize: 14,
  },
  team_scores: {
    color: '#fff',
    fontSize: 12,
  },
  game_area: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: 8,
    minHeight: 0,
  },
  opponent_top: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 8,
    flexShrink: 0,
  },
  middle_row: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    minHeight: 0,
  },
  opponent_side: {
    width: 80,
    display: 'flex',
    justifyContent: 'center',
    flexShrink: 0,
  },
  table_area: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    margin: '0 8px',
    minHeight: 120,
  },
  my_area: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
    borderTop: '2px solid #333',
    flexShrink: 0,
  },
  turn_indicator: {
    marginTop: 8,
    padding: '6px 12px',
    backgroundColor: '#ffc107',
    color: '#000',
    borderRadius: 8,
    fontWeight: 'bold',
    fontSize: 12,
  },
  main_layout: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
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
    padding: '6px 10px',
    backgroundColor: '#16213e',
    flexShrink: 0,
  },
  level_badge: {
    padding: '4px 8px',
    backgroundColor: '#ffc107',
    color: '#000',
    borderRadius: 6,
    fontWeight: 'bold',
    fontSize: 12,
  },
  team_scores: {
    color: '#fff',
    fontSize: 11,
  },
  opponent_bar: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 4px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  opponent_chip: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 16,
    border: '2px solid transparent',
  },
  table_area: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    margin: 8,
    minHeight: 100,
  },
  my_area: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    borderTop: '2px solid #333',
    flexShrink: 0,
  },
  turn_indicator: {
    marginTop: 6,
    padding: '4px 10px',
    backgroundColor: '#ffc107',
    color: '#000',
    borderRadius: 6,
    fontWeight: 'bold',
    fontSize: 11,
  },
}

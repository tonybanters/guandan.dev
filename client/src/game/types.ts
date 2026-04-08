export type Suit = 0 | 1 | 2 | 3 | 4

export const Suit_Hearts: Suit = 0
export const Suit_Diamonds: Suit = 1
export const Suit_Clubs: Suit = 2
export const Suit_Spades: Suit = 3
export const Suit_Joker: Suit = 4

export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export const Rank_Two: Rank = 0
export const Rank_Three: Rank = 1
export const Rank_Four: Rank = 2
export const Rank_Five: Rank = 3
export const Rank_Six: Rank = 4
export const Rank_Seven: Rank = 5
export const Rank_Eight: Rank = 6
export const Rank_Nine: Rank = 7
export const Rank_Ten: Rank = 8
export const Rank_Jack: Rank = 9
export const Rank_Queen: Rank = 10
export const Rank_King: Rank = 11
export const Rank_Ace: Rank = 12
export const Rank_Black_Joker: Rank = 13
export const Rank_Red_Joker: Rank = 14

export interface Card {
  Suit: Suit
  Rank: Rank
  Id: number
}

export interface Player_Info {
  id: string
  name: string
  seat: number
  team: number
  is_ready: boolean
}

export interface Room_State {
  room_id: string
  players: Player_Info[]
  game_active: boolean
}

export interface Game_State {
  hand: Card[]
  level: Rank
  current_turn: number
  my_seat: number
  can_pass: boolean
  table_cards: Card[]
  player_card_counts: number[]
  finish_order: string[]
  team_levels: [number, number]
}

export type Msg_Type =
  | 'join_room'
  | 'create_room'
  | 'room_state'
  | 'game_start'
  | 'deal_cards'
  | 'play_cards'
  | 'pass'
  | 'turn'
  | 'play_made'
  | 'hand_end'
  | 'tribute'
  | 'tribute_give'
  | 'tribute_recv'
  | 'tribute_return'
  | 'tribute_return_give'
  | 'game_end'
  | 'error'
  | 'player_joined'
  | 'player_left'
  | 'fill_bots'

export interface Message<T = unknown> {
  type: Msg_Type
  payload: T
}

export function get_suit_symbol(suit: Suit): string {
  const symbols = ['♥', '♦', '♣', '♠', '']
  return symbols[suit]
}

export function get_rank_symbol(rank: Rank): string {
  const symbols = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '🃏', '🃏']
  return symbols[rank]
}

export function is_red_suit(suit: Suit): boolean {
  return suit === Suit_Hearts || suit === Suit_Diamonds
}

export function is_wild(card: Card, level: Rank): boolean {
  return card.Suit === Suit_Hearts && card.Rank === level
}

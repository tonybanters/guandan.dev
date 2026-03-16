import { Card, Rank, is_wild } from './types'

export interface Card_Group {
  type: 'bomb' | 'straight_flush' | 'triple' | 'pair' | 'wild' | 'single'
  cards: Card[]
}

// Group cards for visual display - finds bombs, straights, pairs, etc.
export function group_cards_for_display(cards: Card[], level: Rank): Card_Group[] {
  const groups: Card_Group[] = []
  const used = new Set<number>()

  // First extract wild cards (heart level cards)
  const wilds = cards.filter(c => is_wild(c, level))
  wilds.forEach(c => {
    used.add(c.Id)
    groups.push({ type: 'wild', cards: [c] })
  })

  const remaining = cards.filter(c => !used.has(c.Id))

  // Group by rank
  const by_rank = new Map<number, Card[]>()
  remaining.forEach(c => {
    const arr = by_rank.get(c.Rank) || []
    arr.push(c)
    by_rank.set(c.Rank, arr)
  })

  // Find bombs (4+ of same rank, or joker bomb)
  const jokers = remaining.filter(c => c.Rank === 13 || c.Rank === 14)
  if (jokers.length === 4) {
    jokers.forEach(c => used.add(c.Id))
    groups.push({ type: 'bomb', cards: jokers })
  }

  by_rank.forEach((rank_cards) => {
    const unused = rank_cards.filter(c => !used.has(c.Id))
    if (unused.length >= 4) {
      unused.forEach(c => used.add(c.Id))
      groups.push({ type: 'bomb', cards: unused })
    }
  })

  // Find straight flushes (5+ consecutive same suit)
  const by_suit = new Map<number, Card[]>()
  remaining.filter(c => !used.has(c.Id) && c.Rank < 13).forEach(c => {
    const arr = by_suit.get(c.Suit) || []
    arr.push(c)
    by_suit.set(c.Suit, arr)
  })

  by_suit.forEach((suit_cards) => {
    const sorted = [...suit_cards].sort((a, b) => a.Rank - b.Rank)
    let run: Card[] = []

    for (const card of sorted) {
      if (used.has(card.Id)) continue
      if (run.length === 0 || card.Rank === run[run.length - 1].Rank + 1) {
        run.push(card)
      } else {
        if (run.length >= 5) {
          run.forEach(c => used.add(c.Id))
          groups.push({ type: 'straight_flush', cards: run })
        }
        run = [card]
      }
    }
    if (run.length >= 5) {
      run.forEach(c => used.add(c.Id))
      groups.push({ type: 'straight_flush', cards: run })
    }
  })

  // Find triples
  by_rank.forEach((rank_cards) => {
    const unused = rank_cards.filter(c => !used.has(c.Id))
    if (unused.length === 3) {
      unused.forEach(c => used.add(c.Id))
      groups.push({ type: 'triple', cards: unused })
    }
  })

  // Find pairs
  by_rank.forEach((rank_cards) => {
    const unused = rank_cards.filter(c => !used.has(c.Id))
    if (unused.length === 2) {
      unused.forEach(c => used.add(c.Id))
      groups.push({ type: 'pair', cards: unused })
    }
  })

  // Remaining singles
  remaining.filter(c => !used.has(c.Id)).forEach(c => {
    groups.push({ type: 'single', cards: [c] })
  })

  return groups
}

// Find all cards with same rank as the given card
export function find_same_rank(cards: Card[], rank: number): Card[] {
  return cards.filter(c => c.Rank === rank)
}

// Combo types for play validation
export type Combo_Type =
  | 'single'
  | 'pair'
  | 'triple'
  | 'full_house'
  | 'straight'
  | 'tube' // consecutive pairs
  | 'plate' // consecutive triples
  | 'bomb_4'
  | 'bomb_5'
  | 'bomb_6'
  | 'bomb_7'
  | 'bomb_8'
  | 'straight_flush'
  | 'joker_bomb'

interface Detected_Combo {
  type: Combo_Type
  cards: Card[]
  value: number // for comparison
}

// Detect what combo a set of cards forms
export function detect_combo(cards: Card[], level: Rank): Detected_Combo | null {
  if (cards.length === 0) return null

  const sorted = [...cards].sort((a, b) => a.Rank - b.Rank)
  const n = sorted.length

  // Check joker bomb (4 jokers)
  if (n === 4 && sorted.every(c => c.Rank === 13 || c.Rank === 14)) {
    return { type: 'joker_bomb', cards, value: 1000 }
  }

  // Group by rank
  const by_rank = new Map<number, Card[]>()
  sorted.forEach(c => {
    const arr = by_rank.get(c.Rank) || []
    arr.push(c)
    by_rank.set(c.Rank, arr)
  })

  // Single
  if (n === 1) {
    return { type: 'single', cards, value: get_card_value(sorted[0], level) }
  }

  // Pair
  if (n === 2 && by_rank.size === 1) {
    return { type: 'pair', cards, value: get_card_value(sorted[0], level) }
  }

  // Triple
  if (n === 3 && by_rank.size === 1) {
    return { type: 'triple', cards, value: get_card_value(sorted[0], level) }
  }

  // Bombs (4-8 of same rank)
  if (by_rank.size === 1 && n >= 4 && n <= 8) {
    const bomb_types: Record<number, Combo_Type> = {
      4: 'bomb_4', 5: 'bomb_5', 6: 'bomb_6', 7: 'bomb_7', 8: 'bomb_8'
    }
    return { type: bomb_types[n], cards, value: get_card_value(sorted[0], level) + n * 100 }
  }

  // Full house (3+2)
  if (n === 5) {
    const counts = Array.from(by_rank.values()).map(arr => arr.length).sort()
    if (counts.length === 2 && counts[0] === 2 && counts[1] === 3) {
      const triple_rank = Array.from(by_rank.entries()).find(([_, arr]) => arr.length === 3)![0]
      return { type: 'full_house', cards, value: get_rank_value(triple_rank, level) }
    }
  }

  // Straight (5+ consecutive)
  if (n >= 5 && by_rank.size === n) {
    const ranks = sorted.map(c => c.Rank)
    if (is_consecutive(ranks)) {
      // Check if straight flush
      if (sorted.every(c => c.Suit === sorted[0].Suit)) {
        return { type: 'straight_flush', cards, value: get_card_value(sorted[n-1], level) + 500 + n * 10 }
      }
      return { type: 'straight', cards, value: get_card_value(sorted[n-1], level) }
    }
  }

  // Tube (consecutive pairs)
  if (n >= 4 && n % 2 === 0) {
    const pairs = Array.from(by_rank.entries())
    if (pairs.every(([_, arr]) => arr.length === 2)) {
      const ranks = pairs.map(([r, _]) => r).sort((a, b) => a - b)
      if (is_consecutive(ranks)) {
        return { type: 'tube', cards, value: get_rank_value(ranks[ranks.length - 1], level) }
      }
    }
  }

  // Plate (consecutive triples)
  if (n >= 6 && n % 3 === 0) {
    const triples = Array.from(by_rank.entries())
    if (triples.every(([_, arr]) => arr.length === 3)) {
      const ranks = triples.map(([r, _]) => r).sort((a, b) => a - b)
      if (is_consecutive(ranks)) {
        return { type: 'plate', cards, value: get_rank_value(ranks[ranks.length - 1], level) }
      }
    }
  }

  return null
}

function is_consecutive(ranks: number[]): boolean {
  const sorted = [...ranks].sort((a, b) => a - b)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false
  }
  // Can't include 2 (rank 0) in straights
  if (sorted.includes(0)) return false
  return true
}

function get_card_value(card: Card, level: Rank): number {
  return get_rank_value(card.Rank, level)
}

function get_rank_value(rank: number, level: Rank): number {
  if (rank === 14) return 100 // red joker
  if (rank === 13) return 99  // black joker
  if (rank === level) return 98 // level card
  // 2 is highest non-special
  if (rank === 0) return 15
  // A is second highest
  if (rank === 12) return 14
  // rest are 3-K (ranks 1-11)
  return rank + 2
}

// Find valid plays that can beat the current table
export function find_valid_plays(
  hand: Card[],
  table_combo: Detected_Combo | null,
  level: Rank
): Card[][] {
  const suggestions: Card[][] = []

  if (!table_combo) {
    // Can play anything - suggest singles, pairs, triples
    const by_rank = new Map<number, Card[]>()
    hand.forEach(c => {
      const arr = by_rank.get(c.Rank) || []
      arr.push(c)
      by_rank.set(c.Rank, arr)
    })

    // Suggest lowest single
    const sorted = [...hand].sort((a, b) => get_card_value(a, level) - get_card_value(b, level))
    if (sorted.length > 0) {
      suggestions.push([sorted[0]])
    }

    // Suggest lowest pair
    for (const [_, cards] of by_rank) {
      if (cards.length >= 2) {
        suggestions.push(cards.slice(0, 2))
        break
      }
    }

    return suggestions.slice(0, 3)
  }

  // Need to beat the table combo
  const by_rank = new Map<number, Card[]>()
  hand.forEach(c => {
    const arr = by_rank.get(c.Rank) || []
    arr.push(c)
    by_rank.set(c.Rank, arr)
  })

  switch (table_combo.type) {
    case 'single': {
      const candidates = hand.filter(c => get_card_value(c, level) > table_combo.value)
        .sort((a, b) => get_card_value(a, level) - get_card_value(b, level))
      if (candidates.length > 0) {
        suggestions.push([candidates[0]])
      }
      break
    }
    case 'pair': {
      for (const [rank, cards] of by_rank) {
        if (cards.length >= 2 && get_rank_value(rank, level) > table_combo.value) {
          suggestions.push(cards.slice(0, 2))
          if (suggestions.length >= 2) break
        }
      }
      break
    }
    case 'triple': {
      for (const [rank, cards] of by_rank) {
        if (cards.length >= 3 && get_rank_value(rank, level) > table_combo.value) {
          suggestions.push(cards.slice(0, 3))
          if (suggestions.length >= 2) break
        }
      }
      break
    }
    default:
      // For complex combos, just return empty for now
      break
  }

  // Always suggest bombs as alternatives
  for (const [_, cards] of by_rank) {
    if (cards.length >= 4) {
      suggestions.push(cards)
    }
  }

  // Joker bomb
  const jokers = hand.filter(c => c.Rank === 13 || c.Rank === 14)
  if (jokers.length === 4) {
    suggestions.push(jokers)
  }

  return suggestions.slice(0, 3)
}

// Quick select helpers
export function select_pair(hand: Card[], level: Rank): Card[] | null {
  const by_rank = new Map<number, Card[]>()
  hand.forEach(c => {
    const arr = by_rank.get(c.Rank) || []
    arr.push(c)
    by_rank.set(c.Rank, arr)
  })

  // Find lowest pair
  const sorted_ranks = Array.from(by_rank.keys())
    .sort((a, b) => get_rank_value(a, level) - get_rank_value(b, level))

  for (const rank of sorted_ranks) {
    const cards = by_rank.get(rank)!
    if (cards.length >= 2) {
      return cards.slice(0, 2)
    }
  }
  return null
}

export function select_triple(hand: Card[], level: Rank): Card[] | null {
  const by_rank = new Map<number, Card[]>()
  hand.forEach(c => {
    const arr = by_rank.get(c.Rank) || []
    arr.push(c)
    by_rank.set(c.Rank, arr)
  })

  const sorted_ranks = Array.from(by_rank.keys())
    .sort((a, b) => get_rank_value(a, level) - get_rank_value(b, level))

  for (const rank of sorted_ranks) {
    const cards = by_rank.get(rank)!
    if (cards.length >= 3) {
      return cards.slice(0, 3)
    }
  }
  return null
}

export function select_bomb(hand: Card[], level: Rank): Card[] | null {
  const by_rank = new Map<number, Card[]>()
  hand.forEach(c => {
    const arr = by_rank.get(c.Rank) || []
    arr.push(c)
    by_rank.set(c.Rank, arr)
  })

  // Joker bomb first
  const jokers = hand.filter(c => c.Rank === 13 || c.Rank === 14)
  if (jokers.length === 4) {
    return jokers
  }

  const sorted_ranks = Array.from(by_rank.keys())
    .sort((a, b) => get_rank_value(a, level) - get_rank_value(b, level))

  for (const rank of sorted_ranks) {
    const cards = by_rank.get(rank)!
    if (cards.length >= 4) {
      return cards
    }
  }
  return null
}

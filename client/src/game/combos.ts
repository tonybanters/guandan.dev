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

  // Straight (5+ consecutive, possibly with 2♥ as wild)
  if (n >= 5) {
    // Check normal consecutive (no wilds)
    if (by_rank.size === n) {
      const ranks = sorted.map(c => c.Rank)
      const high = consecutive_high_rank(ranks)
      if (high !== null) {
        // Check if straight flush
        if (sorted.every(c => c.Suit === sorted[0].Suit)) {
          return { type: 'straight_flush', cards, value: get_rank_value(high, level) + 500 + n * 10 }
        }
        return { type: 'straight', cards, value: get_rank_value(high, level) }
      }
    }

    // Check with level♥ as wild card (level♥ can fill one or more gaps)
    const wilds = sorted.filter(c => c.Rank === level && c.Suit === 0) // Suit_Hearts=0
    const non_wild = sorted.filter(c => !(c.Rank === level && c.Suit === 0))

    if (wilds.length > 0 && non_wild.length > 0) {
      const ranks = non_wild.map(c => c.Rank)
      const unique_ranks = new Set<number>(ranks)

      // Check if non-wild cards + wilds can form a straight
      // Need n consecutive ranks, can use wilds to fill gaps
      // Start at -1 to handle A-low wrapping (A-2-3-4-5)
      for (let start = -1; start <= 12 - n + 1; start++) {
        let gaps = 0
        for (let i = 0; i < n; i++) {
          const rank = start + i === -1 ? 12 : start + i
          if (!unique_ranks.has(rank)) {
            gaps++
          }
        }
        if (gaps <= wilds.length && gaps + unique_ranks.size === n) {
          const high_rank = start + n - 1
          const flush_suit = non_wild[0].Suit
          if (non_wild.every(c => c.Suit === flush_suit)) {
            return { type: 'straight_flush', cards, value: get_rank_value(high_rank, level) + 500 + n * 10 }
          }
          return { type: 'straight', cards, value: get_rank_value(high_rank, level) }
        }
      }
    }
  }

  // Tube (consecutive pairs)
  if (n >= 4 && n % 2 === 0) {
    const pairs = Array.from(by_rank.entries())
    if (pairs.every(([_, arr]) => arr.length === 2)) {
      const ranks = pairs.map(([r, _]) => r)
      const high = consecutive_high_rank(ranks)
      if (high !== null) {
        return { type: 'tube', cards, value: get_rank_value(high, level) }
      }
    }
  }

  // Plate (consecutive triples)
  if (n >= 6 && n % 3 === 0) {
    const triples = Array.from(by_rank.entries())
    if (triples.every(([_, arr]) => arr.length === 3)) {
      const ranks = triples.map(([r, _]) => r)
      const high = consecutive_high_rank(ranks)
      if (high !== null) {
        return { type: 'plate', cards, value: get_rank_value(high, level) }
      }
    }
  }

  return null
}

// Returns the effective high rank of a consecutive sequence, or null if not consecutive.
// Handles A-low wrapping (e.g., A-2-3-4-5 returns rank 3, i.e. 5).
function consecutive_high_rank(ranks: number[]): number | null {
  const sorted = [...ranks].sort((a, b) => a - b)

  const is_run = (arr: number[]) => {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] !== arr[i - 1] + 1) return false
    }
    return true
  }

  if (is_run(sorted)) return sorted[sorted.length - 1]

  // A-low wrapping: treat A (rank 12) as -1
  if (sorted.includes(12)) {
    const wrapped = sorted.map(r => r === 12 ? -1 : r).sort((a, b) => a - b)
    if (is_run(wrapped)) return wrapped[wrapped.length - 1]
  }

  return null
}

function get_card_value(card: Card, level: Rank): number {
  return get_rank_value(card.Rank, level)
}

export function get_rank_value(rank: number, level: Rank): number {
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

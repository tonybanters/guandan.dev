import SwiftUI
import UIKit
import GuandanCore

private struct Hand_Column: Identifiable {
    let id: String
    let cards: [Card]
    // non-nil for user-built piles; used to dissolve them on double tap
    let custom_id: Int?
}

struct Hand_View: View {
    @Environment(Game_Store.self) private var store
    @Environment(\.horizontalSizeClass) private var h_size_class

    @State private var hit_rects: [Int: CGRect] = [:]
    @State private var swiped: Set<Int> = []
    @State private var last_point: CGPoint?
    @State private var last_tap: (id: Int, time: Date)?
    @State private var custom_columns: [(id: Int, card_ids: [Int])] = []
    @State private var next_col_id = 1
    @State private var hand_width: CGFloat = 0

    // one manual gesture handles tap / swipe-select / long-press so the
    // three can never race each other the way composed gestures do
    @State private var touch_start: (point: CGPoint, time: Date)?
    @State private var swiping = false
    @State private var long_press_fired = false
    @State private var long_press_task: Task<Void, Never>?

    private let haptic = UIImpactFeedbackGenerator(style: .light)

    private var card_size: Card_Size { h_size_class == .regular ? .normal : .small }
    private var cfg: Card_Config { card_config(.hand, card_size) }

    private var columns: [Hand_Column] {
        let valid_ids = Set(store.hand.map { $0.id })
        let card_by_id = Dictionary(uniqueKeysWithValues: store.hand.map { ($0.id, $0) })

        var custom_cols: [Hand_Column] = []
        var in_custom: Set<Int> = []
        for col in custom_columns {
            let ids = col.card_ids.filter { valid_ids.contains($0) }
            guard !ids.isEmpty else { continue }
            in_custom.formUnion(ids)
            custom_cols.append(Hand_Column(id: "custom-\(col.id)", cards: ids.compactMap { card_by_id[$0] }, custom_id: col.id))
        }

        let by_rank = Dictionary(grouping: store.hand.filter { !in_custom.contains($0.id) }) { $0.rank }
        let order: (Rank) -> Int = { rank in
            if rank == Rank_Red_Joker { return 1000 }
            if rank == Rank_Black_Joker { return 999 }
            if rank == store.level { return 998 }
            return rank
        }
        let rank_cols = by_rank.keys.sorted { order($0) > order($1) }.map {
            Hand_Column(id: "rank-\($0)", cards: by_rank[$0]!, custom_id: nil)
        }
        return rank_cols + custom_cols
    }

    private var is_valid_pile: Bool {
        guard !store.selected_ids.isEmpty else { return false }
        let selected = store.hand.filter { store.selected_ids.contains($0.id) }
        guard selected.count == store.selected_ids.count else { return false }
        return detect_combo(selected, level: store.level) != nil
    }

    var body: some View {
        // no scroll view: the overlap compresses so the hand always fits the
        // width, leaving a one-finger drag unambiguous — it only selects
        let cols = columns
        let visible = column_visible_width(cols.count)
        let max_stack = cols.map { $0.cards.count }.max() ?? 1
        HStack(alignment: .bottom, spacing: -(cfg.width - visible)) {
            ForEach(Array(cols.enumerated()), id: \.element.id) { col_idx, col in
                column_view(col, is_last: col_idx == cols.count - 1, visible: visible)
            }
        }
        .padding(.top, 4)
        .frame(maxWidth: .infinity)
        .frame(height: cfg.height + CGFloat(max_stack - 1) * cfg.v_overlap + 4, alignment: .bottom)
        .onGeometryChange(for: CGFloat.self) { proxy in
            proxy.size.width
        } action: { width in
            hand_width = width
        }
        .contentShape(Rectangle())
        .coordinateSpace(name: "hand")
        .gesture(hand_gesture)
        .onChange(of: store.hand.map(\.id)) { old_ids, new_ids in
            // a fresh deal invalidates any custom arrangement
            if new_ids.count > old_ids.count && old_ids.count > 0 {
                custom_columns = []
            }
            // drop hit rects of departed cards, or their ghosts swallow
            // taps meant for the cards now occupying that spot
            let live = Set(new_ids)
            hit_rects = hit_rects.filter { live.contains($0.key) }
        }
        .overlay(alignment: .bottomTrailing) {
            if store.tribute_mode == nil {
                pile_buttons
            }
        }
    }

    // columns sit fully side by side (small gap) when everything fits, like
    // the reference app, overlapping only as far as needed so the hand
    // never scrolls
    private func column_visible_width(_ count: Int) -> CGFloat {
        guard count > 1, hand_width > 0 else { return cfg.width + 3 }
        let available = hand_width - 16 - cfg.width
        return min(cfg.width + 3, max(14, available / CGFloat(count - 1)))
    }

    private func column_view(_ col: Hand_Column, is_last: Bool, visible: CGFloat) -> some View {
        // painted back to front (last group card first), so the first card
        // ends up in front at the column's bottom; zIndex is unreliable here
        // because later modifiers stop the trait reaching the ZStack
        ZStack(alignment: .bottom) {
            ForEach(Array(col.cards.enumerated()).reversed(), id: \.element.id) { idx, card in
                Card_View(
                    card: card,
                    level: store.level,
                    selected: store.selected_ids.contains(card.id),
                    glowing: store.received_tribute_id == card.id,
                    size: card_size,
                    context: .hand
                )
                .offset(y: -CGFloat(idx) * cfg.v_overlap)
                .onGeometryChange(for: CGRect.self) { proxy in
                    // computed inside the transform so a change of stack
                    // position alone (same frame) still refreshes the rect
                    visible_rect(proxy.frame(in: .named("hand")), stack_idx: idx, is_last_column: is_last, visible: visible)
                } action: { rect in
                    hit_rects[card.id] = rect
                }
            }
        }
        .frame(
            width: cfg.width,
            height: cfg.height + CGFloat(max(col.cards.count - 1, 0)) * cfg.v_overlap,
            alignment: .bottom
        )
    }

    // long press anywhere on a stack selects the whole stack (or clears it
    // if it was already fully selected)
    private func select_column(_ col: Hand_Column) {
        guard store.tribute_mode == nil else { return }
        let ids = col.cards.map { $0.id }
        if ids.allSatisfy({ store.selected_ids.contains($0) }) {
            for id in ids { store.selected_ids.remove(id) }
        } else {
            for id in ids { store.selected_ids.insert(id) }
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    private var pile_buttons: some View {
        let valid = is_valid_pile
        return HStack(spacing: 6) {
            Button {
                create_pile()
            } label: {
                Text("pile")
                    .font(.system(size: 12, weight: .bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(valid ? Color(red: 0.61, green: 0.15, blue: 0.69) : Color(white: 0.27).opacity(0.5), in: RoundedRectangle(cornerRadius: 4))
                    .foregroundStyle(valid ? .white : .white.opacity(0.4))
            }
            .disabled(!valid)

            Button {
                custom_columns = []
            } label: {
                Text("reset")
                    .font(.system(size: 12, weight: .bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(custom_columns.isEmpty ? Color(white: 0.27).opacity(0.5) : Color(red: 0.38, green: 0.49, blue: 0.55), in: RoundedRectangle(cornerRadius: 4))
                    .foregroundStyle(custom_columns.isEmpty ? .white.opacity(0.4) : .white)
            }
            .disabled(custom_columns.isEmpty)
        }
        .padding(4)
        .background(Color.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 8))
        .padding(.trailing, 4)
        .padding(.bottom, 4)
    }

    // single tap toggles; a second tap within 300ms selects the whole rank,
    // or dissolves the pile when the card lives in a custom column
    private func handle_tap(_ card: Card, custom_id: Int?) {
        if store.tribute_mode != nil {
            if store.selected_ids.contains(card.id) {
                store.toggle_selection(card.id)
            } else {
                store.clear_selection()
                store.toggle_selection(card.id)
            }
            return
        }

        let now = Date()
        if let last = last_tap, last.id == card.id, now.timeIntervalSince(last.time) < 0.3 {
            if let custom_id {
                custom_columns.removeAll { $0.id == custom_id }
            } else {
                store.select_same_rank(card.rank)
            }
            last_tap = nil
        } else {
            store.toggle_selection(card.id)
            last_tap = (card.id, now)
        }
    }

    private func create_pile() {
        guard is_valid_pile else { return }
        let selected = store.hand.filter { store.selected_ids.contains($0.id) }
        // detect_combo orders the cards canonically (runs low to high)
        let ordered = detect_combo(selected, level: store.level)?.cards ?? selected
        custom_columns = custom_columns.compactMap { col in
            let remaining = col.card_ids.filter { !store.selected_ids.contains($0) }
            return remaining.isEmpty ? nil : (id: col.id, card_ids: remaining)
        }
        custom_columns.append((id: next_col_id, card_ids: ordered.map { $0.id }))
        next_col_id += 1
        store.clear_selection()
    }

    /*
     * cards overlap both within a column and across columns, so swipe
     * select hit-tests only the strip of each card actually visible:
     * the top v_overlap of stacked cards and the left h_visible of
     * covered columns. keeping the rects disjoint avoids resolving a
     * touch to a neighbor hidden underneath.
     */
    private func visible_rect(_ frame: CGRect, stack_idx: Int, is_last_column: Bool, visible: CGFloat) -> CGRect {
        // .offset is a draw-time translation that layout never sees, so the
        // reported frame is the un-offset one; shift it to where the card is
        // actually drawn or every strip in a stack lands on the same rect
        var rect = frame.offsetBy(dx: 0, dy: -CGFloat(stack_idx) * cfg.v_overlap)
        if stack_idx > 0 {
            rect.size.height = cfg.v_overlap
        }
        if !is_last_column && visible < cfg.width {
            rect.size.width = visible
        }
        return rect
    }

    /*
     * touch down arms a long-press timer; moving 8pt cancels it and turns
     * the touch into a swipe that paint-toggles every card it crosses; a
     * quick release is a tap — on a card it toggles (double tap selects the
     * rank / dissolves a pile), on dead space it clears the selection.
     */
    private var hand_gesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("hand"))
            .onChanged { value in
                if touch_start == nil {
                    touch_start = (value.location, Date())
                    swiping = false
                    long_press_fired = false
                    swiped.removeAll()
                    last_point = value.location
                    arm_long_press(at: value.location)
                }
                guard !long_press_fired else { return }
                guard let start = touch_start else { return }

                if !swiping {
                    let moved = hypot(value.location.x - start.point.x, value.location.y - start.point.y)
                    guard moved > 8 else { return }
                    swiping = true
                    long_press_task?.cancel()
                    toggle_at(start.point)
                }

                let prev = last_point ?? start.point
                let point = value.location
                let dist = hypot(point.x - prev.x, point.y - prev.y)
                let steps = max(1, Int(ceil(dist / 8)))
                for i in 1...steps {
                    let t = CGFloat(i) / CGFloat(steps)
                    toggle_at(CGPoint(x: prev.x + (point.x - prev.x) * t, y: prev.y + (point.y - prev.y) * t))
                }
                last_point = point
            }
            .onEnded { _ in
                long_press_task?.cancel()
                if let start = touch_start, !swiping, !long_press_fired {
                    tap_at(start.point)
                }
                touch_start = nil
                swiping = false
                long_press_fired = false
                swiped.removeAll()
                last_point = nil
            }
    }

    private func arm_long_press(at point: CGPoint) {
        long_press_task?.cancel()
        long_press_task = Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled, touch_start != nil, !swiping, !long_press_fired else { return }
            guard let (_, col) = card_at(point) else { return }
            long_press_fired = true
            select_column(col)
        }
    }

    private func tap_at(_ point: CGPoint) {
        if let (card, col) = card_at(point) {
            handle_tap(card, custom_id: col.custom_id)
        } else {
            store.clear_selection()
        }
    }

    // resolve a point to a live card only — a lingering rect must never
    // shadow the card actually under the finger
    private func live_card_id(at point: CGPoint) -> Int? {
        let live = Set(store.hand.map { $0.id })
        return hit_rects.first(where: { live.contains($0.key) && $0.value.contains(point) })?.key
    }

    private func card_at(_ point: CGPoint) -> (Card, Hand_Column)? {
        guard let id = live_card_id(at: point),
              let col = columns.first(where: { c in c.cards.contains { $0.id == id } }),
              let card = col.cards.first(where: { $0.id == id })
        else { return nil }
        return (card, col)
    }

    private func toggle_at(_ point: CGPoint) {
        guard let id = live_card_id(at: point),
              !swiped.contains(id)
        else { return }
        swiped.insert(id)
        store.toggle_selection(id)
        haptic.impactOccurred()
    }
}

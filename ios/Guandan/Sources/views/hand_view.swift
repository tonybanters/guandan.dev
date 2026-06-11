import SwiftUI
import UIKit
import GuandanCore

struct Hand_View: View {
    @Environment(Game_Store.self) private var store

    @State private var hit_rects: [Int: CGRect] = [:]
    @State private var swiped: Set<Int> = []
    @State private var last_point: CGPoint?

    private let card_width: CGFloat = 66
    private let card_height: CGFloat = 84
    private let v_overlap: CGFloat = 24
    private let h_visible: CGFloat = 44
    private let haptic = UIImpactFeedbackGenerator(style: .light)

    private var columns: [[Card]] {
        let by_rank = Dictionary(grouping: store.hand) { $0.rank }
        let order: (Rank) -> Int = { rank in
            if rank == Rank_Red_Joker { return 1000 }
            if rank == Rank_Black_Joker { return 999 }
            if rank == store.level { return 998 }
            return rank
        }
        return by_rank.keys.sorted { order($0) > order($1) }.map { by_rank[$0]! }
    }

    var body: some View {
        let cols = columns
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .bottom, spacing: -(card_width - h_visible)) {
                ForEach(Array(cols.enumerated()), id: \.offset) { col_idx, col in
                    column_view(col, is_last: col_idx == cols.count - 1)
                        .zIndex(Double(col_idx))
                }
            }
            .padding(.horizontal, 8)
            .padding(.top, 4)
        }
        .coordinateSpace(name: "hand")
        .simultaneousGesture(swipe_gesture)
    }

    private func column_view(_ cards: [Card], is_last: Bool) -> some View {
        ZStack(alignment: .bottom) {
            ForEach(Array(cards.enumerated()), id: \.element.id) { idx, card in
                Card_View(
                    card: card,
                    level: store.level,
                    selected: store.selected_ids.contains(card.id),
                    width: card_width
                )
                .offset(y: -CGFloat(idx) * v_overlap)
                .zIndex(Double(cards.count - idx))
                .onTapGesture {
                    store.toggle_selection(card.id)
                }
                .onGeometryChange(for: CGRect.self) { proxy in
                    proxy.frame(in: .named("hand"))
                } action: { frame in
                    hit_rects[card.id] = visible_rect(frame, stack_idx: idx, is_last_column: is_last)
                }
            }
        }
        .frame(
            width: card_width,
            height: card_height + CGFloat(max(cards.count - 1, 0)) * v_overlap,
            alignment: .bottom
        )
    }

    /*
     * cards overlap both within a column and across columns, so swipe
     * select hit-tests only the strip of each card actually visible:
     * the top v_overlap of stacked cards and the left h_visible of
     * covered columns. keeping the rects disjoint avoids resolving a
     * touch to a neighbor hidden underneath.
     */
    private func visible_rect(_ frame: CGRect, stack_idx: Int, is_last_column: Bool) -> CGRect {
        var rect = frame
        if stack_idx > 0 {
            rect.size.height = v_overlap
        }
        if !is_last_column {
            rect.size.width = h_visible
        }
        return rect
    }

    private var swipe_gesture: some Gesture {
        DragGesture(minimumDistance: 5, coordinateSpace: .named("hand"))
            .onChanged { value in
                if last_point == nil {
                    swiped.removeAll()
                    toggle_at(value.startLocation)
                }
                let prev = last_point ?? value.startLocation
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
                last_point = nil
                swiped.removeAll()
            }
    }

    private func toggle_at(_ point: CGPoint) {
        guard let id = hit_rects.first(where: { $0.value.contains(point) })?.key,
              !swiped.contains(id)
        else { return }
        swiped.insert(id)
        store.toggle_selection(id)
        haptic.impactOccurred()
    }
}

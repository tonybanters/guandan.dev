import SwiftUI
import GuandanCore

struct Game_View: View {
    @Environment(Game_Store.self) private var store
    @Environment(\.horizontalSizeClass) private var h_size_class
    @Environment(\.verticalSizeClass) private var v_size_class
    let socket: Game_Socket

    @State private var show_leave_confirm = false

    private var partner_seat: Int { (store.my_seat + 2) % 4 }
    private var left_seat: Int { (store.my_seat + 1) % 4 }
    private var right_seat: Int { (store.my_seat + 3) % 4 }

    private var table_size: Card_Size {
        if v_size_class == .compact { return .tiny }
        if h_size_class == .regular { return .normal }
        return .small
    }
    private var table_cfg: Card_Config { card_config(.table, table_size) }

    var body: some View {
        VStack(spacing: 0) {
            info_bar
            // the table band spans the full height and the hand overlays its
            // bottom, so tall stacks never squeeze the table positions
            ZStack(alignment: .bottom) {
                game_area
                my_area
            }
        }
        .background(Color(red: 0.06, green: 0.2, blue: 0.38))
        // the hand hugs the physical bottom edge like the reference app,
        // cards drawing under the home indicator
        .ignoresSafeArea(edges: .bottom)
        .overlay(alignment: .top) {
            if socket.status != .connected && !store.is_tutorial {
                connection_banner
                    .padding(.top, 40)
            }
        }
        .alert("Leave the game?", isPresented: $show_leave_confirm) {
            Button("Cancel", role: .cancel) {}
            Button("Leave", role: .destructive) { leave_game() }
        } message: {
            Text("Your seat is held for 60 seconds")
        }
    }

    private func leave_game() {
        socket.send(.leave_room)
        socket.logout()
        store.reset()
    }

    private var connection_banner: some View {
        HStack(spacing: 10) {
            Text(socket.status == .closed ? "connection lost" : "reconnecting…")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
            if socket.status == .closed {
                Button("retry") {
                    socket.wake()
                }
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color(red: 1, green: 0.76, blue: 0.03))
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color(red: 0.86, green: 0.21, blue: 0.27).opacity(0.92), in: Capsule())
        .shadow(color: .black.opacity(0.4), radius: 6, y: 2)
    }

    // MARK: info bar

    private var info_bar: some View {
        HStack {
            Text("lvl: \(get_rank_symbol(store.level))")
                .font(.caption.bold())
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.yellow, in: RoundedRectangle(cornerRadius: 6))
                .foregroundStyle(.black)
            Spacer()
            HStack(spacing: 8) {
                Text("t1: \(get_rank_symbol(store.team_levels[0]))")
                    .foregroundStyle(Color(red: 0.39, green: 0.71, blue: 0.96))
                Text("t2: \(get_rank_symbol(store.team_levels[1]))")
                    .foregroundStyle(Color(red: 0.96, green: 0.56, blue: 0.69))
            }
            .font(.caption)
            Button {
                if store.is_tutorial {
                    store.tutorial_exit?()
                } else {
                    show_leave_confirm = true
                }
            } label: {
                Text("leave")
                    .font(.system(size: 11))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .foregroundStyle(Color(red: 0.9, green: 0.45, blue: 0.45))
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .strokeBorder(Color(red: 0.9, green: 0.45, blue: 0.45), lineWidth: 1)
                    )
            }
            .padding(.leading, 8)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color(red: 0.09, green: 0.13, blue: 0.24))
    }

    // MARK: table

    private var game_area: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height

            ZStack {
                // the partner badge lays its count beside the box so the
                // played row can sit high on the same grid line as mine
                seat_badge(partner_seat, horizontal: true)
                    .position(x: w / 2, y: 22)
                played_row(partner_seat)
                    .position(x: w / 2, y: 46 + table_cfg.height / 2)

                seat_badge(left_seat)
                    .position(x: 26, y: h * 0.28)
                played_row(left_seat)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 52)
                    .position(x: w / 2, y: h * 0.28)

                seat_badge(right_seat)
                    .position(x: w - 26, y: h * 0.28)
                played_row(right_seat)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .padding(.trailing, 52)
                    .position(x: w / 2, y: h * 0.28)

                my_played_row
                    .position(x: w / 2, y: h * 0.36)

            }
            .animation(.easeOut(duration: 0.22), value: plays_signature)
            // tribute lines and the hand banner live in the top-left corner,
            // clear of the badges, plays, and action buttons
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(store.tribute_events) { event in
                        tribute_line(event)
                    }
                    if let banner = store.hand_banner {
                        hand_banner_view(banner)
                    }
                }
                .animation(.easeOut(duration: 0.2), value: store.tribute_events.count)
                .padding(.leading, 48)
                .padding(.top, 6)
            }
        }
        .frame(maxHeight: .infinity)
        .contentShape(Rectangle())
        .onTapGesture {
            store.clear_selection()
        }
    }

    // a boxed initial keeps the table quiet; the border carries whose turn
    // it is (yellow) and who leads the trick (green). the count only appears
    // once a player is close to going out
    private func seat_badge(_ seat: Int, horizontal: Bool = false) -> some View {
        let is_turn = store.current_turn == seat
        let is_leading = store.leading_seat == seat
        let name = store.seat_name(seat)
        let disconnected = name.contains("(disconnected)")
        let team_color = seat % 2 == 0 ? Color(red: 0.39, green: 0.71, blue: 0.96) : Color(red: 0.96, green: 0.56, blue: 0.69)
        let green = Color(red: 0.3, green: 0.69, blue: 0.31)
        let border: Color = is_leading ? green : is_turn ? .yellow : team_color.opacity(0.5)
        let count = store.player_card_counts.indices.contains(seat) ? store.player_card_counts[seat] : 0

        let box = Text(String(name.prefix(1)).uppercased())
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(team_color)
            .frame(width: 32, height: 32)
            .background(Color.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(border, lineWidth: 2)
            )
            .opacity(disconnected ? 0.4 : 1)
        let count_text = Text("\(count)")
            .font(.system(size: 13, weight: .bold))
            .foregroundStyle(is_turn ? .yellow : is_leading ? green : .white)

        return Group {
            if horizontal {
                HStack(spacing: 6) {
                    box
                    if count <= 10 { count_text }
                }
            } else {
                VStack(spacing: 3) {
                    box
                    if count <= 10 { count_text }
                }
            }
        }
        .shadow(color: .black.opacity(0.8), radius: 2, y: 1)
    }

    @ViewBuilder
    private func played_row(_ seat: Int) -> some View {
        if let play = store.player_plays[seat] {
            if play.is_pass {
                pass_chip
            } else {
                card_row(play.cards)
            }
        }
    }

    @ViewBuilder
    private var my_played_row: some View {
        if let play = store.player_plays[store.my_seat] {
            if play.is_pass {
                pass_chip
            } else {
                card_row(play.cards)
                    .padding(2)
                    .background(store.leading_seat == store.my_seat ? Color(red: 0.3, green: 0.69, blue: 0.31).opacity(0.15) : .clear, in: RoundedRectangle(cornerRadius: 6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .strokeBorder(store.leading_seat == store.my_seat ? Color(red: 0.3, green: 0.69, blue: 0.31) : .clear, lineWidth: 2)
                    )
            }
        }
    }

    // signature of everyone's current play, so new plays animate in
    private var plays_signature: [Int] {
        store.player_plays.sorted { $0.key < $1.key }.flatMap { seat, play in
            [seat, play.is_pass ? -1 : -2] + play.cards.map { $0.id }
        }
    }

    private func card_row(_ cards: [Card]) -> some View {
        HStack(spacing: -(table_cfg.width - table_cfg.h_visible)) {
            ForEach(Array(sort_played_cards(cards, level: store.level).enumerated()), id: \.element.id) { idx, card in
                Card_View(card: card, level: store.level, size: table_size, context: .table)
                    .zIndex(Double(idx))
                    .transition(.scale(scale: 0.5).combined(with: .opacity))
            }
        }
    }

    private var pass_chip: some View {
        Text("pass")
            .font(.caption.italic())
            .foregroundStyle(.gray)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(Color.black.opacity(0.4), in: RoundedRectangle(cornerRadius: 4))
            .transition(.opacity)
    }

    // MARK: tribute

    private var tribute_target_name: String {
        if let target = store.tribute_target { return store.seat_name(target) }
        if let target = store.return_target { return store.seat_name(target) }
        return ""
    }

    private var required_tribute_rank: Rank? {
        guard store.tribute_mode == .give else { return nil }
        let eligible = store.hand.filter { !is_wild($0, level: store.level) }
        let top = eligible.max { get_rank_value($0.rank, level: store.level) < get_rank_value($1.rank, level: store.level) }
        return top?.rank
    }

    private var is_valid_tribute_selection: Bool {
        guard store.selected_ids.count == 1,
              let id = store.selected_ids.first,
              let card = store.hand.first(where: { $0.id == id })
        else { return false }
        switch store.tribute_mode {
        case .give:
            return !is_wild(card, level: store.level) && card.rank == required_tribute_rank
        case .ret:
            return card.rank <= Rank_Ten && !is_wild(card, level: store.level)
        case nil:
            return false
        }
    }

    private func send_tribute() {
        guard store.selected_ids.count == 1, let card_id = store.selected_ids.first else { return }
        if store.tribute_target != nil {
            socket.send(.tribute_give, Tribute_Card_Payload(card_id: card_id))
        } else if store.return_target != nil {
            socket.send(.tribute_return_give, Tribute_Card_Payload(card_id: card_id))
        }
        store.clear_selection()
    }

    // one line of plain text per tribute event; boxes and card images made
    // the feed collide with everything around it
    private func tribute_line(_ event: Tribute_Event) -> some View {
        let is_return = event.kind == .ret
        let accent = is_return ? Color(red: 0.39, green: 0.71, blue: 0.96) : Color(red: 1, green: 0.76, blue: 0.03)

        let line: Text
        if event.kind == .kang_gong {
            line = Text("tribute refused — both red jokers (kang gong)")
                .foregroundColor(Color(red: 0.96, green: 0.45, blue: 0.5))
        } else {
            let seat_name = { (seat: Int) in seat == store.my_seat ? "You" : store.seat_name(seat) }
            var card_text = Text("")
            if let card = event.card {
                let red_card = card.suit == Suit_Joker ? card.rank == Rank_Red_Joker : is_red_suit(card.suit)
                let label = card.suit == Suit_Joker ? "🃏" : "\(get_rank_symbol(card.rank))\(get_suit_symbol(card.suit))"
                card_text = Text("  \(label)")
                    .foregroundColor(red_card ? Color(red: 1, green: 0.45, blue: 0.45) : .white)
            }
            line = Text("\(is_return ? "return" : "tribute")  ").foregroundColor(accent)
                + Text("\(seat_name(event.from_seat)) → \(seat_name(event.to_seat))").foregroundColor(.white)
                + card_text
        }

        return line
            .font(.system(size: 15, weight: .bold))
            .shadow(color: .black.opacity(0.8), radius: 2, y: 1)
            .transition(.opacity.combined(with: .move(edge: .top)))
    }

    // MARK: banners / actions

    private func hand_banner_view(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 15, weight: .bold))
            .multilineTextAlignment(.center)
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(
                (store.game_winner != nil ? Color(red: 0.9, green: 0.68, blue: 0.02) : Color.black.opacity(0.78)),
                in: RoundedRectangle(cornerRadius: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(Color.white.opacity(0.25), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.4), radius: 6, y: 2)
            .transition(.opacity.combined(with: .scale))
    }

    private var show_actions: Bool {
        !store.hand.isEmpty && (store.tribute_mode != nil || store.is_my_turn)
    }

    private var action_buttons: some View {
        HStack(spacing: 14) {
            if store.tribute_mode != nil {
                action_button("tribute", enabled: is_valid_tribute_selection, color: Color(red: 1, green: 0.76, blue: 0.03), text_color: .black) {
                    send_tribute()
                }
            } else {
                action_button("pass", enabled: store.can_pass, color: Color(red: 0.86, green: 0.21, blue: 0.27)) {
                    socket.send(.pass)
                    store.clear_selection()
                }
                action_button("play", enabled: !store.selected_ids.isEmpty, color: Color(red: 0.16, green: 0.65, blue: 0.27)) {
                    socket.send(.play_cards, Play_Cards_Payload(card_ids: Array(store.selected_ids)))
                    store.clear_selection()
                }
            }
        }
    }

    private func action_button(_ label: String, enabled: Bool, color: Color, text_color: Color = .white, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 16, weight: .bold))
                .padding(.horizontal, 30)
                .padding(.vertical, 10)
                .background(enabled ? color : Color.gray.opacity(0.5), in: Capsule())
                .foregroundStyle(enabled ? text_color : .white.opacity(0.4))
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.25), lineWidth: 1))
        }
        .disabled(!enabled)
    }

    // MARK: my area

    private var my_area: some View {
        VStack(spacing: 8) {
            // tied to my controls so tall hand stacks can never cover it
            if store.tribute_mode != nil {
                Text("Select 1 card to give to \(tribute_target_name)")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color(red: 1, green: 0.76, blue: 0.03))
                    .shadow(color: .black.opacity(0.8), radius: 2, y: 1)
            }
            if show_actions {
                action_buttons
            }
            if store.hand.isEmpty && store.game_active {
                Text("You finished!")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color(red: 0.16, green: 0.65, blue: 0.27), in: RoundedRectangle(cornerRadius: 6))
                    .padding(.bottom, 10)
            }
            Hand_View()
        }
        .frame(maxWidth: .infinity)
        .overlay(alignment: .bottomLeading) {
            Cheat_Sheet_Button()
                .padding(.leading, 6)
                .padding(.bottom, 6)
        }
    }
}

// Sort cards by natural rank order for display, with jokers last. When a
// play uses the ace as the low end of a run (A-2-3-4-5, AA2233, ...) the
// ace sorts before the 2; an ace alongside a king stays high (10-J-Q-K-A).
// Full houses read triple first, pair second.
func sort_played_cards(_ cards: [Card], level: Rank) -> [Card] {
    if cards.count == 5,
       let combo = detect_combo(cards, level: level),
       combo.type == .full_house,
       // the combo's value is the triple's rank value, which recovers the
       // triple rank even when a wild completes it
       let triple_rank = cards.map({ $0.rank }).first(where: { get_rank_value($0, level: level) == combo.value }) {
        let triple = cards.filter { $0.rank == triple_rank && !is_wild($0, level: level) }
        let wilds = cards.filter { is_wild($0, level: level) }
        let pair = cards.filter { $0.rank != triple_rank && !is_wild($0, level: level) }
        return triple + wilds + pair
    }

    let has_rank = { (r: Rank) in cards.contains { $0.rank == r } }
    let ace_low = has_rank(Rank_Ace) && has_rank(Rank_Two) && !has_rank(Rank_King)

    func natural_order(_ rank: Rank) -> Int {
        if rank == Rank_Black_Joker { return 100 }
        if rank == Rank_Red_Joker { return 101 }
        if rank == Rank_Ace { return ace_low ? -1 : 12 }
        if rank == Rank_Two { return 0 }
        return rank
    }

    return cards.sorted { natural_order($0.rank) < natural_order($1.rank) }
}

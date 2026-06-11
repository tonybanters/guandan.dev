import SwiftUI
import GuandanCore

struct Game_View: View {
    @Environment(Game_Store.self) private var store
    let socket: Game_Socket

    private var partner_seat: Int { (store.my_seat + 2) % 4 }
    private var left_seat: Int { (store.my_seat + 1) % 4 }
    private var right_seat: Int { (store.my_seat + 3) % 4 }

    var body: some View {
        VStack(spacing: 0) {
            info_bar

            ZStack {
                VStack {
                    seat_label(partner_seat)
                    played_row(partner_seat)
                    Spacer()
                }
                HStack {
                    VStack {
                        seat_label(left_seat)
                        played_row(left_seat)
                    }
                    Spacer()
                    VStack {
                        seat_label(right_seat)
                        played_row(right_seat)
                    }
                }
                .padding(.horizontal, 12)
                VStack {
                    Spacer()
                    played_row(store.my_seat)
                    if store.is_my_turn {
                        action_buttons
                    }
                }
                .padding(.bottom, 8)
            }
            .frame(maxHeight: .infinity)

            Hand_View()
        }
        .background(Color(red: 0.06, green: 0.2, blue: 0.38))
    }

    private var info_bar: some View {
        HStack {
            Text("lvl: \(get_rank_symbol(store.level))")
                .font(.caption.bold())
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Color.yellow, in: RoundedRectangle(cornerRadius: 6))
                .foregroundStyle(.black)
            Spacer()
            Text("t1: \(get_rank_symbol(store.team_levels[0]))  t2: \(get_rank_symbol(store.team_levels[1]))")
                .font(.caption)
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color(red: 0.09, green: 0.13, blue: 0.24))
    }

    private func seat_label(_ seat: Int) -> some View {
        let player = store.players.first { $0.seat == seat }
        return VStack(spacing: 0) {
            Text(player?.name ?? "p\(seat + 1)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(seat % 2 == 0 ? Color(red: 0.39, green: 0.71, blue: 0.96) : Color(red: 0.96, green: 0.56, blue: 0.69))
            Text("\(store.player_card_counts.indices.contains(seat) ? store.player_card_counts[seat] : 0)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(store.current_turn == seat ? .yellow : .white)
        }
    }

    @ViewBuilder
    private func played_row(_ seat: Int) -> some View {
        if let play = store.player_plays[seat] {
            if play.is_pass {
                Text("pass")
                    .font(.caption.italic())
                    .foregroundStyle(.gray)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.black.opacity(0.4), in: RoundedRectangle(cornerRadius: 4))
            } else {
                HStack(spacing: -30) {
                    ForEach(play.cards) { card in
                        Card_View(card: card, level: store.level, width: 50)
                    }
                }
            }
        }
    }

    private var action_buttons: some View {
        HStack(spacing: 14) {
            Button {
                socket.send(.pass)
                store.clear_selection()
            } label: {
                Text("pass")
                    .font(.system(size: 14, weight: .bold))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 8)
                    .background(store.can_pass ? Color(red: 0.86, green: 0.21, blue: 0.27) : Color.gray.opacity(0.5), in: Capsule())
                    .foregroundStyle(.white)
            }
            .disabled(!store.can_pass)

            Button {
                socket.send(.play_cards, Play_Cards_Payload(card_ids: Array(store.selected_ids)))
                store.clear_selection()
            } label: {
                Text("play")
                    .font(.system(size: 14, weight: .bold))
                    .padding(.horizontal, 24)
                    .padding(.vertical, 8)
                    .background(store.selected_ids.isEmpty ? Color.gray.opacity(0.5) : Color(red: 0.16, green: 0.65, blue: 0.27), in: Capsule())
                    .foregroundStyle(.white)
            }
            .disabled(store.selected_ids.isEmpty)
        }
    }
}

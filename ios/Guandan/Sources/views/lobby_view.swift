import SwiftUI
import UIKit
import GuandanCore

struct Lobby_View: View {
    @Environment(Game_Store.self) private var store
    let socket: Game_Socket

    @State private var copied = false

    private var me: Player_Info? {
        store.players.first { $0.seat == store.my_seat && $0.id == store.your_id }
    }
    private var all_ready: Bool {
        !store.players.isEmpty && store.players.allSatisfy { $0.is_ready }
    }
    private var my_team_won: Bool? {
        guard store.is_quick_match, let winner = store.round_winner else { return nil }
        return winner == store.my_seat % 2
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text(store.is_quick_match ? "Quick Match" : "Lobby")
                    .font(.title3.bold())
                    .foregroundStyle(.white)

                if let won = my_team_won {
                    round_banner(won)
                }

                if !store.is_quick_match, let room_id = store.room_id {
                    invite_link(room_id)
                }

                seat_grid

                buttons

                Text(store.is_quick_match
                    ? "Next round starts when all 4 players ready up"
                    : "Share the invite link with friends to join")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.45))
            }
            .padding(20)
            .frame(maxWidth: 420)
            .background(Color(red: 0.09, green: 0.13, blue: 0.24), in: RoundedRectangle(cornerRadius: 16))
            .padding()
            .frame(maxWidth: .infinity)
            .padding(.top, 24)
        }
        .background(Color(red: 0.1, green: 0.1, blue: 0.18))
    }

    private func round_banner(_ won: Bool) -> some View {
        let green = Color(red: 0.16, green: 0.65, blue: 0.27)
        let red = Color(red: 0.86, green: 0.21, blue: 0.27)
        return Text(won ? "Your team won the round!" : "Your team lost the round")
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(won ? Color(red: 0.48, green: 0.85, blue: 0.54) : Color(red: 0.9, green: 0.45, blue: 0.45))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background((won ? green : red).opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(won ? green : red, lineWidth: 1)
            )
    }

    private func invite_link(_ room_id: String) -> some View {
        Button {
            UIPasteboard.general.string = "https://guandan.dev/room/\(room_id)"
            copied = true
            Task {
                try? await Task.sleep(for: .seconds(2))
                copied = false
            }
        } label: {
            VStack(spacing: 2) {
                Text("guandan.dev/room/\(room_id)")
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundStyle(Color(red: 0.49, green: 0.78, blue: 0.89))
                Text(copied ? "Copied!" : "Tap to copy invite link")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.5))
            }
            .frame(maxWidth: .infinity)
            .padding(10)
            .background(Color(red: 0.06, green: 0.2, blue: 0.38), in: RoundedRectangle(cornerRadius: 8))
        }
    }

    private var seat_grid: some View {
        let grid_columns = [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)]
        return LazyVGrid(columns: grid_columns, spacing: 10) {
            ForEach(0..<4, id: \.self) { seat in
                seat_slot(seat)
            }
        }
    }

    private func seat_slot(_ seat: Int) -> some View {
        let player = store.players.first { $0.seat == seat }
        let team = seat % 2
        let is_me = seat == store.my_seat && me != nil
        let team_bg = team == 0 ? Color(red: 0.1, green: 0.23, blue: 0.36) : Color(red: 0.29, green: 0.1, blue: 0.18)
        let team_border = team == 0 ? Color(red: 0.13, green: 0.59, blue: 0.95) : Color(red: 0.91, green: 0.12, blue: 0.39)
        let ready_green = Color(red: 0.3, green: 0.69, blue: 0.31)

        return Button {
            if player == nil {
                socket.send(.pick_seat, Pick_Seat_Payload(seat: seat))
            }
        } label: {
            VStack(spacing: 3) {
                Text("Team \(team + 1)")
                    .font(.system(size: 10, weight: .bold))
                    .kerning(1)
                    .foregroundStyle(.white.opacity(0.5))
                if let player {
                    Text(is_me ? "\(player.name) (you)" : player.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text(player.is_ready ? "Ready" : "Not Ready")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(player.is_ready ? ready_green : Color(red: 1, green: 0.6, blue: 0))
                } else {
                    Text("Tap to sit here")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.4))
                }
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .padding(8)
            .background(team_bg, in: RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(player?.is_ready == true ? ready_green : team_border, lineWidth: 2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(is_me ? .white : .clear, lineWidth: 2)
                    .padding(-3)
            )
        }
        .disabled(player != nil)
    }

    private var buttons: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                if let me {
                    lobby_button(me.is_ready ? "Unready" : "Ready", color: me.is_ready ? Color(red: 0.42, green: 0.46, blue: 0.49) : Color(red: 0.3, green: 0.69, blue: 0.31)) {
                        socket.send(.ready)
                    }
                }
                lobby_button("Leave", color: Color(red: 0.86, green: 0.21, blue: 0.27)) {
                    socket.send(.leave_room)
                    socket.logout()
                    store.reset()
                }
            }
            if store.is_host && !store.is_quick_match {
                HStack(spacing: 8) {
                    lobby_button("Fill with Bots", color: Color(red: 1, green: 0.6, blue: 0)) {
                        socket.send(.fill_bots)
                    }
                    lobby_button("Start Game", color: all_ready && store.players.count == 4 ? Color(red: 0.16, green: 0.65, blue: 0.27) : Color(white: 0.33)) {
                        socket.send(.start_game)
                    }
                }
            }
        }
    }

    private func lobby_button(_ label: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(color, in: RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(.white)
        }
    }
}

import SwiftUI
import GuandanCore

// tokyonight, matching the user's terminal colorscheme
private enum Tokyo {
    static let bg = Color(red: 0.082, green: 0.086, blue: 0.118)
    static let panel = Color(red: 0.102, green: 0.106, blue: 0.149)
    static let fg = Color(red: 0.753, green: 0.792, blue: 0.961)
    static let muted = Color(red: 0.663, green: 0.694, blue: 0.839)
    static let red = Color(red: 0.969, green: 0.463, blue: 0.557)
    static let green = Color(red: 0.620, green: 0.808, blue: 0.416)
    static let yellow = Color(red: 0.878, green: 0.686, blue: 0.408)
    static let blue = Color(red: 0.478, green: 0.635, blue: 0.969)
    static let magenta = Color(red: 0.733, green: 0.604, blue: 0.969)
    static let cyan = Color(red: 0.490, green: 0.812, blue: 1.000)
}

struct Home_View: View {
    @Environment(Game_Store.self) private var store
    let socket: Game_Socket

    @AppStorage("guandan_name") private var name = ""
    @State private var join_code = ""
    @State private var show_friends = false
    @State private var show_tutorial = false

    private var trimmed_name: String { name.trimmingCharacters(in: .whitespaces) }
    private var has_name: Bool { !trimmed_name.isEmpty }
    private var connected: Bool { socket.status == .connected }
    // joining anything requires a live socket, or the ui pretends to queue
    // while nothing was ever sent
    private var can_join: Bool { has_name && connected }

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Text("掼蛋")
                    .font(.system(size: 30))
                Text("Guan Dan")
                    .font(.title3.bold())
            }
            .foregroundStyle(Tokyo.fg)

            if store.in_queue {
                queue_view
            } else {
                menu_view
            }

            Text(status_text)
                .font(.caption)
                .foregroundStyle(Tokyo.muted.opacity(0.7))
        }
        .padding(20)
        .frame(maxWidth: 560)
        .background(Tokyo.panel, in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Tokyo.fg.opacity(0.08), lineWidth: 1)
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Tokyo.bg)
        .fullScreenCover(isPresented: $show_tutorial) {
            Tutorial_View(on_exit: { show_tutorial = false })
        }
        .onAppear {
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-tutorial") {
                show_tutorial = true
            }
            #endif
        }
    }

    private var queue_view: some View {
        VStack(spacing: 12) {
            Text("Quick Match")
                .font(.headline)
                .foregroundStyle(Tokyo.fg)
            Text("Searching for players… \(store.queue_found)/4")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Tokyo.cyan)
            Text("The match starts as soon as 4 players are found")
                .font(.caption)
                .foregroundStyle(Tokyo.muted.opacity(0.7))
            menu_button("Cancel", color: Tokyo.fg.opacity(0.12), text_color: Tokyo.muted, enabled: true) {
                socket.send(.queue_leave)
                store.in_queue = false
            }
        }
    }

    @ViewBuilder
    private var menu_view: some View {
        TextField("Your name", text: $name)
            .textFieldStyle(.roundedBorder)
            .multilineTextAlignment(.center)
            .autocorrectionDisabled()
            .onChange(of: name) { _, new_value in
                if new_value.count > 20 { name = String(new_value.prefix(20)) }
            }

        if let session = socket.saved_session {
            rejoin_banner(session)
        }

        if show_friends {
            HStack(spacing: 8) {
                menu_button("Create Room", color: Tokyo.blue, enabled: can_join) {
                    store.practice_pending = false
                    socket.send(.create_room, Create_Room_Payload(player_name: trimmed_name))
                }
                TextField("Room code", text: $join_code)
                    .textFieldStyle(.roundedBorder)
                    .multilineTextAlignment(.center)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
                    .frame(maxWidth: 140)
                menu_button("Join", color: Tokyo.green, enabled: can_join && !join_code.trimmingCharacters(in: .whitespaces).isEmpty) {
                    join_room()
                }
            }
            menu_button("Back", color: Tokyo.fg.opacity(0.12), text_color: Tokyo.muted, enabled: true) {
                show_friends = false
            }
        } else {
            HStack(spacing: 8) {
                menu_button("Play with\nFriends", color: Tokyo.blue, enabled: can_join) {
                    show_friends = true
                }
                menu_button("Practice\nvs Bots", color: Tokyo.yellow, enabled: can_join) {
                    store.practice_pending = true
                    socket.send(.create_room, Create_Room_Payload(player_name: trimmed_name))
                }
                menu_button("Quick\nMatch", color: Tokyo.magenta, enabled: can_join) {
                    socket.send(.queue_join, Queue_Join_Payload(player_name: trimmed_name))
                    store.in_queue = true
                    store.queue_found = 1
                }
                menu_button("How to\nPlay", color: Tokyo.cyan, enabled: true) {
                    show_tutorial = true
                }
            }
            if !has_name {
                Text("Enter a name to play")
                    .font(.caption)
                    .foregroundStyle(Tokyo.muted.opacity(0.7))
            } else if !connected {
                Button("not connected — tap to retry") {
                    socket.connect()
                }
                .font(.caption.bold())
                .foregroundStyle(Tokyo.yellow)
            }
        }
    }

    private func rejoin_banner(_ session: Session_Info) -> some View {
        VStack(spacing: 8) {
            Text("Game in progress in room \(session.room_id)")
                .font(.system(size: 13))
                .foregroundStyle(Tokyo.green)
            HStack(spacing: 8) {
                small_button("Rejoin", color: Tokyo.green) {
                    socket.try_reconnect()
                }
                small_button("Discard", color: Tokyo.fg.opacity(0.12), text_color: Tokyo.muted) {
                    socket.logout()
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(10)
        .background(Tokyo.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(Tokyo.green.opacity(0.6), lineWidth: 1)
        )
    }

    private func join_room() {
        let code = join_code.trimmingCharacters(in: .whitespaces)
        guard has_name, !code.isEmpty else { return }
        socket.send(.join_room, Join_Room_Payload(room_id: code, player_name: trimmed_name))
    }

    private func menu_button(_ label: String, color: Color, text_color: Color = Tokyo.bg, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, minHeight: 44)
                .padding(.vertical, 6)
                .background(color.opacity(enabled ? 1 : 0.35), in: RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(text_color.opacity(enabled ? 1 : 0.5))
        }
        .disabled(!enabled)
    }

    private func small_button(_ label: String, color: Color, text_color: Color = Tokyo.bg, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: .bold))
                .padding(.horizontal, 16)
                .padding(.vertical, 7)
                .background(color, in: RoundedRectangle(cornerRadius: 8))
                .foregroundStyle(text_color)
        }
    }

    private var status_text: String {
        switch socket.status {
        case .closed: return "disconnected"
        case .connecting: return "connecting..."
        case .connected: return "connected to guandan.dev"
        case .reconnecting: return "reconnecting..."
        }
    }
}

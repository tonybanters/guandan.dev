import SwiftUI
import GuandanCore

@main
struct Guandan_App: App {
    @State private var store = Game_Store()
    @State private var socket = Game_Socket()

    var body: some Scene {
        WindowGroup {
            Content_View(socket: socket)
                .environment(store)
                .onAppear {
                    socket.on_message = { msg in
                        store.handle(msg)
                    }
                    socket.connect()
                }
        }
    }
}

struct Content_View: View {
    @Environment(Game_Store.self) private var store
    let socket: Game_Socket

    var body: some View {
        if store.game_active {
            Game_View(socket: socket)
        } else {
            Home_View(socket: socket)
        }
    }
}

struct Home_View: View {
    @Environment(Game_Store.self) private var store
    let socket: Game_Socket

    @State private var name = ""
    @State private var practice_pending = false

    var body: some View {
        VStack(spacing: 16) {
            Text("guandan")
                .font(.system(size: 36, weight: .bold, design: .monospaced))
                .foregroundStyle(.white)

            TextField("your name", text: $name)
                .textFieldStyle(.roundedBorder)
                .frame(maxWidth: 240)

            Button("practice vs bots") {
                practice_pending = true
                socket.send(.create_room, Create_Room_Payload(player_name: name))
            }
            .buttonStyle(.borderedProminent)
            .disabled(name.isEmpty)

            Button("quick match") {
                socket.send(.queue_join, Queue_Join_Payload(player_name: name))
            }
            .buttonStyle(.bordered)
            .tint(.white)
            .disabled(name.isEmpty)

            if socket.saved_session != nil {
                Button("rejoin last game") {
                    socket.try_reconnect()
                }
                .buttonStyle(.bordered)
                .tint(.yellow)
            }

            Text(status_text)
                .font(.caption)
                .foregroundStyle(.white.opacity(0.6))

            if let error = store.last_error {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.06, green: 0.2, blue: 0.38))
        .onChange(of: store.room_id) { _, new_value in
            if practice_pending && new_value != nil {
                socket.send(.fill_bots)
                socket.send(.start_game)
                practice_pending = false
            }
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

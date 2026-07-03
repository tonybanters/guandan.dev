import SwiftUI
import GuandanCore

@main
struct Guandan_App: App {
    @State private var store = Game_Store()
    @State private var socket = Game_Socket()
    @Environment(\.scenePhase) private var scene_phase

    var body: some Scene {
        WindowGroup {
            Content_View(socket: socket)
                .environment(store)
                .onChange(of: scene_phase) { _, phase in
                    // ios kills the socket in the background and the retry
                    // loop gives up; coming back to the foreground must
                    // always get a fresh connection attempt
                    if phase == .active {
                        socket.wake()
                    }
                }
                .onAppear {
                    #if DEBUG
                    if ProcessInfo.processInfo.arguments.contains("-mock_game") {
                        store.load_mock_game()
                        return
                    }
                    #endif
                    socket.on_message = { msg in
                        store.handle(msg)
                        // a freshly created practice room fills with bots and
                        // starts immediately, mirroring the web client; scoped
                        // to room_state so no other message can trip it
                        if msg.type == .room_state, store.consume_practice_start() {
                            socket.send(.fill_bots)
                            socket.send(.start_game)
                        }
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
        Group {
            if store.game_active {
                Game_View(socket: socket)
            } else if store.room_id != nil {
                Lobby_View(socket: socket)
            } else {
                Home_View(socket: socket)
            }
        }
        .overlay(alignment: .bottom) {
            if let error = store.last_error {
                Text(error)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Color(red: 0.86, green: 0.21, blue: 0.27), in: RoundedRectangle(cornerRadius: 8))
                    .shadow(color: .black.opacity(0.4), radius: 6, y: 2)
                    .padding(.bottom, 20)
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(.easeOut(duration: 0.2), value: store.last_error)
    }
}

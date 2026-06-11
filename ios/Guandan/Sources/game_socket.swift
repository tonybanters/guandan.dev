import Foundation
import Observation
import GuandanCore

struct Session_Info: Codable {
    let session_token: String
    let room_id: String
}

@MainActor
@Observable
final class Game_Socket {
    enum Status {
        case closed
        case connecting
        case connected
        case reconnecting
    }

    private(set) var status: Status = .closed
    var on_message: ((Incoming_Message) -> Void)?

    private let url: URL
    private var task: URLSessionWebSocketTask?
    private var receive_task: Task<Void, Never>?
    private var reconnect_attempts = 0
    private let max_reconnect_attempts = 5
    private var should_reconnect = true
    private var reconnecting_session = false
    private var joined_this_load = false

    private(set) var saved_session: Session_Info? = load_session()

    init(url: URL = URL(string: "wss://guandan.dev/ws")!) {
        self.url = url
    }

    func connect() {
        should_reconnect = true
        open()
    }

    func close() {
        should_reconnect = false
        receive_task?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        status = .closed
    }

    func send<T: Encodable>(_ type: Msg_Type, _ payload: T) {
        guard let task, let text = try? encode_message(type, payload) else { return }
        Task {
            try? await task.send(.string(text))
        }
    }

    func send(_ type: Msg_Type) {
        send(type, Empty_Payload())
    }

    func logout() {
        clear_session()
        saved_session = nil
    }

    func try_reconnect() {
        guard let session = saved_session else { return }
        reconnecting_session = true
        send(.reconnect, Reconnect_Payload(session_token: session.session_token, room_id: session.room_id))
    }

    private func open() {
        status = reconnect_attempts > 0 ? .reconnecting : .connecting
        let task = URLSession.shared.webSocketTask(with: url)
        self.task = task
        task.resume()

        if let session = saved_session, joined_this_load {
            reconnecting_session = true
            send(.reconnect, Reconnect_Payload(session_token: session.session_token, room_id: session.room_id))
        }

        receive_task = Task {
            await receive_loop(task)
        }
    }

    private func receive_loop(_ task: URLSessionWebSocketTask) async {
        do {
            while !Task.isCancelled {
                let message = try await task.receive()
                status = .connected
                reconnect_attempts = 0
                if case .string(let text) = message, let msg = Incoming_Message(text: text) {
                    handle(msg)
                }
            }
        } catch {
            self.task = nil
            if should_reconnect && reconnect_attempts < max_reconnect_attempts {
                let delay = min(UInt64(1 << reconnect_attempts), 10)
                reconnect_attempts += 1
                status = .reconnecting
                try? await Task.sleep(nanoseconds: delay * 1_000_000_000)
                if should_reconnect {
                    open()
                }
            } else {
                status = .closed
            }
        }
    }

    private func handle(_ msg: Incoming_Message) {
        switch msg.type {
        case .reconnect_success:
            if let p = try? msg.payload(Reconnect_Success_Payload.self) {
                let session = Session_Info(session_token: p.session_token, room_id: p.room_id)
                save_session(session)
                saved_session = session
                joined_this_load = true
                reconnecting_session = false
            }
        case .room_state:
            if let p = try? msg.payload(Room_State_Payload.self) {
                if let token = p.session_token {
                    let session = Session_Info(session_token: token, room_id: p.room_id)
                    save_session(session)
                    saved_session = session
                }
                joined_this_load = true
                reconnecting_session = false
            }
        case .error:
            if reconnecting_session {
                reconnecting_session = false
                clear_session()
                saved_session = nil
            }
        default:
            break
        }

        on_message?(msg)
    }
}

private let session_key = "guandan_session"

private func load_session() -> Session_Info? {
    guard let data = UserDefaults.standard.data(forKey: session_key) else { return nil }
    return try? JSONDecoder().decode(Session_Info.self, from: data)
}

private func save_session(_ session: Session_Info) {
    if let data = try? JSONEncoder().encode(session) {
        UserDefaults.standard.set(data, forKey: session_key)
    }
}

private func clear_session() {
    UserDefaults.standard.removeObject(forKey: session_key)
}

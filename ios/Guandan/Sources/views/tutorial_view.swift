import SwiftUI
import GuandanCore

private let me = 0
private let west = 1
private let partner = 2
private let east = 3

private func c(_ id: Int, _ rank: Rank, _ suit: Suit) -> Card {
    Card(suit: suit, rank: rank, id: id)
}

// the web tutorial dealt jacks here but narrated them as 9s; actual 9s make
// the "cannot beat the pair of 10s" lesson true
private let starting_hand: [Card] = [
    c(101, Rank_Ten, Suit_Clubs),
    c(102, Rank_Nine, Suit_Spades),
    c(103, Rank_Nine, Suit_Diamonds),
    c(104, Rank_Three, Suit_Diamonds),
    c(105, Rank_Four, Suit_Spades),
    c(106, Rank_Five, Suit_Hearts),
    c(107, Rank_Six, Suit_Clubs),
    c(108, Rank_Seven, Suit_Diamonds),
    c(109, Rank_Eight, Suit_Spades),
    c(110, Rank_Eight, Suit_Hearts),
    c(111, Rank_Eight, Suit_Diamonds),
    c(112, Rank_Eight, Suit_Clubs),
    c(113, Rank_Two, Suit_Hearts),
]

private let west_queen = [c(201, Rank_Queen, Suit_Clubs)]
private let partner_ace = [c(202, Rank_Ace, Suit_Spades)]
private let partner_fours = [c(203, Rank_Four, Suit_Hearts), c(204, Rank_Four, Suit_Clubs)]
private let east_tens = [c(205, Rank_Ten, Suit_Spades), c(206, Rank_Ten, Suit_Hearts)]
private let east_straight = [
    c(211, Rank_Four, Suit_Clubs), c(212, Rank_Five, Suit_Spades), c(213, Rank_Six, Suit_Hearts),
    c(214, Rank_Seven, Suit_Clubs), c(215, Rank_Eight, Suit_Diamonds),
]
private let tribute_pay = c(220, Rank_King, Suit_Diamonds)
private let tribute_return = c(221, Rank_Five, Suit_Diamonds)

private enum Expect {
    case play(ids: [Int], hint: String)
    case pass
}

private struct Tut_Step {
    let text: String
    var expect: Expect?
    var turn: Int = -1
    var can_pass = false
    var highlight: [Int] = []
}

private let steps: [Tut_Step] = [
    Tut_Step(text: "Welcome to Guan Dan! You and your partner (top) play as a team against West and East. Be the first team to empty your hands."),
    Tut_Step(text: "The badge in the top left shows the level, this hand's trump rank. Level cards beat aces. Your gold 2 of HEARTS is wild: it can stand in for almost any card.", highlight: [113]),
    Tut_Step(text: "The table is empty and it's your turn, so you may lead anything. Tap your 10 of clubs to select it, then hit Play.",
             expect: .play(ids: [101], hint: "select just the 10 of clubs"), turn: me, highlight: [101]),
    Tut_Step(text: "West beat your 10 with a queen. To play on someone you must beat their play with the SAME combo type, or pass.", turn: me),
    Tut_Step(text: "Beating the queen would waste your good cards. Sometimes passing is right. Hit Pass.",
             expect: .pass, turn: me, can_pass: true),
    Tut_Step(text: "Your partner took the trick with an ace and East passed. When everyone passes, the trick ends and its winner leads the next one.", turn: partner),
    Tut_Step(text: "Partner leads a pair of 4s. Pairs can only be beaten by higher pairs (or bombs). East plays a pair of 10s...", turn: east),
    Tut_Step(text: "Your pair of 9s cannot beat the 10s. Your partner loses this trick, but hold your strong cards for the right moment. Pass for now.",
             expect: .pass, turn: me, can_pass: true),
    Tut_Step(text: "East won the trick with the 10s and leads next. East plays a straight: five consecutive ranks. Only a higher straight or a bomb beats it.", turn: me),
    Tut_Step(text: "You have FOUR 8s, a bomb! Bombs beat any non-bomb play, no matter the combo type. Double-tap one of your 8s (or long press the stack) to grab all four, then Play.",
             expect: .play(ids: [109, 110, 111, 112], hint: "double-tap or long press an 8 to select all four"), turn: me, highlight: [109, 110, 111, 112]),
    Tut_Step(text: "Boom. Nobody can answer a bomb that big, so you lead again. Now play your own straight: select 3-4-5-6-7 (tap each card or swipe across them) and Play. The full combo list lives under the ? combos button, bottom left.",
             expect: .play(ids: [104, 105, 106, 107, 108], hint: "select the 3, 4, 5, 6 and 7"), turn: me, highlight: [104, 105, 106, 107, 108]),
    Tut_Step(text: "Everyone passes again. Time to go out: play your pair of 9s, then your last card.",
             expect: .play(ids: [102, 103], hint: "double-tap a 9 to select the pair"), turn: me, highlight: [102, 103]),
    Tut_Step(text: "One card left: the wild 2 of hearts. Played alone it counts as a level card, stronger than an ace!",
             expect: .play(ids: [113], hint: "select the gold 2 of hearts"), turn: me, highlight: [113]),
    Tut_Step(text: "You finished 1st! Your team climbs levels based on where your partner lands: 1st + 2nd is 3 levels, 1st + 3rd is 2, 1st + 4th is 1. First team to win at level A takes the game.", turn: west),
    Tut_Step(text: "One more thing: TRIBUTE. Next hand, last place pays their best card to the winner, who returns any card of 10 or lower. It shows in the top left like this.", turn: west),
    Tut_Step(text: "That's the core of Guan Dan. Check ? combos for tubes, plates, straight flushes and the joker bomb. Good luck!"),
]

/*
 * drives a fully scripted mock round through the real game ui. the store is
 * a private instance and the socket never connects; play and pass taps come
 * back through the send interceptor, and action steps only advance when the
 * expected cards are played.
 */
@MainActor
@Observable
private final class Tutorial_Driver {
    let store = Game_Store()
    let socket = Game_Socket()
    var step = 0
    var hint: String?
    var on_exit: (() -> Void)?

    private var timers: [Task<Void, Never>] = []

    var current: Tut_Step { steps[step] }
    var is_last: Bool { step == steps.count - 1 }

    func start() {
        store.is_tutorial = true
        store.tutorial_exit = { [weak self] in self?.on_exit?() }
        store.game_active = true
        store.level = Rank_Two
        store.my_seat = me
        store.hand = sort_cards(starting_hand, level: Rank_Two)
        store.player_card_counts = [13, 13, 13, 13]
        store.names_by_seat = [me: "You", west: "West", partner: "Partner", east: "East"]
        store.players = store.names_by_seat.map {
            Player_Info(id: "t\($0.key)", name: $0.value, seat: $0.key, team: $0.key % 2, is_ready: true)
        }
        socket.send_interceptor = { [weak self] type, play in
            self?.handle_send(type, play)
        }
        apply_step()
    }

    func advance() {
        hint = nil
        if is_last {
            on_exit?()
        } else {
            step += 1
            apply_step()
        }
    }

    private func apply_step() {
        timers.forEach { $0.cancel() }
        timers = []

        let s = current
        store.current_turn = s.turn
        store.can_pass = s.can_pass
        store.highlight_ids = Set(s.highlight)

        switch step {
        case 3:
            seat_plays(west, west_queen, after: 0.7)
        case 5:
            seat_plays(partner, partner_ace, after: 0.6)
            seat_passes(east, after: 1.4)
        case 6:
            new_trick(after: 0)
            seat_plays(partner, partner_fours, after: 0.7)
            seat_plays(east, east_tens, after: 1.7)
        case 8:
            seat_passes(west, after: 0.6)
            seat_passes(partner, after: 1.2)
            new_trick(after: 2.2)
            seat_plays(east, east_straight, after: 2.9)
        case 10, 11, 12:
            seat_passes(step == 10 ? east : west, after: 0.5)
            seat_passes(step == 10 ? west : partner, after: 1.1)
            seat_passes(step == 10 ? partner : east, after: 1.7)
            new_trick(after: 2.6)
        case 14:
            schedule(after: 0.5) { [self] in
                store.tribute_events = [Tribute_Event(id: 1, kind: .pay, from_seat: east, to_seat: me, card: tribute_pay)]
            }
            schedule(after: 1.7) { [self] in
                store.tribute_events.append(Tribute_Event(id: 2, kind: .ret, from_seat: me, to_seat: east, card: tribute_return))
            }
        case 15:
            store.tribute_events = []
            store.player_plays = [:]
        default:
            break
        }
    }

    private func handle_send(_ type: Msg_Type, _ play: Play_Cards_Payload?) {
        switch type {
        case .play_cards:
            guard case .play(let ids, let step_hint) = current.expect else { return }
            let want = Set(ids)
            guard Set(play?.card_ids ?? []) == want else {
                hint = step_hint
                return
            }
            let played = store.hand.filter { want.contains($0.id) }
            store.hand.removeAll { want.contains($0.id) }
            store.selected_ids = []
            store.player_plays[me] = Player_Play(cards: played, is_pass: false)
            store.leading_seat = me
            store.player_card_counts[me] -= played.count
            advance()
        case .pass:
            guard case .pass = current.expect else { return }
            store.player_plays[me] = Player_Play(cards: [], is_pass: true)
            advance()
        case .leave_room:
            on_exit?()
        default:
            break
        }
    }

    private func schedule(after delay: Double, _ fn: @escaping () -> Void) {
        timers.append(Task { @MainActor in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            fn()
        })
    }

    private func seat_plays(_ seat: Int, _ cards: [Card], after delay: Double) {
        schedule(after: delay) { [self] in
            store.player_plays[seat] = Player_Play(cards: cards, is_pass: false)
            store.leading_seat = seat
            store.player_card_counts[seat] -= cards.count
        }
    }

    private func seat_passes(_ seat: Int, after delay: Double) {
        schedule(after: delay) { [self] in
            store.player_plays[seat] = Player_Play(cards: [], is_pass: true)
        }
    }

    private func new_trick(after delay: Double) {
        schedule(after: delay) { [self] in
            store.player_plays = [:]
            store.leading_seat = nil
        }
    }
}

struct Tutorial_View: View {
    let on_exit: () -> Void
    @State private var driver = Tutorial_Driver()

    var body: some View {
        ZStack {
            Game_View(socket: driver.socket)
                .environment(driver.store)

            dialogue
        }
        .onAppear {
            driver.on_exit = on_exit
            driver.start()
        }
    }

    private var dialogue: some View {
        let step = driver.current
        let waiting = step.expect != nil

        return VStack(spacing: 8) {
            Text(step.text)
                .font(.system(size: 14))
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let hint = driver.hint {
                Text("Hint: \(hint)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color(red: 1, green: 0.76, blue: 0.03))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack {
                Button("Skip tutorial") {
                    on_exit()
                }
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.5))

                Spacer()

                Text("\(driver.step + 1)/\(steps.count)")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.4))

                Spacer()

                if waiting {
                    Text(is_pass_step ? "hit Pass to continue" : "your move")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color(red: 1, green: 0.76, blue: 0.03))
                } else {
                    Button(driver.is_last ? "Finish" : "Next") {
                        driver.advance()
                    }
                    .font(.system(size: 13, weight: .bold))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 6)
                    .background(Color(red: 0.16, green: 0.65, blue: 0.27), in: RoundedRectangle(cornerRadius: 6))
                    .foregroundStyle(.white)
                }
            }
        }
        .padding(14)
        .frame(width: 440)
        .background(Color(red: 0.09, green: 0.13, blue: 0.24), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color(red: 1, green: 0.76, blue: 0.03).opacity(0.5), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.5), radius: 16, y: 4)
        // action steps dock the dialogue above the hand and buttons like the
        // web client, so the cards being asked for stay visible
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: waiting ? .bottom : .center)
        .padding(.bottom, waiting ? 250 : 0)
        .animation(.easeOut(duration: 0.2), value: driver.step)
    }

    private var is_pass_step: Bool {
        if case .pass = driver.current.expect { return true }
        return false
    }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Message } from '../game/types'

type Message_Handler = (msg: Message) => void

const SESSION_KEY = 'guandan_session'

interface Session_Info {
  session_token: string
  room_id: string
}

function get_session(): Session_Info | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // ignore
  }
  return null
}

function save_session(session: Session_Info) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function clear_session() {
  localStorage.removeItem(SESSION_KEY)
}

export function use_websocket(url: string) {
  const [connected, set_connected] = useState(false)
  const [reconnecting, set_reconnecting] = useState(false)
  const [saved_session, set_saved_session] = useState<Session_Info | null>(get_session)
  const reconnecting_ref = useRef(false)
  const ws_ref = useRef<WebSocket | null>(null)
  const handlers_ref = useRef<Map<string, Message_Handler>>(new Map())
  const reconnect_attempts = useRef(0)
  const max_reconnect_attempts = 5
  const should_reconnect = useRef(true)
  // True once we've been in a room during this page load. Used to tell a
  // transient socket drop (silently restore) apart from a fresh page load
  // (show a rejoin prompt instead of auto-reconnecting).
  const joined_this_load = useRef(false)

  const connect = useCallback(() => {
    const ws = new WebSocket(url)
    ws_ref.current = ws

    ws.onopen = () => {
      set_connected(true)
      reconnect_attempts.current = 0

      // Only auto-reconnect on a transient drop mid-session; on a fresh
      // page load the Home screen offers an explicit Rejoin button.
      const session = get_session()
      if (session && joined_this_load.current) {
        reconnecting_ref.current = true
        set_reconnecting(true)
        ws.send(JSON.stringify({
          type: 'reconnect',
          payload: {
            session_token: session.session_token,
            room_id: session.room_id,
          },
        }))
      } else {
        reconnecting_ref.current = false
        set_reconnecting(false)
      }
    }

    ws.onclose = () => {
      set_connected(false)
      ws_ref.current = null

      // Auto-reconnect with exponential backoff
      if (should_reconnect.current && reconnect_attempts.current < max_reconnect_attempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnect_attempts.current), 10000)
        reconnect_attempts.current++
        reconnecting_ref.current = true
        set_reconnecting(true)
        setTimeout(() => {
          if (should_reconnect.current) {
            connect()
          }
        }, delay)
      } else {
        reconnecting_ref.current = false
        set_reconnecting(false)
      }
    }

    ws.onmessage = (event) => {
      const msg: Message = JSON.parse(event.data)

      // Handle reconnect success - save session
      if (msg.type === 'reconnect_success') {
        const payload = msg.payload as { session_token: string; room_id: string }
        const session = {
          session_token: payload.session_token,
          room_id: payload.room_id,
        }
        save_session(session)
        set_saved_session(session)
        joined_this_load.current = true
        reconnecting_ref.current = false
        set_reconnecting(false)
      }

      // Handle room_state - save session if it includes session info
      if (msg.type === 'room_state') {
        const payload = msg.payload as { session_token?: string; room_id: string }
        if (payload.session_token) {
          const session = {
            session_token: payload.session_token,
            room_id: payload.room_id,
          }
          save_session(session)
          set_saved_session(session)
        }
        joined_this_load.current = true
        reconnecting_ref.current = false
        set_reconnecting(false)
      }

      // Handle errors during reconnect - clear session
      if (msg.type === 'error' && reconnecting_ref.current) {
        reconnecting_ref.current = false
        set_reconnecting(false)
        clear_session()
        set_saved_session(null)
      }

      const handler = handlers_ref.current.get(msg.type)
      if (handler) {
        handler(msg)
      }
    }

    return ws
  }, [url])

  useEffect(() => {
    should_reconnect.current = true
    connect()

    return () => {
      should_reconnect.current = false
      if (ws_ref.current) {
        ws_ref.current.close()
      }
    }
  }, [connect])

  const send = useCallback((msg: Message) => {
    if (ws_ref.current && ws_ref.current.readyState === WebSocket.OPEN) {
      ws_ref.current.send(JSON.stringify(msg))
    }
  }, [])

  const on = useCallback((type: string, handler: Message_Handler) => {
    handlers_ref.current.set(type, handler)
    return () => {
      handlers_ref.current.delete(type)
    }
  }, [])

  const logout = useCallback(() => {
    clear_session()
    set_saved_session(null)
  }, [])

  // Explicitly resume a saved session (Rejoin button on the home screen)
  const try_reconnect = useCallback(() => {
    const session = get_session()
    if (!session) return
    if (ws_ref.current && ws_ref.current.readyState === WebSocket.OPEN) {
      reconnecting_ref.current = true
      set_reconnecting(true)
      ws_ref.current.send(JSON.stringify({
        type: 'reconnect',
        payload: {
          session_token: session.session_token,
          room_id: session.room_id,
        },
      }))
    }
  }, [])

  return { connected, reconnecting, send, on, logout, saved_session, try_reconnect }
}

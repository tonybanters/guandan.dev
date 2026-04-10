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
  const reconnecting_ref = useRef(false)
  const ws_ref = useRef<WebSocket | null>(null)
  const handlers_ref = useRef<Map<string, Message_Handler>>(new Map())
  const reconnect_attempts = useRef(0)
  const max_reconnect_attempts = 5
  const should_reconnect = useRef(true)

  const connect = useCallback(() => {
    const ws = new WebSocket(url)
    ws_ref.current = ws

    ws.onopen = () => {
      set_connected(true)
      reconnect_attempts.current = 0

      // Check if we have a saved session and try to reconnect
      const session = get_session()
      if (session) {
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
        // No session - make sure we're not stuck in reconnecting state
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
        save_session({
          session_token: payload.session_token,
          room_id: payload.room_id,
        })
        reconnecting_ref.current = false
        set_reconnecting(false)
      }

      // Handle room_state - save session if it includes session info
      if (msg.type === 'room_state') {
        const payload = msg.payload as { session_token?: string; room_id: string }
        if (payload.session_token) {
          save_session({
            session_token: payload.session_token,
            room_id: payload.room_id,
          })
        }
        reconnecting_ref.current = false
        set_reconnecting(false)
      }

      // Handle errors during reconnect - clear session
      if (msg.type === 'error' && reconnecting_ref.current) {
        reconnecting_ref.current = false
        set_reconnecting(false)
        clear_session()
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
  }, [])

  return { connected, reconnecting, send, on, logout }
}

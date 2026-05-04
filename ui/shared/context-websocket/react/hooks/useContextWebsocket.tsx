/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'

type WebSocketState = 'connecting' | 'connected' | 'error'

interface WebSocketHook<TInbound, TOutbound> {
  wsState: WebSocketState
  lastMessage: TInbound | null
  lastError: Event | null
  send: (message: TOutbound) => void
}

interface WebSocketOptions<TInbound> {
  wsUrl: string
  token: string
  /** When changed, triggers a WebSocket reconnect (e.g. switching course context). */
  context?: string
  onConnect: (ws: WebSocket) => void
  parseMessage?: (raw: string) => TInbound
}

const useWebSocket = <TInbound, TOutbound>({
  wsUrl,
  token,
  context,
  onConnect,
  parseMessage,
}: WebSocketOptions<TInbound>): WebSocketHook<TInbound, TOutbound> => {
  const [wsState, setWsState] = useState<WebSocketState>('connecting')
  const [lastMessage, setLastMessage] = useState<TInbound | null>(null)
  const [lastError, setLastError] = useState<Event | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const onConnectRef = useRef(onConnect)
  const parseMessageRef = useRef(parseMessage)
  useLayoutEffect(() => {
    onConnectRef.current = onConnect
    parseMessageRef.current = parseMessage
  })

  useEffect(() => {
    // console.log(`Connecting to WebSocket at ${wsUrl} with token ${token}`)
    const ws = new WebSocket(`${wsUrl}?ws_token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsState('connected')
      onConnectRef.current(ws)
    }

    ws.onmessage = event => {
      const parsed = parseMessageRef.current
        ? parseMessageRef.current(event.data)
        : (JSON.parse(event.data) as TInbound)
      setLastMessage(parsed)
    }

    ws.onerror = error => {
      setLastError(error)
      setWsState('error')
    }

    return () => {
      ws.close()
    }
  }, [wsUrl, token, context])

  const send = useCallback(
    (message: TOutbound) => {
      if (wsRef.current && wsState === 'connected') {
        // console.log(`Sending message: ${JSON.stringify(message)}`)
        wsRef.current.send(JSON.stringify(message))
      }
    },
    [wsState],
  )

  return {
    wsState,
    lastMessage,
    lastError,
    send,
  }
}

export default useWebSocket

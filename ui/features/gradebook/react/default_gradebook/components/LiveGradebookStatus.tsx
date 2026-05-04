/*
 * Copyright (C) 2022 - present Instructure, Inc.
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

import React, {useEffect, useLayoutEffect, useRef} from 'react'

import {useScope as useI18nScope} from '@canvas/i18n'
import {useContextWebsocket} from '@canvas/context-websocket'
import LiveGradebookParticipant from './LiveGradebookParticipant'

import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Badge} from '@instructure/ui-badge'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Tooltip} from '@instructure/ui-tooltip'
import {GridLocation} from '../grid'
import {LiveGradebookEvent, LiveGradebookPayload} from './LiveGradebook/types'

interface LiveGradebookStatusOptions {
  courseId: string
  lastGradeChangeData: any
  onMessage: (message: LiveGradebookEvent) => void
  connectedUserUuids: string[]
  currentGridLocation?: GridLocation
}

export default function LiveGradebookStatus({
  courseId,
  lastGradeChangeData,
  onMessage,
  connectedUserUuids,
  currentGridLocation,
}: LiveGradebookStatusOptions) {
  const onMessageRef = useRef(onMessage)
  useLayoutEffect(() => {
    onMessageRef.current = onMessage
  })

  const {wsState, lastMessage, send} = useContextWebsocket<
    LiveGradebookEvent,
    LiveGradebookPayload
  >({
    // TODO: We should get this from a per-app-cluster config
    wsUrl: ENV.WS_URL || '',
    token: ENV.WS_TOKEN || '',
    context: '',
    onConnect: ws => {
      console.log('Requesting connected users')
      ws.send(JSON.stringify({action: 'getUsers', ws_token: ENV.WS_TOKEN}))
    },
  })

  const I18n = useI18nScope('gradebook')

  const message = I18n.t(
    'Gradebook %{status} receiving and sending live updates to other graders.',
    {status: wsState === 'connected' ? 'is' : 'is not'},
  )
  useEffect(() => {
    if (!currentGridLocation) return

    send({
      action: 'locationChange',
      location: {row: (currentGridLocation as any).row, cell: (currentGridLocation as any).cell},
      ws_token: ENV.WS_TOKEN || '',
    })
  }, [currentGridLocation, send])

  useEffect(() => {
    if (!lastGradeChangeData) return
    if (Object.keys(lastGradeChangeData).length === 0) return

    send({
      action: 'gradeChange',
      allSubmissionsResponse: lastGradeChangeData,
      ws_token: ENV.WS_TOKEN || '',
    })
  }, [lastGradeChangeData, send])

  useEffect(() => {
    if (!lastMessage) return

    console.log('Last Message:', lastMessage)
    onMessageRef.current(lastMessage)
  }, [lastMessage])

  return (
    <>
      <Flex direction="row-reverse" margin="none none small none">
        <Flex.Item margin="none x-small none x-small">
          <Badge
            variant={wsState === 'connected' ? 'success' : 'danger'}
            type="notification"
            standalone
            formatOutput={function () {
              return <ScreenReaderContent>{message}</ScreenReaderContent>
            }}
          />
        </Flex.Item>
        <Flex.Item>
          <Tooltip renderTip={message}>
            <Text>Live gradebook {wsState === 'connected' ? 'connected' : 'not connected'}</Text>
          </Tooltip>
        </Flex.Item>
      </Flex>
      <Flex direction="row-reverse" margin="none none small none">
        {connectedUserUuids?.map(uuid => {
          return (
            <Flex.Item key={uuid}>
              <LiveGradebookParticipant courseId={courseId} uuid={uuid} />
            </Flex.Item>
          )
        })}
      </Flex>
    </>
  )
}

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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {Flex} from '@instructure/ui-flex'
import {Spinner} from '@instructure/ui-spinner'
import MessageFeedback from './MessageFeedback'
import ConversationMilestone from './ConversationMilestone'
import type {LLMConversationMessage, ConversationProgress} from '../../types'

export interface ConversationMilestoneEntry {
  variant: 'single' | 'all'
  objective?: string
  afterMessageIndex: number
}

export function deriveMilestones(
  progress: ConversationProgress | null | undefined,
  totalMessageCount: number,
): ConversationMilestoneEntry[] {
  if (!progress) return []

  const covered = progress.objectives.filter(o => o.status === 'covered' && o.met_at_turn != null)
  const allMet =
    progress.objectives.length > 0 && progress.objectives.every(o => o.status === 'covered')

  const singleMarkers: ConversationMilestoneEntry[] = covered.map(o => ({
    variant: 'single',
    objective: o.objective,
    afterMessageIndex: o.met_at_turn!,
  }))

  const lastVisibleMessageIndex = Math.max(0, totalMessageCount - 2)
  const allMetMarker: ConversationMilestoneEntry[] = allMet
    ? [{variant: 'all', afterMessageIndex: lastVisibleMessageIndex}]
    : []

  return [...singleMarkers, ...allMetMarker]
}

const I18n = createI18nScope('ai_experiences')

interface MessageThreadProps {
  messages: LLMConversationMessage[]
  conversationId: string | null
  courseId: string | number
  aiExperienceId: string | number
  isLoading?: boolean
  isInitializing?: boolean
  bottomRef?: React.MutableRefObject<HTMLDivElement | null>
  milestones?: ConversationMilestoneEntry[]
}

const MessageThread = ({
  messages,
  conversationId,
  courseId,
  aiExperienceId,
  isLoading = false,
  isInitializing = false,
  bottomRef,
  milestones = [],
}: MessageThreadProps) => {
  if (isInitializing) {
    return (
      <Flex
        justifyItems="center"
        alignItems="center"
        height="100%"
        aria-live="polite"
        aria-busy={true}
      >
        <Spinner renderTitle={I18n.t('Initializing conversation...')} />
      </Flex>
    )
  }

  const visibleMessages = messages.slice(1)

  return (
    <>
      {visibleMessages.map((message, index) => {
        const isUser = message.role === 'User'
        const messageMilestones = milestones.filter(m => m.afterMessageIndex === index)
        return (
          <React.Fragment key={index}>
            <View as="div" display="block" margin="small 0" textAlign={isUser ? 'end' : 'start'}>
              <View
                as="div"
                display="inline-block"
                maxWidth="70%"
                padding="small"
                background={isUser ? 'primary' : undefined}
                borderRadius="medium"
                borderWidth={isUser ? 'small' : undefined}
                role="article"
                aria-label={isUser ? I18n.t('Your message') : I18n.t('Message from Assistant')}
                textAlign="start"
              >
                <Text data-testid={`llm-conversation-message-${message.role}`}>
                  <span
                    id={message.id ? `llm-message-${message.id}` : undefined}
                    style={{whiteSpace: 'pre-wrap'}}
                  >
                    {message.text}
                  </span>
                </Text>
              </View>
              {!isUser && message.id && conversationId && (
                <MessageFeedback
                  messageId={message.id}
                  messageContainerId={`llm-message-${message.id}`}
                  initialFeedback={message.feedback ?? []}
                  courseId={courseId}
                  aiExperienceId={String(aiExperienceId)}
                  conversationId={conversationId}
                />
              )}
            </View>
            {messageMilestones.map((milestone, mi) => (
              <ConversationMilestone
                key={`milestone-${index}-${mi}`}
                variant={milestone.variant}
                objective={milestone.objective}
              />
            ))}
          </React.Fragment>
        )
      })}
      {isLoading && (
        <View as="div" margin="small 0" textAlign="center" aria-live="polite" aria-busy={true}>
          <Spinner renderTitle={I18n.t('Thinking...')} size="small" />
        </View>
      )}
      {bottomRef && <div ref={bottomRef} style={{height: '1rem'}} />}
    </>
  )
}

export default MessageThread

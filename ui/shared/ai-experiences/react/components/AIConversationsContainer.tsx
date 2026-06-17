/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

import React, {useState, useEffect, useMemo} from 'react'
import {InstUISettingsProvider} from '@instructure/emotion'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {Heading} from '@instructure/ui-heading'
import {Button} from '@instructure/ui-buttons'
import {Spinner} from '@instructure/ui-spinner'
import {Pill} from '@instructure/ui-pill'
import {
  IconFullScreenLine,
  IconArrowOpenStartLine,
  IconArrowOpenEndLine,
} from '@instructure/ui-icons'
import {AIExperience, LLMConversationMessage, StudentConversation} from '../../types'
import {
  useStudentConversations,
  useConversationDetail,
  useConversationEvaluation,
} from '../hooks/useAIConversations'
import StudentConversationPicker, {identifierFor} from './StudentConversationPicker'
import FocusMode from './FocusMode'
import MessageThread, {deriveMilestones} from './MessageThread'
import GradientBorder from './GradientBorder'
import ConversationHeader from './ConversationHeader'
import OverallSnapshot from './OverallSnapshot'
import EvaluationInsights from './EvaluationInsights'
import AIExperienceError from './AIExperienceError'
import {roundedTheme, RADIUS_PILL, navButtonTheme} from '../brand'

const I18n = createI18nScope('ai_experiences_ai_conversations')

const expandButtonTheme = {borderRadius: RADIUS_PILL, smallHeight: '1.75rem'}
const pillTextStyle: React.CSSProperties = {fontWeight: 'bold', color: '#000000'}
const pillTextSuccessStyle: React.CSSProperties = {fontWeight: 'bold', color: '#03893D'}

interface AIConversationsContainerProps {
  aiExperience: AIExperience
  courseId: string | number
}

const AIConversationsContainer: React.FC<AIConversationsContainerProps> = ({
  aiExperience,
  courseId,
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  const {
    conversations,
    snapshot,
    isLoading: isLoadingConversations,
    isLoadingMore,
    error: conversationsError,
  } = useStudentConversations(courseId, aiExperience.id, searchTerm)

  // Students with a conversation first (stable within each group).
  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => Number(Boolean(b.id)) - Number(Boolean(a.id))),
    [conversations],
  )

  const [selectedIdentifier, setSelectedIdentifier] = useState<string | undefined>(undefined)
  // Cached so the header survives search replacing the list.
  const [selectedStudentData, setSelectedStudentData] = useState<StudentConversation | undefined>(
    undefined,
  )
  const [userSelected, setUserSelected] = useState(false)
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false)

  const hasConversation = selectedStudentData?.has_conversation !== false
  const selectedConversationId = hasConversation ? selectedStudentData?.id : undefined

  const {
    conversation,
    isLoading: isLoadingConversation,
    error: conversationError,
  } = useConversationDetail(courseId, aiExperience.id, selectedConversationId || undefined)

  // Gate the evaluation on the conversation loading, so the two llma calls run
  // serially and can't race on token refresh.
  const conversationLoaded = Boolean(conversation) && !isLoadingConversation && !conversationError

  const {
    evaluation,
    stale: isEvaluationStale,
    isLoading: isLoadingEvaluation,
    isRegenerating: isRegeneratingEvaluation,
    regenerate: regenerateEvaluation,
    error: evaluationError,
  } = useConversationEvaluation(
    courseId,
    aiExperience.id,
    selectedConversationId || undefined,
    conversationLoaded,
  )

  const currentIndex = sortedConversations.findIndex(
    conv => identifierFor(conv) === selectedIdentifier,
  )
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < sortedConversations.length - 1

  const selectConversation = (conv: StudentConversation) => {
    setSelectedIdentifier(identifierFor(conv))
    setSelectedStudentData(conv)
  }

  // A teacher's own pick; stops auto-select from overriding it.
  const selectByUser = (conv: StudentConversation) => {
    setUserSelected(true)
    selectConversation(conv)
  }

  const handleSelectStudent = (identifier: string) => {
    const conv = sortedConversations.find(c => identifierFor(c) === identifier)
    if (conv) selectByUser(conv)
  }

  const handlePrevious = () => {
    if (hasPrevious) selectByUser(sortedConversations[currentIndex - 1])
  }

  const handleNext = () => {
    if (hasNext) selectByUser(sortedConversations[currentIndex + 1])
  }

  // Default to the first student with a conversation (else the first student).
  // Since the roster depaginates, upgrade a no-conversation pick once a
  // conversation-haver streams in — until the teacher picks for themselves.
  useEffect(() => {
    if (userSelected || sortedConversations.length === 0) return
    const firstWithConversation = sortedConversations.find(conv => Boolean(conv.id))
    const currentHasConversation = Boolean(selectedStudentData?.id)
    if (!selectedIdentifier) {
      selectConversation(firstWithConversation || sortedConversations[0])
    } else if (firstWithConversation && !currentHasConversation) {
      selectConversation(firstWithConversation)
    }
  }, [sortedConversations, selectedIdentifier, selectedStudentData, userSelected])

  const messages: LLMConversationMessage[] =
    conversation?.messages.map(msg => ({
      id: msg.id,
      role: msg.role.toLowerCase() === 'assistant' ? 'Assistant' : 'User',
      text: msg.content || msg.text || '',
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      feedback: msg.feedback ?? [],
    })) || []

  const talkingPointsMet = conversation?.progress?.current ?? 0
  const talkingPointsTotal = conversation?.progress?.total ?? 0
  const milestones = deriveMilestones(conversation?.progress, messages.length)

  const renderConversationMessages = () => {
    if (conversationError) {
      return <AIExperienceError error={conversationError} />
    }
    if (isLoadingConversation) {
      return (
        <View as="div" padding="large" textAlign="center">
          <Spinner renderTitle={I18n.t('Loading conversation')} />
        </View>
      )
    }
    return (
      <MessageThread
        messages={messages}
        conversationId={selectedConversationId ?? null}
        courseId={courseId}
        aiExperienceId={aiExperience.id}
        milestones={milestones}
      />
    )
  }

  const enabledMetrics = (aiExperience.evaluation_metrics || []).filter(m => m.enabled)

  return (
    <View as="div" margin="medium 0">
      <OverallSnapshot snapshot={snapshot} isLoading={isLoadingConversations} />

      {conversationsError && <AIExperienceError error={conversationsError} margin="0 0 medium 0" />}

      {/* Filter row */}
      <Flex justifyItems="space-between" alignItems="end" margin="0 0 medium 0">
        <Flex.Item width="22rem" shouldShrink>
          <StudentConversationPicker
            conversations={sortedConversations}
            selectedIdentifier={selectedIdentifier}
            selectedLabel={selectedStudentData?.student.name}
            isLoading={isLoadingConversations}
            isLoadingMore={isLoadingMore}
            onSelect={handleSelectStudent}
            onSearch={setSearchTerm}
          />
        </Flex.Item>
        <Flex.Item>
          <Flex gap="small">
            <Button
              data-testid="ai-conversations-previous-button"
              onClick={handlePrevious}
              interaction={hasPrevious ? 'enabled' : 'disabled'}
              aria-label={I18n.t('Previous student')}
              renderIcon={<IconArrowOpenStartLine size="x-small" />}
              themeOverride={navButtonTheme}
            >
              {I18n.t('Previous')}
            </Button>
            <Button
              data-testid="ai-conversations-next-button"
              onClick={handleNext}
              interaction={hasNext ? 'enabled' : 'disabled'}
              aria-label={I18n.t('Next student')}
              themeOverride={navButtonTheme}
            >
              <span style={{display: 'flex', alignItems: 'center', gap: '0.375rem'}}>
                {I18n.t('Next')}
                <IconArrowOpenEndLine size="x-small" />
              </span>
            </Button>
          </Flex>
        </Flex.Item>
      </Flex>

      {/* Student name heading */}
      {selectedStudentData && (
        <Heading level="h2" margin="0 0 small 0" data-testid="ai-conversations-student-heading">
          {selectedStudentData.student.name}
        </Heading>
      )}

      {/* Status pills */}
      {selectedIdentifier && hasConversation && conversation && (
        <Flex gap="small" margin="0 0 medium 0">
          <Flex.Item>
            <Pill color={conversation.all_objectives_met ? 'success' : 'info'}>
              <span style={conversation.all_objectives_met ? pillTextSuccessStyle : pillTextStyle}>
                {conversation.all_objectives_met
                  ? I18n.t('Completed %{date}', {
                      date: new Date(conversation.updated_at || '').toLocaleString(),
                    })
                  : I18n.t('In progress')}
              </span>
            </Pill>
          </Flex.Item>
          {talkingPointsTotal > 0 && (
            <Flex.Item>
              <Pill>
                <span style={pillTextStyle}>
                  {I18n.t('%{met}/%{total} talking points', {
                    met: talkingPointsMet,
                    total: talkingPointsTotal,
                  })}
                </span>
              </Pill>
            </Flex.Item>
          )}
          {messages.length > 0 && (
            <Flex.Item>
              <Pill>
                <span style={pillTextStyle}>
                  {I18n.t({one: '1 turn', other: '%{count} turns'}, {count: messages.length})}
                </span>
              </Pill>
            </Flex.Item>
          )}
        </Flex>
      )}

      {/* No conversation state */}
      {selectedIdentifier && !hasConversation && (
        <View as="div" padding="large" textAlign="center">
          <Text size="large" color="secondary">
            {I18n.t('This student has not started a conversation yet')}
          </Text>
        </View>
      )}

      {/* Evaluation insights (left) + conversation card (right) */}
      {selectedIdentifier && hasConversation && (
        <Flex gap="medium" alignItems="stretch">
          {enabledMetrics.length > 0 && (
            <Flex.Item shouldGrow shouldShrink>
              <div style={{height: '100%'}}>
                <EvaluationInsights
                  metrics={aiExperience.evaluation_metrics || []}
                  evaluation={evaluation}
                  isLoading={isLoadingConversation || isLoadingEvaluation}
                  error={evaluationError}
                  stale={isEvaluationStale}
                  isRegenerating={isRegeneratingEvaluation}
                  onRegenerate={regenerateEvaluation}
                />
              </div>
            </Flex.Item>
          )}
          <Flex.Item
            width={enabledMetrics.length > 0 ? '340px' : undefined}
            shouldGrow={enabledMetrics.length === 0}
            shouldShrink={enabledMetrics.length === 0}
          >
            <InstUISettingsProvider theme={roundedTheme}>
              <GradientBorder>
                <ConversationHeader
                  action={
                    <Button
                      data-testid="ai-conversations-expand-button"
                      onClick={() => setIsFocusModeOpen(true)}
                      size="small"
                      color="primary-inverse"
                      withBackground={false}
                      renderIcon={<IconFullScreenLine />}
                      themeOverride={expandButtonTheme}
                    >
                      {I18n.t('Expand')}
                    </Button>
                  }
                />
                <View
                  as="div"
                  padding="medium"
                  background="primary"
                  maxHeight="calc(100vh - 510px)"
                  overflowY="auto"
                >
                  {renderConversationMessages()}
                </View>
              </GradientBorder>
            </InstUISettingsProvider>
          </Flex.Item>
        </Flex>
      )}

      {/* Empty state */}
      {!selectedIdentifier && (
        <View as="div" padding="large" textAlign="center">
          <Text size="large" color="secondary">
            {I18n.t('Select a student to view their conversation')}
          </Text>
        </View>
      )}

      {/* Focus Mode */}
      {selectedIdentifier && hasConversation && conversation && (
        <FocusMode
          isOpen={isFocusModeOpen}
          onClose={() => setIsFocusModeOpen(false)}
          title={aiExperience.title}
        >
          <GradientBorder style={{height: '100%'}} fillHeight>
            <View as="div" overflowX="hidden" overflowY="hidden" height="100%">
              <Flex direction="column" height="100%">
                <Flex.Item>
                  <ConversationHeader />
                </Flex.Item>
                <Flex.Item
                  shouldGrow
                  shouldShrink
                  style={{display: 'flex', flexDirection: 'column', overflow: 'hidden'}}
                >
                  <View
                    as="div"
                    padding="medium"
                    background="primary"
                    height="100%"
                    overflowY="auto"
                    style={{boxSizing: 'border-box'}}
                  >
                    {renderConversationMessages()}
                  </View>
                </Flex.Item>
              </Flex>
            </View>
          </GradientBorder>
        </FocusMode>
      )}
    </View>
  )
}

export default AIConversationsContainer

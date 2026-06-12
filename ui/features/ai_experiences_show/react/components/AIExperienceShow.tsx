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

import React, {useState, useEffect, useRef} from 'react'
import {InstUISettingsProvider} from '@instructure/emotion'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {Heading} from '@instructure/ui-heading'
import {Text} from '@instructure/ui-text'
import {Flex} from '@instructure/ui-flex'
import {Tabs} from '@instructure/ui-tabs'
import {IconMoreLine, IconClockLine} from '@instructure/ui-icons'
import {IconButton, Button} from '@instructure/ui-buttons'
import {Alert} from '@instructure/ui-alerts'
import {Menu} from '@instructure/ui-menu'
import {Modal} from '@instructure/ui-modal'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {showFlashSuccess, showFlashError} from '@instructure/platform-alerts'
import {AIExperience} from '../../types'
import {FileList} from '@canvas/canvas-file-upload/react/FileList'
import LLMConversationView from '@canvas/ai-experiences/react/components/LLMConversationView'
import ConversationLanding from '@canvas/ai-experiences/react/components/ConversationLanding'
import AIExperiencePublishButton from '@canvas/ai-experiences/react/components/AIExperiencePublishButton'
import AIConversationsContainer from '@canvas/ai-experiences/react/components/AIConversationsContainer'
import EvaluationMetricsSection from '@canvas/ai-experiences/react/components/EvaluationMetricsSection'
import {navyButtonTheme, roundedTheme} from '@canvas/ai-experiences/react/brand'
import sanitizeUrl from '@canvas/util/sanitizeUrl'

const I18n = createI18nScope('ai_experiences_show')

interface AIExperienceShowProps {
  aiExperience: AIExperience
}

const AIExperienceShow: React.FC<AIExperienceShowProps> = ({aiExperience}) => {
  const canManage = aiExperience.can_manage
  const indexStatus = aiExperience.context_index_status
  const isIndexing = indexStatus === 'in_progress'
  const isIndexFailed = indexStatus === 'failed'
  const [workflowState, setWorkflowState] = useState(aiExperience.workflow_state)
  const [isShowingChat, setIsShowingChat] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const shouldPreview = params.get('preview') === 'true'
    if (shouldPreview) {
      window.history.replaceState({}, '', window.location.pathname)
    }
    return shouldPreview
  })
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    if (isShowingChat) {
      setIsCheckingSession(false)
      return
    }
    let cancelled = false
    doFetchApi<{id?: string}>({
      path: `/api/v1/courses/${aiExperience.course_id}/ai_experiences/${aiExperience.id}/conversations`,
      method: 'GET',
    })
      .then(({json}) => {
        if (!cancelled) {
          if (json?.id) setIsShowingChat(true)
          setIsCheckingSession(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsCheckingSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [aiExperience.course_id, aiExperience.id, isShowingChat])
  const [selectedTab, setSelectedTab] = useState<number>(0)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const previewCardRef = useRef<HTMLElement>(null)

  const handleEdit = () => {
    window.location.href = sanitizeUrl(
      `/courses/${aiExperience.course_id}/ai_experiences/${aiExperience.id}/edit`,
    )
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await doFetchApi({
        path: `/api/v1/courses/${aiExperience.course_id}/ai_experiences/${aiExperience.id}`,
        method: 'DELETE',
      })
      showFlashSuccess(I18n.t('Knowledge check deleted successfully'))()
      window.location.href = sanitizeUrl(`/courses/${aiExperience.course_id}/ai_experiences`)
    } catch {
      showFlashError(I18n.t('Failed to delete Knowledge check'))()
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
    }
  }

  return (
    <View as="div" maxWidth="1080px" margin="0 auto" padding="medium">
      <View as="div" margin="0 0 large 0">
        <Flex justifyItems="space-between" alignItems="center">
          <Flex.Item shouldGrow shouldShrink>
            <Heading level="h1">{aiExperience.title}</Heading>
          </Flex.Item>
          {canManage && (
            <Flex.Item margin="0 0 0 medium">
              <Flex gap="small">
                <Flex.Item>
                  <AIExperiencePublishButton
                    experienceId={aiExperience.id!}
                    courseId={aiExperience.course_id!}
                    isPublished={workflowState === 'published'}
                    canUnpublish={aiExperience.can_unpublish ?? true}
                    contextReady={aiExperience.context_ready ?? true}
                    indexFailed={isIndexFailed}
                    onPublishChange={setWorkflowState}
                  />
                </Flex.Item>
                <Flex.Item>
                  <Button
                    color="primary"
                    onClick={handleEdit}
                    themeOverride={navyButtonTheme}
                    data-testid="ai-experience-show-edit-button"
                  >
                    {I18n.t('Edit')}
                  </Button>
                </Flex.Item>
                <Flex.Item>
                  <Menu
                    placement="bottom end"
                    trigger={
                      <IconButton
                        screenReaderLabel={I18n.t('Knowledge check settings')}
                        withBackground={false}
                        withBorder={false}
                      >
                        <IconMoreLine />
                      </IconButton>
                    }
                  >
                    <Menu.Item
                      data-testid="ai-experience-show-delete-menu-item"
                      onSelect={() => setIsDeleteModalOpen(true)}
                    >
                      {I18n.t('Delete')}
                    </Menu.Item>
                  </Menu>
                </Flex.Item>
              </Flex>
            </Flex.Item>
          )}
        </Flex>
      </View>

      {aiExperience.description && (
        <View as="div" margin="0 0 medium 0">
          <Text data-testid="ai-experience-show-description-text">
            <span style={{whiteSpace: 'pre-wrap'}}>{aiExperience.description}</span>
          </Text>
        </View>
      )}

      {canManage ? (
        <Tabs onRequestTabChange={(_e, {index}) => setSelectedTab(index)}>
          <Tabs.Panel
            id="knowledge-chat-tab"
            renderTitle={I18n.t('Chat preview')}
            isSelected={selectedTab === 0}
          >
            {isIndexFailed ? (
              <Alert
                variant="error"
                renderCloseButtonLabel={false}
                data-testid="ai-experience-show-index-failed-notice"
              >
                {I18n.t(
                  "Activity couldn't be loaded. A source file has an issue. To try again, remove %{names} from ",
                  {
                    names: aiExperience.failed_context_file_names?.length
                      ? aiExperience.failed_context_file_names.join(', ')
                      : I18n.t('the file'),
                  },
                )}
                <a
                  href={sanitizeUrl(
                    `/courses/${aiExperience.course_id}/ai_experiences/${aiExperience.id}/edit`,
                  )}
                  data-testid="ai-experience-show-index-failed-edit-button"
                >
                  {I18n.t('your configurations')}
                </a>
                {I18n.t('.')}
              </Alert>
            ) : isIndexing ? (
              <View
                as="div"
                padding="large"
                background="secondary"
                borderWidth="small"
                borderRadius="medium"
                textAlign="center"
                data-testid="ai-experience-show-indexing-notice"
              >
                <Flex direction="column" alignItems="center" gap="small">
                  <Flex.Item>
                    <IconClockLine size="medium" color="secondary" aria-hidden="true" />
                  </Flex.Item>
                  <Flex.Item>
                    <Text weight="bold">{I18n.t('Source files are still being processed')}</Text>
                  </Flex.Item>
                  <Flex.Item>
                    <Text color="secondary">
                      {I18n.t(
                        'Preview and Conversations will be available once processing is complete. Check back later.',
                      )}
                    </Text>
                  </Flex.Item>
                </Flex>
              </View>
            ) : isCheckingSession ? null : isShowingChat ? (
              <LLMConversationView
                isOpen={true}
                onClose={() => setIsShowingChat(false)}
                returnFocusRef={previewCardRef}
                courseId={aiExperience.course_id}
                aiExperienceId={aiExperience.id}
                aiExperienceTitle={aiExperience.title}
                facts={aiExperience.facts}
                learningObjectives={aiExperience.learning_objectives}
                scenario={aiExperience.pedagogical_guidance}
              />
            ) : (
              <ConversationLanding
                isTeacherPreview={true}
                onStart={() => setIsShowingChat(true)}
                returnFocusRef={previewCardRef}
              />
            )}
          </Tabs.Panel>

          <Tabs.Panel
            id="conversations-tab"
            renderTitle={I18n.t('Insights')}
            isSelected={selectedTab === 1}
          >
            <AIConversationsContainer
              aiExperience={{
                id: aiExperience.id as string,
                course_id: aiExperience.course_id as string | number,
                title: aiExperience.title,
                can_manage: aiExperience.can_manage,
                description: aiExperience.description,
                facts: aiExperience.facts,
                learning_objectives: aiExperience.learning_objectives,
                pedagogical_guidance: aiExperience.pedagogical_guidance,
                evaluation_metrics: aiExperience.evaluation_metrics,
              }}
              courseId={aiExperience.course_id as string | number}
            />
          </Tabs.Panel>

          <Tabs.Panel
            id="configurations-tab"
            renderTitle={I18n.t('AI guidance')}
            isSelected={selectedTab === 2}
          >
            <InstUISettingsProvider theme={roundedTheme}>
              <View
                as="div"
                margin="medium 0 0 0"
                borderWidth="small"
                borderRadius="medium"
                background="primary"
                padding="medium"
              >
                <View as="div" margin="0 0 medium 0">
                  <Text size="small" color="secondary">
                    {I18n.t(
                      'The completion rules, pedagogical guidance, and sources of the large language model (LLM).',
                    )}
                  </Text>
                </View>

                {aiExperience.learning_objectives?.length > 0 && (
                  <View as="div" margin="0 0 medium 0">
                    <Heading level="h3" margin="0 0 small 0">
                      {I18n.t('Talking points')}
                    </Heading>
                    <View
                      as="ul"
                      margin="0"
                      padding="0 0 0 medium"
                      data-testid="ai-experience-show-learning-objectives-text"
                    >
                      {aiExperience.learning_objectives.map((obj, i) => (
                        <View key={i} as="li">
                          <Text>{obj}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {aiExperience.pedagogical_guidance && (
                  <View as="div" margin="0 0 medium 0">
                    <Heading level="h3" margin="0 0 small 0">
                      {I18n.t('Pedagogical activity guidance')}
                    </Heading>
                    <Text data-testid="ai-experience-show-pedagogical-guidance-text">
                      <span style={{whiteSpace: 'pre-wrap'}}>
                        {aiExperience.pedagogical_guidance}
                      </span>
                    </Text>
                  </View>
                )}

                {aiExperience.facts && (
                  <View as="div" margin="0 0 medium 0">
                    <Heading level="h3" margin="0 0 small 0">
                      {I18n.t('Text source')}
                    </Heading>
                    <Text data-testid="ai-experience-show-facts-text">
                      <span style={{whiteSpace: 'pre-wrap'}}>{aiExperience.facts}</span>
                    </Text>
                  </View>
                )}

                {(aiExperience.context_files?.length ?? 0) > 0 && (
                  <View as="div" margin="medium 0 0 0">
                    <Heading level="h3" margin="0 0 small 0">
                      {I18n.t('File sources')}
                    </Heading>
                    <FileList
                      files={aiExperience.context_files!.filter(
                        f => !aiExperience.failed_context_file_names?.includes(f.display_name),
                      )}
                      uploadingFileNames={new Set()}
                      failedFileNames={new Set(aiExperience.failed_context_file_names ?? [])}
                    />
                  </View>
                )}

                {(aiExperience.evaluation_metrics?.length ?? 0) > 0 && (
                  <View as="div" margin="medium 0 0 0">
                    <EvaluationMetricsSection
                      metrics={aiExperience.evaluation_metrics ?? []}
                      onChange={() => {}}
                      readOnly
                    />
                  </View>
                )}
              </View>
            </InstUISettingsProvider>
          </Tabs.Panel>
        </Tabs>
      ) : (
        <>
          {isCheckingSession ? null : isShowingChat ? (
            <LLMConversationView
              isOpen={true}
              onClose={() => setIsShowingChat(false)}
              returnFocusRef={previewCardRef}
              courseId={aiExperience.course_id}
              aiExperienceId={aiExperience.id}
              aiExperienceTitle={aiExperience.title}
              facts={aiExperience.facts}
              learningObjectives={aiExperience.learning_objectives}
              scenario={aiExperience.pedagogical_guidance}
            />
          ) : (
            <ConversationLanding
              onStart={() => setIsShowingChat(true)}
              returnFocusRef={previewCardRef}
            />
          )}
        </>
      )}

      <Modal
        open={isDeleteModalOpen}
        onDismiss={() => setIsDeleteModalOpen(false)}
        size="small"
        label={I18n.t('Delete Knowledge check')}
        shouldCloseOnDocumentClick={true}
      >
        <Modal.Header>
          <Heading>{I18n.t('Delete Knowledge check')}</Heading>
        </Modal.Header>
        <Modal.Body>
          <Text>
            {I18n.t('Are you sure you want to delete "%{title}"? This action cannot be undone.', {
              title: aiExperience.title,
            })}
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            data-testid="ai-experience-show-delete-cancel-button"
            onClick={() => setIsDeleteModalOpen(false)}
            margin="0 small 0 0"
          >
            {I18n.t('Cancel')}
          </Button>
          <Button
            data-testid="ai-experience-show-delete-confirm-button"
            onClick={handleDelete}
            color="danger"
            interaction={isDeleting ? 'disabled' : 'enabled'}
          >
            {isDeleting ? I18n.t('Deleting...') : I18n.t('Delete')}
          </Button>
        </Modal.Footer>
      </Modal>
    </View>
  )
}

export default AIExperienceShow

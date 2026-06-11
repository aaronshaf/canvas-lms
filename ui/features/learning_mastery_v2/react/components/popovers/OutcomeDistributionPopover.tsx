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

import React, {ReactElement, useEffect, useMemo, useRef, useState} from 'react'
import {Popover} from '@instructure/ui-popover'
import {View} from '@instructure/ui-view'
import {Heading} from '@instructure/ui-heading'
import {Alert} from '@instructure/ui-alerts'
import {Flex} from '@instructure/ui-flex'
import {CloseButton, IconButton} from '@instructure/ui-buttons'
import {IconInfoLine, IconArrowOpenEndLine} from '@instructure/ui-icons'
import {TruncateText} from '@instructure/ui-truncate-text'
import {useScope as createI18nScope} from '@canvas/i18n'
import {sanitizeHTML} from '@canvas/sanitize-html'
import {Outcome, Student} from '@canvas/outcomes/react/types/rollup'
import {MasteryDistributionChart} from '../charts'
import {DisabledMasteryDistributionChart} from '../charts/DisabledMasteryDistributionChart'
import {Text} from '@instructure/ui-text'
import useLMGBContext from '@canvas/outcomes/react/hooks/useLMGBContext'
import OutcomeContextTag from '@canvas/outcome-context-tag/OutcomeContextTag'
import {EditMasteryScaleLink} from '../toolbar/EditMasteryScaleLink'
import {
  OutcomeDistribution,
  RatingDistribution,
} from '@canvas/outcomes/react/types/mastery_distribution'
import {Avatar} from '@instructure/ui-avatar'
import MessageStudentsWhoDialog, {
  type Student as MSWStudent,
  type SendMessageArgs,
} from '@canvas/message-students-dialog/react/MessageStudentsWhoDialog'
import MessageStudentsWhoHelper from '@canvas/grading/messageStudentsWhoHelper'
import {Link} from '@instructure/ui-link'
import TagAsModalManager from '@canvas/differentiation-tags/react/TagAsModal/TagAsModalManager'
import {useAddTagMembership} from '@canvas/differentiation-tags/react/hooks/useAddTagMembership'
import {showFlashError, showFlashSuccess} from '@instructure/platform-alerts'
import {exceedsMasteryScaleLimit} from '@canvas/outcomes/react/utils/masteryScaleLogic'
import {MasteryScaleRestrictionMessage} from '../MasteryScaleRestrictionMessage'

const I18n = createI18nScope('learning_mastery_gradebook')

const POPOVER_CHART_HEIGHT = 280

const getCalculationMethod = (outcome: Outcome): string => {
  switch (outcome.calculation_method) {
    case 'decaying_average':
      return I18n.t('Weighted Average')
    case 'standard_decaying_average':
      return I18n.t('Decaying Average')
    case 'n_mastery':
      return I18n.t('Number of Times')
    case 'highest':
      return I18n.t('Highest')
    case 'latest':
      return I18n.t('Most Recent Score')
    default:
      return I18n.t('Average')
  }
}

export interface OutcomeDistributionPopoverProps {
  outcome: Outcome
  outcomeDistribution?: OutcomeDistribution
  distributionStudents?: Student[]
  isOpen: boolean
  onCloseHandler: () => void
  renderTrigger: ReactElement
  courseId: string
}

const calculatePopoverWidth = (showInfo: boolean, hasSelectedRating: boolean) => {
  if (showInfo && hasSelectedRating) return '60rem'
  if (showInfo || hasSelectedRating) return '40rem'
  return '20rem'
}

const InfoSection: React.FC<{
  outcome: Outcome
  calculationMethod: string
  masteryScaleContextType?: string
  masteryScaleContextId?: string
}> = ({outcome, calculationMethod, masteryScaleContextType, masteryScaleContextId}) => {
  return (
    <Flex
      as="div"
      data-testid="outcome-info-section"
      justifyItems="space-between"
      direction="column"
      height="100%"
    >
      <View display="block" margin="0 0 medium 0">
        <View display="block" width="100%" data-testid="outcome-title">
          <Heading level="h4">{outcome.display_name}</Heading>
        </View>
        {outcome.description && (
          <div
            data-testid="outcome-description"
            style={{wordBreak: 'break-word', overflowWrap: 'break-word'}}
          >
            <View
              display="block"
              width="100%"
              dangerouslySetInnerHTML={{__html: sanitizeHTML(outcome.description)}}
            />
          </div>
        )}
      </View>

      <Flex direction="column" margin="0 0 small 0" gap="medium">
        <View>
          <View as="div">
            <Text weight="bold">{I18n.t('Calculation Method')}</Text>
          </View>
          <Flex gap="x-small" alignItems="center">
            <Text>{calculationMethod}</Text>
            <OutcomeContextTag
              outcomeContextType={outcome.context_type}
              outcomeContextId={outcome.context_id}
            />
          </Flex>
        </View>
        <View>
          <View as="div">
            <Text weight="bold">{I18n.t('Mastery Scale')}</Text>
          </View>
          <Flex gap="x-small" alignItems="center">
            <Text>
              {I18n.t('%{points_possible} Point', {
                points_possible: outcome.points_possible,
              })}
            </Text>
            <OutcomeContextTag
              outcomeContextType={masteryScaleContextType}
              outcomeContextId={masteryScaleContextId}
            />
          </Flex>
        </View>
      </Flex>
    </Flex>
  )
}

const StudentList: React.FC<{students: Student[]}> = ({students}) => {
  return (
    <View as="div" maxHeight="280px" overflowY="auto" padding="0 0 0 medium">
      {students.length > 0 ? (
        <View as="ul" margin="0" padding="0">
          {students.map(student => (
            <View
              as="li"
              key={student.id}
              display="block"
              padding="x-small 0"
              borderWidth="0 0 small 0"
              borderColor="primary"
            >
              <Flex gap="x-small" alignItems="center">
                <Avatar
                  as="div"
                  size="x-small"
                  name={student.display_name || student.name}
                  src={student.avatar_url}
                  data-testid="student-avatar"
                />
                <Text>{student.display_name || student.name}</Text>
              </Flex>
            </View>
          ))}
        </View>
      ) : (
        <Text color="secondary">{I18n.t('No students')}</Text>
      )}
    </View>
  )
}

export const OutcomeDistributionPopover: React.FC<OutcomeDistributionPopoverProps> = ({
  outcome,
  outcomeDistribution,
  distributionStudents,
  isOpen,
  onCloseHandler,
  renderTrigger,
  courseId,
}) => {
  const [showInfo, setShowInfo] = useState(false)
  const [selectedRating, setSelectedRating] = useState<RatingDistribution | null>(null)
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [isDifferentiationTagModalOpen, setIsDifferentiationTagModalOpen] = useState(false)
  const studentListRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setSelectedRating(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (selectedRating) {
      const id = setTimeout(() => {
        studentListRef.current?.focus()
      }, 0)
      return () => clearTimeout(id)
    }
  }, [selectedRating])
  const {accountLevelMasteryScalesFF, allowDifferentiationTags} = useLMGBContext()
  const {mutate: addTagMembership} = useAddTagMembership()
  const calculationMethod = getCalculationMethod(outcome)
  const isScaleRestricted = exceedsMasteryScaleLimit(outcome.ratings?.length ?? 0)

  const selectedStudents = useMemo(() => {
    if (!selectedRating || !distributionStudents) return []
    const studentIds = new Set(selectedRating.student_ids)
    return distributionStudents.filter(student => studentIds.has(student.id))
  }, [selectedRating, distributionStudents])

  const mswStudents = useMemo<MSWStudent[]>(() => {
    return selectedStudents.map(student => ({
      id: student.id,
      name: student.display_name || student.name,
      sortableName: student.display_name || student.name,
      submittedAt: null,
      workflowState: 'graded',
    }))
  }, [selectedStudents])

  const handleSendMessage = React.useCallback(
    ({recipientsIds, subject, body, mediaFile, attachmentIds}: SendMessageArgs) => {
      MessageStudentsWhoHelper.sendMessageStudentsWho(
        recipientsIds,
        subject,
        body,
        `course_${courseId}`,
        mediaFile,
        attachmentIds,
      )
    },
    [courseId],
  )

  const handleBarClick = React.useCallback(
    (label: string, _value: number) => {
      const ratings = outcomeDistribution?.ratings ?? []
      const clickedRating = ratings.find(r => r.description === label)
      if (clickedRating) {
        setSelectedRating(prev =>
          prev?.description === clickedRating.description ? null : clickedRating,
        )
      }
    },
    [outcomeDistribution?.ratings],
  )

  const handleTagCreationSuccess = React.useCallback(
    (groupId: number) => {
      if (!groupId) return

      const studentIds = selectedStudents.map(student => parseInt(student.id, 10))
      if (studentIds.length === 0) return

      addTagMembership(
        {groupId, userIds: studentIds},
        {
          onSuccess: () => showFlashSuccess(I18n.t('Students tagged successfully'))(),
          onError: (error: Error) => showFlashError(error.message)(new Error()),
        },
      )
    },
    [selectedStudents, addTagMembership],
  )

  // When the feature flag is on, use proficiency context for mastery scale
  const masteryScaleContextType = accountLevelMasteryScalesFF
    ? outcome.proficiency_context_type
    : outcome.context_type
  const masteryScaleContextId = accountLevelMasteryScalesFF
    ? outcome.proficiency_context_id
    : outcome.context_id

  const chartComponent = useMemo(
    () => (
      <MasteryDistributionChart
        outcome={outcome}
        distributionData={outcomeDistribution?.ratings ?? []}
        height={POPOVER_CHART_HEIGHT}
        showYAxisGrid={true}
        onBarClick={handleBarClick}
        selectedLabel={selectedRating?.description}
      />
    ),
    [outcome, outcomeDistribution, handleBarClick, selectedRating?.description],
  )

  return (
    <>
      {isMessageModalOpen && selectedStudents.length > 0 && (
        <MessageStudentsWhoDialog
          onClose={() => setIsMessageModalOpen(false)}
          students={mswStudents}
          onSend={handleSendMessage}
          hideCriterionSection={true}
          messageAttachmentUploadFolderId={
            ENV.GRADEBOOK_OPTIONS?.message_attachment_upload_folder_id ?? ''
          }
          userId={ENV.current_user_id ?? ''}
          courseId={courseId}
        />
      )}
      {isDifferentiationTagModalOpen && (
        <TagAsModalManager
          isOpen={isDifferentiationTagModalOpen}
          onClose={() => setIsDifferentiationTagModalOpen(false)}
          onCreationSuccess={handleTagCreationSuccess}
          courseId={Number(courseId)}
        />
      )}
      <Popover
        renderTrigger={renderTrigger}
        isShowingContent={isOpen}
        onShowContent={() => {}}
        onHideContent={onCloseHandler}
        on="click"
        screenReaderLabel={I18n.t('Outcome Distribution for %{outcomeName}', {
          outcomeName: outcome.display_name,
        })}
        shouldContainFocus={true}
        shouldReturnFocus={true}
        shouldCloseOnDocumentClick={true}
        placement="bottom center"
      >
        <Flex
          as="div"
          direction="column"
          padding="small"
          gap="x-small"
          data-testid="outcome-distribution-popover"
          width={`${calculatePopoverWidth(showInfo, !!selectedRating)}`}
        >
          {/* 1. Title Section */}
          <Flex as="div" alignItems="start" margin="0 0 small 0" justifyItems="space-between">
            <Flex.Item shouldShrink={true}>
              <Heading level="h3">
                <TruncateText>{outcome.title}</TruncateText>
              </Heading>
            </Flex.Item>

            <Flex.Item margin="0 xx-small 0 0">
              <CloseButton
                data-testid="outcome-distribution-popover-close-button"
                onClick={onCloseHandler}
                screenReaderLabel={I18n.t('Close')}
              />
            </Flex.Item>
          </Flex>

          {/* 2. Main Content Section */}
          <Flex gap="medium" alignItems="stretch">
            {showInfo && (
              <Flex.Item shouldGrow={true} shouldShrink={true} size="0">
                <InfoSection
                  outcome={outcome}
                  calculationMethod={calculationMethod}
                  masteryScaleContextType={masteryScaleContextType}
                  masteryScaleContextId={masteryScaleContextId}
                />
              </Flex.Item>
            )}

            <Flex.Item shouldGrow={true} shouldShrink={true} size="0">
              {isScaleRestricted ? (
                <Flex direction="column" gap="small">
                  <Flex.Item>
                    <DisabledMasteryDistributionChart
                      outcome={outcome}
                      height={POPOVER_CHART_HEIGHT}
                      isPreview={false}
                    />
                  </Flex.Item>
                  <Flex.Item>
                    <Alert
                      variant="info"
                      hasShadow={false}
                      data-testid="outcome-distribution-scale-restricted-alert"
                    >
                      <MasteryScaleRestrictionMessage />
                    </Alert>
                  </Flex.Item>
                </Flex>
              ) : (
                <View as="div">{chartComponent}</View>
              )}
            </Flex.Item>

            {selectedRating && (
              <Flex.Item shouldGrow={true} shouldShrink={true} size="0">
                <div
                  ref={studentListRef}
                  tabIndex={-1}
                  role="region"
                  aria-label={I18n.t('Students in selected rating')}
                  aria-live="polite"
                  data-testid="student-list-section"
                >
                  <StudentList students={selectedStudents} />
                </div>
              </Flex.Item>
            )}
          </Flex>

          {/* 3. Footer Section */}
          <View as="div" borderWidth="small 0 0 0" borderColor="primary" padding="x-small 0 0 0">
            <Flex justifyItems="space-between">
              <Flex.Item>
                <IconButton
                  data-testid="outcome-distribution-popover-info-button"
                  screenReaderLabel={
                    showInfo
                      ? I18n.t('Hide outcome distribution information')
                      : I18n.t('View outcome distribution information')
                  }
                  size="small"
                  onClick={() => setShowInfo(prev => !prev)}
                  withBackground={showInfo}
                  withBorder={true}
                  color="primary"
                >
                  <IconInfoLine />
                </IconButton>
              </Flex.Item>
              {showInfo && (
                <Flex.Item margin="0 xx-small 0 0">
                  <EditMasteryScaleLink
                    outcome={outcome}
                    accountLevelMasteryScalesFF={accountLevelMasteryScalesFF ?? false}
                    masteryScaleContextType={masteryScaleContextType}
                    masteryScaleContextId={masteryScaleContextId}
                  />
                </Flex.Item>
              )}
              {selectedRating && (
                <Flex.Item>
                  <>
                    {allowDifferentiationTags && (
                      <Link
                        margin="0 xx-small 0 0"
                        onClick={() => setIsDifferentiationTagModalOpen(true)}
                        data-testid="create-differentiation-tag-link"
                        iconPlacement="end"
                        renderIcon={IconArrowOpenEndLine}
                      >
                        <Text size="small">{I18n.t('Create Differentiation Tag')}</Text>
                      </Link>
                    )}
                    <Link
                      onClick={() => setIsMessageModalOpen(true)}
                      data-testid="message-students-link"
                      iconPlacement="end"
                      renderIcon={IconArrowOpenEndLine}
                    >
                      <Text size="small">{I18n.t('Message Students')}</Text>
                    </Link>
                  </>
                </Flex.Item>
              )}
            </Flex>
          </View>
        </Flex>
      </Popover>
    </>
  )
}

/*
 * Copyright (C) 2023 - present Instructure, Inc.
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

import {useCallback, useRef, useEffect} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import type {RubricCriterion} from '@canvas/rubrics/react/types/rubric'
import {possibleString} from '@canvas/rubrics/react/Points'
import {brTagsToNewlines} from '@canvas/util/TextHelper'
import {escapeNewLineText, OutcomeTag} from '@canvas/rubrics/react/RubricAssessment'
import {decodeHTML} from '@canvas/rubrics/react/utils'
import {sanitizeHTML} from '@canvas/sanitize-html'
import classnames from 'classnames'
import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import {Pill} from '@instructure/ui-pill'
import {Tooltip} from '@instructure/ui-tooltip'
import {IconAiColoredSolid, IconDragHandleLine, IconLockLine} from '@instructure/ui-icons'
import {EditCriterionButton} from './EditCriterionButton'
import {DeleteCriterionButton} from './DeleteCriterionButton'
import {DuplicateCriterionButton} from './DuplicateCriterionButton'
import {Draggable} from 'react-beautiful-dnd'
import RegenerateCriteriaButton from './AIGeneratedCriteria/RegenerateCriteriaButton'
import '../drag-and-drop/styles.css'
import {useGetRubricOutcome} from '../../RubricAssessment/queries/useGetRubricOutcome'
import {CriterionRowPopover} from './CriterionRowPopover'
import {RatingScaleAccordion} from './RatingScaleAccordion'
import {Heading} from '@instructure/ui-heading'

const I18n = createI18nScope('rubrics-criteria-row')

type RubricCriteriaRowProps = {
  criterion: RubricCriterion
  freeFormCriterionComments: boolean
  hidePoints: boolean
  isCompact: boolean
  isCompactRatings: boolean
  isCompactOutcome: boolean
  rowIndex: number
  isAIRubricsAvailable: boolean
  isGenerated?: boolean
  isRegenerating?: boolean
  nextIsGenerated?: boolean
  selectedLearningOutcomeId?: string
  selectLearningOutcome: (id: string | undefined) => void
  showCriteriaRegeneration?: boolean
  onDeleteCriterion: () => void
  onDuplicateCriterion: () => void
  onEditCriterion: () => void
  onRegenerateCriterion?: (criterion: RubricCriterion, additionalPrompt: string) => void
  handleMoveCriterion: (index: number, moveValue: number) => void
  criterionIndex: number
  isFirstCriterion: boolean
  isLastCriterion: boolean
  shouldFocus?: boolean
  onFocused?: () => void
}

export const RubricCriteriaRow = ({
  criterion,
  freeFormCriterionComments,
  hidePoints,
  isCompact,
  isCompactRatings,
  isCompactOutcome,
  rowIndex,
  isAIRubricsAvailable,
  isGenerated,
  isRegenerating = false,
  nextIsGenerated,
  selectedLearningOutcomeId,
  selectLearningOutcome,
  showCriteriaRegeneration = false,
  onDeleteCriterion,
  onDuplicateCriterion,
  onEditCriterion,
  onRegenerateCriterion,
  handleMoveCriterion,
  criterionIndex,
  isFirstCriterion,
  isLastCriterion,
  shouldFocus = false,
  onFocused,
}: RubricCriteriaRowProps) => {
  const {data: outcomeTagData} = useGetRubricOutcome(selectedLearningOutcomeId)
  const popoverRef = useRef<HTMLSpanElement>(null)

  const {
    description,
    longDescription,
    outcome,
    learningOutcomeId,
    points,
    masteryPoints,
    ignoreForScoring,
  } = criterion

  const handleMoveUp = useCallback(() => {
    handleMoveCriterion(criterionIndex, -1)
  }, [handleMoveCriterion, criterionIndex])

  const handleMoveDown = useCallback(() => {
    handleMoveCriterion(criterionIndex, 1)
  }, [handleMoveCriterion, criterionIndex])

  // Focus the popover trigger button after a criterion is moved
  useEffect(() => {
    if (shouldFocus && popoverRef.current) {
      // Focus the button inside the span wrapper
      const button = popoverRef.current.querySelector('button')
      if (button) {
        button.focus()
        onFocused?.()
      }
    }
  }, [shouldFocus, onFocused])

  const showRegenerateButtonFreeForm =
    freeFormCriterionComments &&
    showCriteriaRegeneration &&
    onRegenerateCriterion &&
    !learningOutcomeId
  const showRegenerateButtonRatings =
    showCriteriaRegeneration && !learningOutcomeId && onRegenerateCriterion

  return (
    <Draggable draggableId={criterion.id || Date.now().toString()} index={rowIndex - 1}>
      {(provided, snapshot) => {
        return (
          <section
            ref={provided.innerRef}
            className={classnames('draggable', 'criterion-row', {
              dragging: snapshot.isDragging,
              'generated-criterion-row': isGenerated,
              'divided-criterion-row': !isGenerated && !nextIsGenerated,
            })}
            {...provided.draggableProps}
            {...(isCompact ? provided.dragHandleProps : {})}
            data-testid="rubric-criteria-row"
          >
            {/* Row 1: Criterion details */}
            <Flex alignItems="start">
              {/* Drag handle */}
              {!isCompact && (
                <Flex.Item>
                  <View
                    className="criterion-cell criterion-cell--drag"
                    as="div"
                    role="button"
                    {...provided.dragHandleProps}
                    aria-label={I18n.t('Reorder %{criterionName} Criterion', {
                      criterionName: description,
                    })}
                    data-testid="rubric-criteria-row-drag-handle"
                  >
                    <IconDragHandleLine aria-hidden="true" />
                  </View>
                </Flex.Item>
              )}

              {/* Row index */}
              <Flex.Item>
                <View as="div" minWidth="2rem" className="criterion-cell">
                  <Text weight="bold" data-testid="rubric-criteria-row-index">
                    {rowIndex}.
                  </Text>
                </View>
              </Flex.Item>

              {/* Criterion description */}
              <Flex.Item shouldGrow shouldShrink>
                <View as="div" className="criterion-cell criterion-cell--description">
                  {learningOutcomeId ? (
                    <>
                      <View as="div">
                        <OutcomeTag
                          displayName={criterion.description}
                          outcome={outcomeTagData}
                          maxWidth={isCompactOutcome ? '8rem' : undefined}
                          onClick={() => selectLearningOutcome(criterion.learningOutcomeId)}
                        />
                        <Tooltip
                          renderTip={
                            isAIRubricsAvailable
                              ? I18n.t("An outcome can't be edited or regenerated")
                              : I18n.t("An outcome can't be edited")
                          }
                          data-testid={`outcome-tooltip-${criterion.id}`}
                        >
                          <IconLockLine
                            style={{marginLeft: 12}}
                            data-testid={`outcome-lock-icon-${criterion.id}`}
                          />
                        </Tooltip>
                      </View>
                      {outcome?.displayName && (
                        <View
                          as="div"
                          margin="small 0 0 0"
                          data-testid="rubric-criteria-outcome-subtitle"
                        >
                          <Heading level="h4">{outcome?.displayName}</Heading>
                        </View>
                      )}
                      <View as="div" data-testid="rubric-criteria-row-description">
                        {/*
                         * Outcome-linked criteria: longDescription = LearningOutcome.description,
                         * which is RCE-authored Rich HTML sanitized by sanitize_field at the model
                         * layer. Use sanitizeHTML (DOMPurify) here — this IS real Rich HTML.
                         */}
                        <Text
                          dangerouslySetInnerHTML={{__html: sanitizeHTML(longDescription ?? '')}}
                        />
                      </View>
                      {!hidePoints && (
                        <View
                          as="div"
                          margin="small 0 0 0"
                          data-testid="rubric-criteria-row-threshold"
                        >
                          <Text>
                            {I18n.t('Threshold: %{threshold}', {
                              threshold: possibleString(masteryPoints),
                            })}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <View as="div" data-testid="rubric-criteria-row-description">
                        <Flex alignItems="center" gap="x-small">
                          {isGenerated && (
                            <span data-testid="rubric-criteria-row-ai-icon">
                              <IconAiColoredSolid title={I18n.t('Ignite AI Generated')} />
                            </span>
                          )}
                          <Heading
                            margin="xxx-small 0 0 0"
                            level="h4"
                            data-testid="rubric-criteria-row-description-heading"
                          >
                            {description}
                          </Heading>
                        </Flex>
                      </View>
                      <View as="div" data-testid="rubric-criteria-row-long-description">
                        {/*
                         * Non-outcome criteria: longDescription is "htmlified plain text" —
                         * authored in a plain <TextArea> (no RCE), server-stored via
                         * format_message which entity-encodes < / > / & and converts \n → <br/>.
                         * React state may be server-format (entities + <br/>) or local-state-
                         * format (raw chars + \n) depending on whether the rubric has been saved.
                         * Do NOT use sanitizeHTML here — DOMPurify would strip <your initials>
                         * and similar tokens as unknown HTML elements. Instead: brTagsToNewlines
                         * normalises both input shapes to raw text; decodeHTML decodes any entities;
                         * escapeNewLineText re-encodes all angle brackets and restores <br/>.
                         * Contrast with the outcome path above, which IS real Rich HTML.
                         */}
                        <Text
                          dangerouslySetInnerHTML={escapeNewLineText(
                            decodeHTML(brTagsToNewlines(longDescription ?? '')),
                          )}
                        />
                      </View>
                    </>
                  )}
                  {freeFormCriterionComments && (
                    <View
                      as="div"
                      margin="small 0 0 0"
                      data-testid="rubric-criteria-row-freeform-comment"
                    >
                      <Text>
                        {I18n.t(
                          'This area will be used by the assessor to leave comments related to this criterion.',
                        )}
                      </Text>
                    </View>
                  )}
                </View>
              </Flex.Item>

              {/* Points + actions */}
              <Flex.Item>
                <View as="div" className="criterion-cell criterion-cell--actions">
                  {!ignoreForScoring && !hidePoints && (
                    <Pill
                      color="info"
                      disabled={true}
                      themeOverride={{
                        background: 'rgb(3, 116, 181)',
                        infoColor: 'white',
                      }}
                    >
                      <Text data-testid="rubric-criteria-row-points" size="x-small">
                        {possibleString(points)}
                      </Text>
                    </Pill>
                  )}
                  <View as="span" margin={`0 0 0 ${isCompact ? 'x-small' : 'medium'}`}>
                    <CriterionRowPopover
                      ref={popoverRef}
                      isFirstIndex={isFirstCriterion}
                      isLastIndex={isLastCriterion}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      {...(isCompactRatings && {
                        onRegenerate:
                          showRegenerateButtonFreeForm || showRegenerateButtonRatings
                            ? (additionalPrompt: string) =>
                                onRegenerateCriterion(criterion, additionalPrompt)
                            : undefined,
                      })}
                      {...(isCompact && {
                        isLearningOutcome: !!learningOutcomeId,
                        isRegenerating,
                        onEditCriterion,
                        onDeleteCriterion,
                        onDuplicateCriterion,
                      })}
                    />
                  </View>
                  {!isCompact && (
                    <>
                      <View as="span" margin="0 0 0 medium">
                        <EditCriterionButton
                          isLearningOutcome={!!learningOutcomeId}
                          disabled={isRegenerating}
                          onClick={onEditCriterion}
                        />
                      </View>
                      <View as="span" margin="0 0 0 medium">
                        <DeleteCriterionButton
                          disabled={isRegenerating}
                          onClick={onDeleteCriterion}
                        />
                      </View>
                      <View as="span" margin="0 0 0 medium">
                        <DuplicateCriterionButton
                          disabled={isRegenerating}
                          onClick={onDuplicateCriterion}
                        />
                      </View>
                    </>
                  )}
                  {showRegenerateButtonFreeForm && !isCompactRatings && (
                    <View as="div" margin="x-small 0 0 0">
                      <RegenerateCriteriaButton
                        buttonColor="ai-secondary"
                        disabled={isRegenerating}
                        isCriterion={true}
                        onRegenerate={(additionalPrompt: string) =>
                          onRegenerateCriterion(criterion, additionalPrompt)
                        }
                      />
                    </View>
                  )}
                </View>
              </Flex.Item>
            </Flex>

            {/* Row 2: Rating scale (only when not free-form comments) */}
            {!freeFormCriterionComments && !isCompactRatings && (
              <Flex alignItems="start">
                {!isCompact && (
                  <Flex.Item>
                    <View as="div" className="criterion-cell criterion-cell--drag" />
                  </Flex.Item>
                )}
                <Flex.Item>
                  <View as="div" minWidth="2rem" className="criterion-cell" />
                </Flex.Item>
                <Flex.Item shouldGrow shouldShrink>
                  <View
                    as="div"
                    position="relative"
                    className="criterion-cell criterion-cell--ratings"
                  >
                    <RatingScaleAccordion
                      hidePoints={hidePoints}
                      ratings={criterion.ratings}
                      criterionUseRange={criterion.criterionUseRange}
                      isGenerated={isGenerated}
                      addExtraBottomSpacing={showCriteriaRegeneration}
                    />
                    {showRegenerateButtonRatings && (
                      <div style={{position: 'absolute', right: 0, top: 0}}>
                        <View as="span" margin="0 0 0 medium">
                          <RegenerateCriteriaButton
                            buttonColor="ai-secondary"
                            disabled={isRegenerating}
                            isCriterion={true}
                            toolTipText={isRegenerating ? I18n.t('Criteria is regenerating') : ''}
                            onRegenerate={(additionalPrompt: string) =>
                              onRegenerateCriterion(criterion, additionalPrompt)
                            }
                          />
                        </View>
                      </div>
                    )}
                  </View>
                </Flex.Item>
              </Flex>
            )}
          </section>
        )
      }}
    </Draggable>
  )
}

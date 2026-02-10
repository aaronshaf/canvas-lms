/*
 * Copyright (C) 2019 - present Instructure, Inc.
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
import React, {useState} from 'react'
import {arrayOf, bool, func} from 'prop-types'
import CanvasSelect from '@canvas/instui-bindings/react/Select'
import {fillAssessment} from '@canvas/rubrics/react/helpers'
import {useScope as createI18nScope} from '@canvas/i18n'
import {ProficiencyRating} from '@canvas/assignments/graphql/student/ProficiencyRating'
import {Rubric} from '@canvas/assignments/graphql/student/Rubric'
import {RubricAssessment} from '@canvas/assignments/graphql/student/RubricAssessment'
import {RubricAssociation} from '@canvas/assignments/graphql/student/RubricAssociation'
import RubricComponent from '@canvas/rubrics/react/Rubric'
import {Text} from '@instructure/ui-text'
import {ToggleDetails} from '@instructure/ui-toggle-details'
import {Alert} from '@instructure/ui-alerts'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import useStore from './stores/index'
import {RubricAssessmentTray, TraditionalView} from '@canvas/rubrics/react/RubricAssessment'
import {Button} from '@instructure/ui-buttons'

const I18n = createI18nScope('assignments_2')

const ENROLLMENT_STRINGS = {
  StudentEnrollment: I18n.t('Student'),
  TeacherEnrollment: I18n.t('Teacher'),
  TaEnrollment: I18n.t('TA'),
}

// @ts-expect-error
function formatAssessor(assessor) {
  if (!assessor?.name) {
    return I18n.t('Anonymous')
  }

  // @ts-expect-error
  const enrollment = ENROLLMENT_STRINGS[assessor.enrollments?.[0]?.type]
  return enrollment ? `${assessor.name} (${enrollment})` : assessor.name
}

// @ts-expect-error
export default function RubricTab(props) {
  const [rubricTrayOpen, setRubricTrayOpen] = useState(true)
  const displayedAssessment = useStore(state => state.displayedAssessment)

  const rubricAssessments =
    // @ts-expect-error
    props.assessments?.filter(x => x.assessment_type !== 'self_assessment') ?? []

  // @ts-expect-error
  const findAssessmentById = id => {
    // @ts-expect-error
    return rubricAssessments.find(assessment => assessment._id === id)
  }

  // @ts-expect-error
  const onAssessmentChange = updatedAssessment => {
    const newState = {displayedAssessment: updatedAssessment}
    if (enhancedRubricsEnabled) {
      // @ts-expect-error
      newState.isSavingRubricAssessment = true
      setRubricTrayOpen(false)
    }
    useStore.setState(newState)
  }

  // @ts-expect-error
  const assessmentSelectorChanged = assessmentId => {
    const assessment = findAssessmentById(assessmentId)
    const filledAssessment = fillAssessment(props.rubric, assessment || {})
    useStore.setState({displayedAssessment: filledAssessment})
  }

  const hasSubmittedAssessment = rubricAssessments.some(
    // @ts-expect-error
    assessment => assessment.assessor?._id === ENV.current_user.id,
  )

  const rubricAssessmentData = (displayedAssessment?.data ?? []).map(data => {
    const points = data.points
    return {
      ...data,
      criterionId: data.criterion_id,
      // @ts-expect-error
      points: typeof points === 'number' ? points : points.value,
    }
  })

  const rubricData = {
    title: props.rubric?.title,
    ratingOrder: props.rubric?.rating_order,
    freeFormCriterionComments: props.rubric?.free_form_criterion_comments,
    pointsPossible: props.rubric?.points_possible,
    // @ts-expect-error
    criteria: (props.rubric?.criteria || []).map(criterion => {
      return {
        ...criterion,
        longDescription: criterion.long_description,
        criterionUseRange: criterion.criterion_use_range,
        learningOutcomeId: criterion.learning_outcome_id,
        ignoreForScoring: criterion.ignore_for_scoring,
        masteryPoints: criterion.mastery_points,
        // @ts-expect-error
        ratings: criterion.ratings.map(rating => {
          return {
            ...rating,
            longDescription: rating.long_description,
            points: rating.points,
            criterionId: criterion.id,
          }
        }),
      }
    }),
  }

  const enhancedRubricsEnabled = ENV.enhanced_rubrics_enabled
  const showEnhancedRubricPeerReview = props.peerReviewModeEnabled && enhancedRubricsEnabled
  const hidePoints = props.rubricAssociation?.hide_points

  const renderRubricPreview = () => {
    if (!props.rubric) {
      return null
    }

    // @ts-expect-error
    const rubricCriteria = (props.rubric.criteria ?? []).map(criterion => {
      return {
        ...criterion,
        longDescription: criterion.long_description,
        criterionUseRange: criterion.criterion_use_range,
        learningOutcomeId: criterion.learning_outcome_id,
        ignoreForScoring: criterion.ignore_for_scoring,
        masteryPoints: criterion.mastery_points,
        // @ts-expect-error
        ratings: criterion.ratings.map(rating => {
          return {
            ...rating,
            longDescription: rating.long_description,
            points: rating.points,
            criterionId: criterion.id,
          }
        }),
      }
    })

    return enhancedRubricsEnabled ? (
      <TraditionalView
        criteria={rubricCriteria}
        hidePoints={hidePoints}
        isPreviewMode={true}
        isAiEvaluated={props.isAiEvaluated}
        isFreeFormCriterionComments={props.rubric.free_form_criterion_comments}
        onUpdateAssessmentData={() => {}}
        ratingOrder={props.rubric.ratingOrder}
        rubricTitle={props.rubric.title}
        // @ts-expect-error
        rubricAssessmentData={rubricAssessmentData}
      />
    ) : (
      <RubricComponent
        customRatings={props.proficiencyRatings}
        rubric={props.rubric}
        // @ts-expect-error
        rubricAssessment={displayedAssessment}
        rubricAssociation={props.rubricAssociation}
        // @ts-expect-error
        onAssessmentChange={
          props.peerReviewModeEnabled && !hasSubmittedAssessment ? onAssessmentChange : null
        }
        isAiEvaluated={props.isAiEvaluated}
      />
    )
  }

  return (
    <div data-testid="rubric-tab">
      <View as="div" margin="none none medium">
        {props.peerReviewModeEnabled && !hasSubmittedAssessment && (
          <Alert variant="info" hasShadow={false} data-testid="peer-review-rubric-alert">
            {I18n.t(
              'Fill out the rubric below after reviewing the student submission to complete this review.',
            )}
          </Alert>
        )}

        {showEnhancedRubricPeerReview ? (
          <View as="div" margin="small 0 0 0">
            <Button
              onClick={() => setRubricTrayOpen(!rubricTrayOpen)}
              data-testid="view-rubric-button"
            >
              {hasSubmittedAssessment ? I18n.t('View Rubric') : I18n.t('Fill Out Rubric')}
            </Button>
            <RubricAssessmentTray
              currentUserId={ENV.current_user_id ?? ''}
              hidePoints={hidePoints}
              isOpen={rubricTrayOpen}
              isPreviewMode={hasSubmittedAssessment}
              isPeerReview={true}
              isAiEvaluated={props.isAiEvaluated}
              onDismiss={() => setRubricTrayOpen(false)}
              // @ts-expect-error
              rubricAssessmentData={rubricAssessmentData}
              rubric={rubricData}
              viewModeOverride="traditional"
              onSubmit={assessment => {
                const updatedState = {
                  score: assessment.reduce((prev, curr) => prev + (curr.points ?? 0), 0),
                  data: assessment.map(criterionAssessment => {
                    const {points} = criterionAssessment
                    const valid = !Number.isNaN(points)
                    return {
                      ...criterionAssessment,
                      points: {
                        text: points?.toString(),
                        valid,
                        value: points,
                      },
                    }
                  }),
                }
                onAssessmentChange(updatedState)
              }}
            />
          </View>
        ) : (
          <ToggleDetails
            defaultExpanded={true}
            fluidWidth={true}
            data-testid="fill-out-rubric-toggle"
            summary={
              <Text weight="bold">
                {props.peerReviewModeEnabled ? I18n.t('Fill Out Rubric') : I18n.t('View Rubric')}
              </Text>
            }
          >
            {!props.peerReviewModeEnabled && !!rubricAssessments.length && (
              <div style={{marginBottom: '22px', width: '325px'}}>
                <CanvasSelect
                  label={I18n.t('Select Grader')}
                  // @ts-expect-error
                  value={displayedAssessment?._id}
                  data-testid="select-grader-dropdown"
                  onChange={(e, optionValue) => assessmentSelectorChanged(optionValue)}
                >
                  {/* @ts-expect-error */}
                  {rubricAssessments.map(assessment => (
                    <CanvasSelect.Option
                      key={assessment._id}
                      value={assessment._id}
                      id={assessment._id}
                    >
                      {formatAssessor(assessment.assessor)}
                    </CanvasSelect.Option>
                  ))}
                </CanvasSelect>
              </div>
            )}

            {renderRubricPreview()}
          </ToggleDetails>
        )}
      </View>
    </div>
  )
}

RubricTab.propTypes = {
  assessments: arrayOf(RubricAssessment.shape),
  proficiencyRatings: arrayOf(ProficiencyRating.shape),
  rubric: Rubric.shape,
  rubricAssociation: RubricAssociation.shape,
  peerReviewModeEnabled: bool,
  rubricExpanded: bool,
  toggleRubricExpanded: func,
  isAiEvaluated: bool,
}

RubricTab.defaultProps = {
  peerReviewModeEnabled: false,
}

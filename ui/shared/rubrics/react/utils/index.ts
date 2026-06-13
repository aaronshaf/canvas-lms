/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import {decodeHTML as decodeHTMLEntities} from 'entities'
import {brTagsToNewlines} from '@canvas/util/TextHelper'
import type {RubricAssessment} from '@canvas/grading/grading'
import type {
  Rubric,
  RubricAssessmentData,
  RubricAssociation,
  RubricCriterion,
  RubricRating,
} from '@canvas/rubrics/react/types/rubric'

export type RubricUnderscoreType = {
  title: string
  button_display: string
  criteria: RubricUnderscoreCriteria[]
  data?: RubricUnderscoreCriteria[]
  hide_points: boolean
  id: string
  rating_order: string
  free_form_criterion_comments: boolean
  points_possible: number
  public: boolean
  unassessed?: boolean
  workflow_state: string
  can_update?: boolean
}

type RubricUnderscoreCriteria = {
  criterion_use_range: boolean
  description: string
  id: string
  learning_outcome_id?: string
  long_description: string
  ignore_for_scoring?: boolean
  mastery_points?: number
  points: number
  generated?: boolean
  ratings: {
    criterion_id: string
    description: string
    id: string
    long_description: string
    points: number
  }[]
}

export type RubricOutcomeUnderscore = {
  id: string
  display_name: string
}

export type RubricAssessmentUnderscore = RubricAssessment & {
  data: RubricAssessmentDataUnderscore[]
}

export type RubricAssessmentDataUnderscore = {
  id: string
  points: number
  criterion_id: string
  learning_outcome_id?: string
  comments: string
  comments_enabled: boolean
  description: string
}
export const mapRubricUnderscoredKeysToCamelCase = (
  rubric: RubricUnderscoreType,
  rubricOutcomeData: RubricOutcomeUnderscore[] = [],
): Rubric => {
  const rubricOutcomeMap = rubricOutcomeData.reduce(
    (prev, curr) => {
      prev[curr.id] = curr.display_name
      return prev
    },
    {} as Record<string, string>,
  )

  const criteria = rubric.criteria ?? rubric.data ?? []

  return {
    title: rubric.title,
    criteria: criteria.map(criterion => {
      const {learning_outcome_id} = criterion

      return {
        criterionUseRange: criterion.criterion_use_range,
        description: criterion.description,
        id: criterion.id,
        longDescription: criterion.long_description,
        learningOutcomeId: criterion.learning_outcome_id,
        ignoreForScoring: criterion.ignore_for_scoring,
        points: criterion.points,
        masteryPoints: criterion.mastery_points,
        isGenerated: criterion.generated,
        outcome: learning_outcome_id
          ? {
              displayName: rubricOutcomeMap[learning_outcome_id],
              title: criterion.description,
            }
          : undefined,
        ratings: criterion.ratings.map(rating => {
          return {
            criterionId: rating.criterion_id,
            description: rating.description,
            id: rating.id,
            longDescription: rating.long_description,
            points: rating.points,
          }
        }),
      }
    }),
    ratingOrder: rubric.rating_order,
    freeFormCriterionComments: rubric.free_form_criterion_comments,
    pointsPossible: rubric.points_possible,
    public: rubric.public,
    criteriaCount: criteria.length,
    hidePoints: rubric.hide_points,
    id: rubric.id,
    buttonDisplay: rubric.button_display,
    unassessed: rubric.unassessed,
    workflowState: rubric.workflow_state,
    canUpdateRubric: rubric.can_update,
  }
}

// Pure HTML-entity decoder. Unlike `@canvas/util/TextHelper#htmlDecode`,
// this does NOT strip `<tag>`-shaped substrings via regex — preserving
// teacher-typed plain-text tokens like `<your initials>` or `<key concepts>`
// inside rubric criterion descriptions. Decodes entities the server-side
// `format_message` produces (`&lt;`, `&gt;`, `&amp;`, `&#39;`, `&#x27;`,
// `&quot;`, numeric refs) and leaves everything else alone.
export const decodeHTML = (str: string): string => decodeHTMLEntities(str ?? '')

export const mapRubricAssessmentDataUnderscoredKeysToCamelCase = (
  data: RubricAssessmentDataUnderscore[],
): RubricAssessmentData[] => {
  if (!data) return []

  return data.map(assessment => {
    return {
      id: assessment.id,
      points: assessment.points,
      criterionId: assessment.criterion_id,
      learningOutcomeId: assessment.learning_outcome_id,
      comments: assessment.comments,
      commentsEnabled: assessment.comments_enabled,
      description: assessment.description,
    }
  })
}

export type RubricAssociationUnderscore = {
  association_type: 'Assignment' | 'Account' | 'Course'
  association_id: string
  id: string
  rubric_id: string
  use_for_grading: boolean
  hide_points: boolean
  hide_score_total: boolean
  hide_outcome_results: boolean
  can_update?: boolean
  can_delete?: boolean
}
export const mapRubricAssociationUnderscoredKeysToCamelCase = (
  underscoreAssociation: RubricAssociationUnderscore,
): RubricAssociation => {
  return {
    associationType: underscoreAssociation.association_type,
    associationId: underscoreAssociation.association_id,
    id: underscoreAssociation.id,
    hideOutcomeResults: underscoreAssociation.hide_outcome_results,
    hidePoints: underscoreAssociation.hide_points,
    hideScoreTotal: underscoreAssociation.hide_score_total,
    useForGrading: underscoreAssociation.use_for_grading,
    canUpdate: underscoreAssociation.can_update,
    canDelete: underscoreAssociation.can_delete,
  }
}

type ReorderProps = {
  list: RubricRating[]
  startIndex: number
  endIndex: number
}

export const reorderRatingsAtIndex = ({list, startIndex, endIndex}: ReorderProps) => {
  const result = Array.from(list)
  const resultCopy = JSON.parse(JSON.stringify(list))

  const [removed] = result.splice(startIndex, 1)
  result.splice(endIndex, 0, removed)

  result.forEach((item, index) => {
    item.points = resultCopy[index].points
  })

  return result
}

export const longDescriptionForSave = (criterion: RubricCriterion): string | undefined => {
  /**
   * Convert any <br/> tags (any case / whitespace / self-closing variant)
   * back to \n before sending to the server. Server-side format_message
   * re-converts \n to <br/> on save, so this round-trip preserves line
   * breaks. Decode any HTML entities the server stored on the previous
   * save so the wire payload mirrors the user's typed text.
   *
   * Outcome-bound criteria pass through verbatim — their description
   * comes from the LearningOutcome which is already HTML and is read-
   * only here.
   */
  return criterion.outcome
    ? criterion.longDescription
    : brTagsToNewlines(decodeHTML(criterion.longDescription ?? ''))
}

// Back-compat alias for existing callers. The old name described the
// destructive behavior (strip <br/> entirely); the new implementation
// converts <br/> → \n instead of dropping them.
export const stripLongDescriptionBrTags = longDescriptionForSave

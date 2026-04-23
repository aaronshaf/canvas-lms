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

import React, {useMemo} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {IconWarningLine} from '@instructure/ui-icons'
import {View} from '@instructure/ui-view'
import {Link} from '@instructure/ui-link'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import type {
  AssignmentConnection,
  GradebookOptions,
  SortableStudent,
  SubmissionConnection,
  SubmissionGradeChange,
} from '../../../types'
import {AssignmentInformationEmpty} from './AssignmentInformationEmpty'
import {AssignmentSubmissionInfo} from './AssignmentSubmissionInfo'
import {AssignmentScoreDetails} from './AssignmentScoreDetails'
import {AssignmentActions} from './AssignmentActions'

const I18n = createI18nScope('enhanced_individual_gradebook')

export type AssignmentInformationComponentProps = {
  assignment?: AssignmentConnection
  assignmentGroupInvalid?: boolean
  students?: SortableStudent[]
  submissions?: SubmissionConnection[]
  gradebookOptions: GradebookOptions
  handleSetGrades: (updatedSubmissions: SubmissionGradeChange[]) => void
}

export default function AssignmentInformation({
  assignment,
  assignmentGroupInvalid,
  gradebookOptions,
  students = [],
  submissions = [],
  handleSetGrades,
}: AssignmentInformationComponentProps) {
  const {gradedSubmissions, scores} = useMemo(() => {
    const graded = submissions.filter(s => s.score != null)
    return {gradedSubmissions: graded, scores: graded.map(s => s.score as number)}
  }, [submissions])

  if (!assignment) {
    return <AssignmentInformationEmpty />
  }

  const {downloadAssignmentSubmissionsUrl, contextUrl, groupWeightingScheme} = gradebookOptions
  const {htmlUrl} = assignment

  const downloadSubmissionsUrl = (downloadAssignmentSubmissionsUrl ?? '').replace(
    ':assignment',
    assignment.id,
  )
  const showPointsWarning = (assignmentGroupInvalid ?? false) && groupWeightingScheme === 'percent'
  const speedGraderUrl = `${contextUrl}/gradebook/speed_grader?assignment_id=${assignment.id}`

  return (
    <View as="div" data-testid="assignment-information">
      <View as="div" className="row-fluid">
        <View as="div" className="span4">
          <View as="h2">{I18n.t('Assignment Information')}</View>
        </View>
        <View as="div" className="span8">
          <View as="h3" className="assignment_selection">
            <Link href={htmlUrl} isWithinText={false} data-testid="assignment-information-name">
              {assignment.name}
            </Link>
          </View>

          {assignment.omitFromFinalGrade ? (
            <>
              <i className="icon-warning">
                <View as="span" className="screenreader-only">
                  {I18n.t('Warning')}
                </View>
              </i>{' '}
              {I18n.t('This assignment does not count toward the final grade.')}
            </>
          ) : showPointsWarning ? (
            <View as="span" className="text-error">
              <Link
                href={htmlUrl}
                isWithinText={false}
                renderIcon={<IconWarningLine size="x-small" />}
                data-testid="assignment-group-no-points-warning"
              >
                <ScreenReaderContent>{I18n.t('Warning')}</ScreenReaderContent>
                {I18n.t(
                  'Assignments in this group have no points possible and cannot be included in grade calculation.',
                )}
              </Link>
            </View>
          ) : null}

          <View as="div">
            <Link
              href={speedGraderUrl}
              isWithinText={false}
              target="_blank"
              rel="noopener"
              data-testid="assignment-speedgrader-link"
            >
              {I18n.t('See this assignment in speedgrader')}
            </Link>
          </View>

          <AssignmentSubmissionInfo
            assignment={assignment}
            gradedSubmissionsCount={gradedSubmissions.length}
            downloadSubmissionsUrl={downloadSubmissionsUrl}
          />

          <AssignmentScoreDetails assignment={assignment} scores={scores} />

          <AssignmentActions
            assignment={assignment}
            submissions={submissions}
            students={students}
            gradebookOptions={gradebookOptions}
            handleSetGrades={handleSetGrades}
          />
        </View>
      </View>
    </View>
  )
}

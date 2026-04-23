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

import React from 'react'
import type {
  AssignmentConnection,
  GradebookOptions,
  SortableStudent,
  SubmissionConnection,
  SubmissionGradeChange,
} from '../../../types'
import {MessageStudentsWhoAction} from './MessageStudentsWhoAction'
import {DefaultGradeAction} from './DefaultGradeAction'
import {CurveGradesAction} from './CurveGradesAction'
import {GradePostPolicyAction} from './GradePostPolicyAction'

type Props = {
  assignment: AssignmentConnection
  students: SortableStudent[]
  submissions: SubmissionConnection[]
  gradebookOptions: GradebookOptions
  handleSetGrades: (updatedSubmissions: SubmissionGradeChange[]) => void
}

export function AssignmentActions({
  assignment,
  students,
  submissions,
  gradebookOptions,
  handleSetGrades,
}: Props) {
  return (
    <>
      <MessageStudentsWhoAction
        assignment={assignment}
        gradebookOptions={gradebookOptions}
        students={students}
        submissions={submissions}
      />
      <DefaultGradeAction
        assignment={assignment}
        gradebookOptions={gradebookOptions}
        submissions={submissions}
        handleSetGrades={handleSetGrades}
      />
      <CurveGradesAction
        assignment={assignment}
        gradebookOptions={gradebookOptions}
        submissions={submissions}
        handleSetGrades={handleSetGrades}
      />
      <GradePostPolicyAction assignment={assignment} />
    </>
  )
}

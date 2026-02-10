//
// Copyright (C) 2016 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import {map, isNumber, flatten} from 'es-toolkit/compat'
import NaiveRequestDispatch from '@canvas/network/NaiveRequestDispatch/index'

import type {EnrollmentTerm} from './EnrollmentTermInput'

declare const ENV: {ENROLLMENT_TERMS_URL: string}

const listUrl = () => ENV.ENROLLMENT_TERMS_URL

type EnrollmentTermApi = {
  id: number | string
  name?: string
  start_at?: string | null
  end_at?: string | null
  created_at?: string | null
  grading_period_group_id?: number | string | null
}

type EnrollmentTermGroupApi = {
  enrollment_terms: EnrollmentTermApi[]
}

export type RawEnrollmentTerm = Omit<EnrollmentTerm, 'displayName'> & {
  // Added downstream by `presentEnrollmentTerms`.
  displayName?: string
}

const deserializeTerms = (termGroups: EnrollmentTermGroupApi[]): RawEnrollmentTerm[] =>
  flatten(
    map(termGroups, group =>
      map(group.enrollment_terms, term => {
        const groupID = term.grading_period_group_id
        const newGroupID = isNumber(groupID) ? groupID.toString() : groupID
        return {
          id: term.id.toString(),
          name: term.name,
          startAt: term.start_at ? new Date(term.start_at) : null,
          endAt: term.end_at ? new Date(term.end_at) : null,
          createdAt: term.created_at ? new Date(term.created_at) : undefined,
          gradingPeriodGroupId: newGroupID ?? null,
        }
      }),
    ),
  )

export default {
  list(): Promise<RawEnrollmentTerm[]> {
    return new Promise((resolve, reject) => {
      const dispatch = new NaiveRequestDispatch()

      dispatch
        .getDepaginated(listUrl())
        .then((response: EnrollmentTermGroupApi[]) => resolve(deserializeTerms(response)))
        .fail((error: unknown) => reject(error))
    })
  },
}

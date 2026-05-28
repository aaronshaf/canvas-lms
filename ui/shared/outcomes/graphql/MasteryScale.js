/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

import doFetchApi from '@canvas/do-fetch-api-effect'
import pluralize from '@canvas/util/stringPluralize'
import {gql} from '@canvas/apollo-v3'

export const ACCOUNT_OUTCOME_PROFICIENCY_QUERY = gql`
  query GetAccountOutcomeProficiency($contextId: ID!, $proficiencyRatingsCursor: String) {
    context: account(id: $contextId) {
      outcomeProficiency {
        _id
        contextId
        contextType
        proficiencyRatingsConnection(after: $proficiencyRatingsCursor) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            _id
            color
            description
            mastery
            points
          }
        }
      }
    }
  }
`

export const COURSE_OUTCOME_PROFICIENCY_QUERY = gql`
  query GetCourseOutcomeProficiency($contextId: ID!, $proficiencyRatingsCursor: String) {
    context: course(id: $contextId) {
      outcomeProficiency {
        _id
        contextId
        contextType
        proficiencyRatingsConnection(after: $proficiencyRatingsCursor) {
          pageInfo {
            endCursor
            hasNextPage
          }
          nodes {
            _id
            color
            description
            mastery
            points
          }
        }
      }
    }
  }
`

export const saveProficiency = async (contextType, contextId, config) => {
  const {response} = await doFetchApi({
    path: `/api/v1/${pluralize(contextType).toLowerCase()}/${contextId}/outcome_proficiency`,
    method: 'POST',
    body: config,
  })
  return {status: response.status}
}

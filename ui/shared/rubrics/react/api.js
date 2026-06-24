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

/*
  TODO: Duplicated and modified within jsx/outcomes/MasteryScale for use there
        Remove when feature flag account_level_mastery_scales is enabled
*/

import doFetchApi from '@canvas/do-fetch-api-effect'

export const fetchProficiency = accountId =>
  doFetchApi({path: `/api/v1/accounts/${accountId}/outcome_proficiency`})

export const saveProficiency = (accountId, config) =>
  doFetchApi({
    method: 'POST',
    path: `/api/v1/accounts/${accountId}/outcome_proficiency`,
    body: config,
  })

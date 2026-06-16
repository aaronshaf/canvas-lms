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

import {executeQuery} from '@canvas/graphql'
import fakeENV from '@canvas/test-utils/fakeENV'
import {getSubmissions} from '../getSubmissions'

jest.mock('@canvas/graphql', () => ({
  executeQuery: jest.fn(),
}))

const mockExecuteQuery = mocked(executeQuery)

const getBuiltQueryString = () => {
  const documentNode = mockExecuteQuery.mock.calls[0][0]
  return documentNode.loc?.source.body ?? ''
}

describe('getSubmissions', () => {
  beforeEach(() => {
    fakeENV.setup()
    mockExecuteQuery.mockResolvedValue({})
  })

  afterEach(() => {
    fakeENV.teardown()
    jest.clearAllMocks()
  })

  it('requests peer review submissions when the feature is enabled', async () => {
    fakeENV.setup({PEER_REVIEW_ALLOCATION_AND_GRADING_ENABLED: true})

    await getSubmissions({courseId: '1', userIds: ['101']})

    expect(getBuiltQueryString()).toContain('includePeerReviewSubmissions: true')
  })

  it('does not request peer review submissions when the feature is disabled', async () => {
    fakeENV.setup({PEER_REVIEW_ALLOCATION_AND_GRADING_ENABLED: false})

    await getSubmissions({courseId: '1', userIds: ['101']})

    expect(getBuiltQueryString()).toContain('includePeerReviewSubmissions: false')
  })
})

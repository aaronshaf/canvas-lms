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

import {getAssignments, formatAssessmentRequest} from '../helper'
import {createClient} from '@canvas/apollo-v3'

vi.mock('@canvas/apollo-v3', () => ({
  createClient: vi.fn(),
}))

vi.mock('@canvas/i18n', () => ({
  useScope: () => ({t: (key: string) => key}),
}))

const makeNode = (id: string) => ({
  id,
  moduleItems: [
    {
      content: {
        _id: `assignment_${id}`,
        name: `Assignment ${id}`,
        assessmentRequestsForCurrentUser: [],
        peerReviews: {anonymousReviews: false, count: 1, pointsPossible: 10},
        peerReviewSubAssignment: null,
      },
    },
  ],
})

const makeResponse = (
  nodes: ReturnType<typeof makeNode>[],
  hasNextPage: boolean,
  endCursor: string | null,
) => ({
  data: {
    course: {
      modulesConnection: {
        nodes,
        pageInfo: {hasNextPage, endCursor},
      },
    },
  },
})

describe('formatAssessmentRequest', () => {
  const base = {
    id: 'req1',
    anonymousId: 'anon123',
    available: true,
    createdAt: '2026-01-01T00:00:00Z',
    workflowState: 'assigned',
  }

  it('uses anonymizedUser name and id when present (non-anonymous mode)', () => {
    const result = formatAssessmentRequest({
      ...base,
      anonymizedUser: {id: 'user1', name: 'Jane Doe'},
    })
    expect(result.user_name).toBe('Jane Doe')
    expect(result.user_id).toBe('user1')
  })

  it('falls back to "Anonymous Student" when anonymizedUser is null', () => {
    const result = formatAssessmentRequest({...base, anonymizedUser: null})
    expect(result.user_name).toBe('Anonymous Student')
    expect(result.user_id).toBeUndefined()
  })

  it('falls back to "Anonymous Student" when anonymizedUser has no name', () => {
    const result = formatAssessmentRequest({...base, anonymizedUser: {id: 'user1'}})
    expect(result.user_name).toBe('Anonymous Student')
    expect(result.user_id).toBe('user1')
  })
})

describe('getAssignments', () => {
  let mockQuery: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockQuery = vi.fn()
    vi.mocked(createClient).mockReturnValue({query: mockQuery} as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns nodes from a single page', async () => {
    const node = makeNode('1')
    mockQuery.mockResolvedValueOnce(makeResponse([node], false, null))

    const result = await getAssignments('42')

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({variables: {courseId: '42', cursor: null}}),
    )
    expect(result).toEqual([node])
  })

  it('paginates across multiple pages and merges all nodes', async () => {
    const node1 = makeNode('1')
    const node2 = makeNode('2')
    const node3 = makeNode('3')

    mockQuery
      .mockResolvedValueOnce(makeResponse([node1], true, 'cursor_1'))
      .mockResolvedValueOnce(makeResponse([node2], true, 'cursor_2'))
      .mockResolvedValueOnce(makeResponse([node3], false, null))

    const result = await getAssignments('42')

    expect(mockQuery).toHaveBeenCalledTimes(3)
    expect(mockQuery).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({variables: {courseId: '42', cursor: null}}),
    )
    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({variables: {courseId: '42', cursor: 'cursor_1'}}),
    )
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({variables: {courseId: '42', cursor: 'cursor_2'}}),
    )
    expect(result).toEqual([node1, node2, node3])
  })

  it('returns empty array when course has no modules', async () => {
    mockQuery.mockResolvedValueOnce(makeResponse([], false, null))

    const result = await getAssignments('42')

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })

  it('returns empty array when response has no course data', async () => {
    mockQuery.mockResolvedValueOnce({data: {course: null}})

    const result = await getAssignments('42')

    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })
})

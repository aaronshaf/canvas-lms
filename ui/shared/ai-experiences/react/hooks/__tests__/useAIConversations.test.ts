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

import {act, waitFor} from '@testing-library/react'
import {renderHook} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import {
  useStudentConversations,
  useConversationDetail,
  useConversationEvaluation,
} from '../useAIConversations'

describe('useStudentConversations', () => {
  beforeEach(() => {
    fetchMock.restore()
  })

  afterEach(() => {
    fetchMock.restore()
  })

  it('fetches student conversations on mount', async () => {
    const mockConversations = [
      {
        id: 'conv-1',
        user_id: '10',
        student: {id: '10', name: 'John Doe'},
      },
    ]

    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', {
      conversations: mockConversations,
    })

    const {result} = renderHook(() => useStudentConversations('123', '1'))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.conversations).toEqual([])

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.conversations).toEqual(mockConversations)
    expect(result.current.error).toBeNull()
  })

  it('returns snapshot when API includes it', async () => {
    const mockSnapshot = {
      total_objectives: 2,
      completed: 1,
      in_progress: 1,
      not_started: 0,
      evaluation_metrics: [{name: 'Summary', enabled: true, visible_to_learners: false}],
    }

    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', {
      conversations: [],
      snapshot: mockSnapshot,
    })

    const {result} = renderHook(() => useStudentConversations('123', '1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.snapshot).toEqual(mockSnapshot)
  })

  it('returns null snapshot when API omits it', async () => {
    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', {
      conversations: [],
    })

    const {result} = renderHook(() => useStudentConversations('123', '1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.snapshot).toBeNull()
  })

  it('handles API errors', async () => {
    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', 500)

    const {result} = renderHook(() => useStudentConversations('123', '1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.conversations).toEqual([])
    expect(result.current.error).toBeTruthy()
  })

  it('handles empty conversations list', async () => {
    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', {
      conversations: [],
    })

    const {result} = renderHook(() => useStudentConversations('123', '1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.conversations).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('parses snapshot from response', async () => {
    const mockSnapshot = {total_objectives: 3, completed: 6, in_progress: 4, not_started: 5}

    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', {
      conversations: [],
      snapshot: mockSnapshot,
    })

    const {result} = renderHook(() => useStudentConversations('123', '1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.snapshot).toEqual(mockSnapshot)
  })

  it('returns null snapshot when not present in response', async () => {
    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', {
      conversations: [],
    })

    const {result} = renderHook(() => useStudentConversations('123', '1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.snapshot).toBeNull()
  })

  describe('pagination', () => {
    const page1 = {id: 'c1', user_id: '1', student: {id: '1', name: 'Aaron'}}
    const page2 = {id: 'c2', user_id: '2', student: {id: '2', name: 'Beth'}}
    const nextLink =
      '<http://localhost/api/v1/courses/123/ai_experiences/1/ai_conversations?page=2>; rel="next"'

    const mockPagedRoster = () => {
      fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', (url: string) => {
        if (url.includes('page=2')) {
          return {body: {conversations: [page2]}}
        }
        return {
          body: {conversations: [page1], snapshot: {total_objectives: 1}},
          headers: {Link: nextLink},
        }
      })
    }

    it('depaginates in the background, following Link:next until exhausted', async () => {
      mockPagedRoster()
      const {result} = renderHook(() => useStudentConversations('123', '1'))

      // First page shows as soon as it lands...
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // ...then the remaining page is pulled in automatically (no loadMore call).
      await waitFor(() => expect(result.current.conversations).toEqual([page1, page2]))
      await waitFor(() => expect(result.current.isLoadingMore).toBe(false))
      expect(result.current.hasMore).toBe(false)
    })

    it('keeps the first-page snapshot cached as later pages stream in', async () => {
      mockPagedRoster()
      const {result} = renderHook(() => useStudentConversations('123', '1'))

      // Page 2 carries no snapshot; the cached page-1 one must remain.
      await waitFor(() => expect(result.current.conversations).toHaveLength(2))
      expect(result.current.snapshot).toEqual({total_objectives: 1})
    })
  })

  it('sends the search_term query param when searching', async () => {
    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations', {
      conversations: [],
    })

    const {result} = renderHook(() => useStudentConversations('123', '1', 'Smith'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchMock.lastUrl()).toContain('search_term=Smith')
  })
})

describe('useConversationDetail', () => {
  beforeEach(() => {
    fetchMock.restore()
  })

  afterEach(() => {
    fetchMock.restore()
  })

  it('does not fetch when conversationId is undefined', () => {
    const {result} = renderHook(() => useConversationDetail('123', '1', undefined))

    expect(result.current.conversation).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(fetchMock.calls()).toHaveLength(0)
  })

  it('fetches conversation detail when conversationId is provided', async () => {
    const mockConversation = {
      id: 'conv-1',
      messages: [{role: 'assistant', content: 'Hello!'}],
      progress: {status: 'in_progress'},
    }

    fetchMock.get(
      'path:/api/v1/courses/123/ai_experiences/1/ai_conversations/conv-1',
      mockConversation,
    )

    const {result} = renderHook(() => useConversationDetail('123', '1', 'conv-1'))

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.conversation).toEqual(mockConversation)
    expect(result.current.error).toBeNull()
  })

  it('refetches when conversationId changes', async () => {
    const mockConversation1 = {
      id: 'conv-1',
      messages: [{role: 'assistant', content: 'Hello from conv-1!'}],
    }

    const mockConversation2 = {
      id: 'conv-2',
      messages: [{role: 'assistant', content: 'Hello from conv-2!'}],
    }

    fetchMock.get(
      'path:/api/v1/courses/123/ai_experiences/1/ai_conversations/conv-1',
      mockConversation1,
    )
    fetchMock.get(
      'path:/api/v1/courses/123/ai_experiences/1/ai_conversations/conv-2',
      mockConversation2,
    )

    const {result, rerender} = renderHook(
      ({conversationId}) => useConversationDetail('123', '1', conversationId),
      {initialProps: {conversationId: 'conv-1'}},
    )

    await waitFor(() => {
      expect(result.current.conversation?.id).toBe('conv-1')
    })

    rerender({conversationId: 'conv-2'})

    await waitFor(() => {
      expect(result.current.conversation?.id).toBe('conv-2')
    })
  })

  it('clears conversation when conversationId becomes undefined', async () => {
    const mockConversation = {
      id: 'conv-1',
      messages: [],
    }

    fetchMock.get(
      'path:/api/v1/courses/123/ai_experiences/1/ai_conversations/conv-1',
      mockConversation,
    )

    const {result, rerender} = renderHook(
      ({conversationId}: {conversationId?: string}) =>
        useConversationDetail('123', '1', conversationId),
      {initialProps: {conversationId: 'conv-1' as string | undefined}},
    )

    await waitFor(() => {
      expect(result.current.conversation).toBeTruthy()
    })

    rerender({conversationId: undefined})

    expect(result.current.conversation).toBeNull()
  })

  it('handles API errors', async () => {
    fetchMock.get('path:/api/v1/courses/123/ai_experiences/1/ai_conversations/conv-1', 500)

    const {result} = renderHook(() => useConversationDetail('123', '1', 'conv-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.conversation).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})

describe('useConversationEvaluation', () => {
  const evaluationPath = 'path:/api/v1/courses/123/ai_experiences/1/conversations/conv-1/evaluation'

  beforeEach(() => {
    fetchMock.restore()
  })

  afterEach(() => {
    fetchMock.restore()
  })

  it('does not fetch when conversationId is undefined', () => {
    const {result} = renderHook(() => useConversationEvaluation('123', '1', undefined))

    expect(result.current.evaluation).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(fetchMock.calls()).toHaveLength(0)
  })

  it('does not fetch until enabled, then loads once enabled flips true', async () => {
    fetchMock.get(evaluationPath, {
      id: 'conv-1',
      evaluation: {summary: 'Stored eval'},
      stale: false,
    })

    const {result, rerender} = renderHook(
      ({enabled}) => useConversationEvaluation('123', '1', 'conv-1', enabled),
      {initialProps: {enabled: false}},
    )

    // Gated off: the conversation panel hasn't loaded yet, so no request fires.
    expect(fetchMock.calls()).toHaveLength(0)
    expect(result.current.evaluation).toBeNull()

    rerender({enabled: true})

    await waitFor(() => expect(result.current.evaluation).toEqual({summary: 'Stored eval'}))
  })

  it('uses the stored evaluation from the GET without POSTing when one exists', async () => {
    fetchMock.get(evaluationPath, {
      id: 'conv-1',
      evaluation: {summary: 'Stored eval'},
      stale: false,
    })
    fetchMock.post(evaluationPath, 200)

    const {result} = renderHook(() => useConversationEvaluation('123', '1', 'conv-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.evaluation).toEqual({summary: 'Stored eval'})
    expect(result.current.stale).toBe(false)
    expect(fetchMock.called(evaluationPath, {method: 'POST'})).toBe(false)
  })

  it('reports stale:true when the stored evaluation is stale', async () => {
    fetchMock.get(evaluationPath, {
      id: 'conv-1',
      evaluation: {summary: 'Stored eval'},
      stale: true,
    })

    const {result} = renderHook(() => useConversationEvaluation('123', '1', 'conv-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stale).toBe(true)
  })

  it('POSTs to generate when no stored evaluation exists', async () => {
    fetchMock.getOnce(evaluationPath, {id: 'conv-1', evaluation: null, stale: false})
    fetchMock.postOnce(evaluationPath, {id: 'conv-1', evaluation: {summary: 'Generated eval'}})

    const {result} = renderHook(() => useConversationEvaluation('123', '1', 'conv-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.evaluation).toEqual({summary: 'Generated eval'})
    expect(result.current.stale).toBe(false)
    expect(fetchMock.called(evaluationPath, {method: 'POST'})).toBe(true)
  })

  it('regenerate POSTs and clears stale on success', async () => {
    fetchMock.get(evaluationPath, {
      id: 'conv-1',
      evaluation: {summary: 'Stored eval'},
      stale: true,
    })
    fetchMock.post(evaluationPath, {id: 'conv-1', evaluation: {summary: 'Regenerated eval'}})

    const {result} = renderHook(() => useConversationEvaluation('123', '1', 'conv-1'))

    await waitFor(() => {
      expect(result.current.stale).toBe(true)
    })

    await act(async () => {
      await result.current.regenerate()
    })

    expect(result.current.evaluation).toEqual({summary: 'Regenerated eval'})
    expect(result.current.stale).toBe(false)
  })
})

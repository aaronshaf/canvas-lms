/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import {renderHook} from '@testing-library/react'
import {waitFor} from '@testing-library/react'
import useNavigateEntries from '../useNavigateEntries'
import * as useSpeedGraderModule from '../useSpeedGrader'
import * as useStudentEntriesModule from '../useStudentEntries'

vi.mock('../useSpeedGrader')
vi.mock('../useStudentEntries')

describe('useNavigateEntries', () => {
  const mockSetHighlightEntryId = vi.fn()
  const mockSetPageNumber = vi.fn()
  const mockSetExpandedThreads = vi.fn()
  const mockSetFocusSelector = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.location with proper URL object
    const url = new URL('http://localhost?student_id=123')
    delete window.location
    window.location = url

    // Mock URL constructor to return our test URL.
    // Must use function (not arrow) — vitest 4.x requires constructable mocks.
    global.URL = vi.fn(function MockURL() {
      return url
    })

    // Default mock implementations
    vi.spyOn(useSpeedGraderModule, 'default').mockReturnValue({
      isInSpeedGrader: true,
      postMessageEntryIds: vi.fn(),
      handleCommentKeyPress: vi.fn(),
      handleGradeKeyPress: vi.fn(),
    })
  })

  const defaultProps = {
    highlightEntryId: '456',
    setHighlightEntryId: mockSetHighlightEntryId,
    setPageNumber: mockSetPageNumber,
    expandedThreads: [],
    setExpandedThreads: mockSetExpandedThreads,
    setFocusSelector: mockSetFocusSelector,
    discussionID: '789',
    perPage: 20,
    sort: 'asc',
  }

  const mockStudentEntriesQuery = (isLoading = false, entries = []) => {
    vi.spyOn(useStudentEntriesModule, 'useStudentEntries').mockReturnValue({
      data: {
        pages: entries.length > 0 ? [{entries}] : [],
      },
      isLoading,
      refetch: vi.fn(),
    })
  }

  describe('auto-navigation behavior', () => {
    it('should NOT auto-navigate when highlightEntryId is null', async () => {
      const entries = [
        {_id: '100', rootEntryPageNumber: 1},
        {_id: '200', rootEntryPageNumber: 1},
      ]
      mockStudentEntriesQuery(false, entries)

      renderHook(() =>
        useNavigateEntries({
          ...defaultProps,
          highlightEntryId: null,
        }),
      )

      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })
    })

    it('should NOT auto-navigate when highlightEntryId is undefined', async () => {
      const entries = [
        {_id: '100', rootEntryPageNumber: 1},
        {_id: '200', rootEntryPageNumber: 1},
      ]
      mockStudentEntriesQuery(false, entries)

      renderHook(() =>
        useNavigateEntries({
          ...defaultProps,
          highlightEntryId: undefined,
        }),
      )

      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })
    })

    it('should auto-navigate to first entry when highlightEntryId is not found in entries', async () => {
      const entries = [
        {_id: '100', rootEntryPageNumber: 1, rootEntryId: null},
        {_id: '200', rootEntryPageNumber: 1, rootEntryId: null},
      ]
      mockStudentEntriesQuery(false, entries)

      renderHook(() =>
        useNavigateEntries({
          ...defaultProps,
          highlightEntryId: '999', // ID not in the list
        }),
      )

      await waitFor(() => expect(mockSetHighlightEntryId).toHaveBeenCalledWith('100'))
      expect(mockSetPageNumber).toHaveBeenCalledWith(1)
    })

    it('should NOT auto-navigate when highlightEntryId is found in entries', async () => {
      const entries = [
        {_id: '100', rootEntryPageNumber: 1, rootEntryId: null},
        {_id: '200', rootEntryPageNumber: 1, rootEntryId: null},
      ]
      mockStudentEntriesQuery(false, entries)

      renderHook(() =>
        useNavigateEntries({
          ...defaultProps,
          highlightEntryId: '100', // ID that exists in the list
        }),
      )

      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })
    })

    it('should NOT auto-navigate when not in SpeedGrader', async () => {
      vi.spyOn(useSpeedGraderModule, 'default').mockReturnValue({
        isInSpeedGrader: false,
        postMessageEntryIds: vi.fn(),
        handleCommentKeyPress: vi.fn(),
        handleGradeKeyPress: vi.fn(),
      })

      const entries = [
        {_id: '100', rootEntryPageNumber: 1},
        {_id: '200', rootEntryPageNumber: 1},
      ]
      mockStudentEntriesQuery(false, entries)

      renderHook(() =>
        useNavigateEntries({
          ...defaultProps,
          highlightEntryId: '999',
        }),
      )

      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })
    })

    it('should NOT auto-navigate while entries are loading', async () => {
      const entries = [
        {_id: '100', rootEntryPageNumber: 1},
        {_id: '200', rootEntryPageNumber: 1},
      ]
      mockStudentEntriesQuery(true, entries) // isLoading = true

      renderHook(() =>
        useNavigateEntries({
          ...defaultProps,
          highlightEntryId: '999',
        }),
      )

      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })
    })
  })

  describe('postMessage origin validation', () => {
    const dispatchMessage = (origin, subject) => {
      window.dispatchEvent(new MessageEvent('message', {data: {subject}, origin}))
    }

    const renderForMessages = () => {
      const entries = [
        {_id: '100', rootEntryPageNumber: 1, rootEntryId: null},
        {_id: '200', rootEntryPageNumber: 2, rootEntryId: null},
        {_id: '300', rootEntryPageNumber: 3, rootEntryId: null},
      ]
      mockStudentEntriesQuery(false, entries)

      return renderHook(() =>
        useNavigateEntries({
          ...defaultProps,
          highlightEntryId: '200',
        }),
      )
    }

    it('ignores DT.firstStudentReply from a foreign origin', async () => {
      renderForMessages()
      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })

      dispatchMessage('https://evil.example', 'DT.firstStudentReply')

      expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      expect(mockSetPageNumber).not.toHaveBeenCalled()
    })

    it('ignores DT.nextStudentReply from a typosquat origin', async () => {
      renderForMessages()
      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })

      dispatchMessage('http://localhost.evil.example', 'DT.nextStudentReply')

      expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      expect(mockSetPageNumber).not.toHaveBeenCalled()
    })

    it('ignores messages from origin "" (sandbox iframe)', async () => {
      renderForMessages()
      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })

      dispatchMessage('', 'DT.firstStudentReply')

      expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      expect(mockSetPageNumber).not.toHaveBeenCalled()
    })

    it('ignores messages whose data is not an object', async () => {
      renderForMessages()
      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })

      window.dispatchEvent(
        new MessageEvent('message', {data: 'DT.firstStudentReply', origin: window.location.origin}),
      )
      window.dispatchEvent(
        new MessageEvent('message', {data: null, origin: window.location.origin}),
      )

      expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      expect(mockSetPageNumber).not.toHaveBeenCalled()
    })

    it('accepts DT.firstStudentReply from the same Canvas origin', async () => {
      renderForMessages()
      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })

      dispatchMessage(window.location.origin, 'DT.firstStudentReply')

      expect(mockSetHighlightEntryId).toHaveBeenCalledWith('100')
      expect(mockSetPageNumber).toHaveBeenCalledWith(1)
    })

    it('accepts DT.lastStudentReply from the same Canvas origin', async () => {
      renderForMessages()
      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })

      dispatchMessage(window.location.origin, 'DT.lastStudentReply')

      expect(mockSetHighlightEntryId).toHaveBeenCalledWith('300')
      expect(mockSetPageNumber).toHaveBeenCalledWith(3)
    })

    it('accepts DT.nextStudentReplyTab from the same Canvas origin and sets focus', async () => {
      renderForMessages()
      await waitFor(() => {
        expect(mockSetHighlightEntryId).not.toHaveBeenCalled()
      })

      dispatchMessage(window.location.origin, 'DT.nextStudentReplyTab')

      expect(mockSetFocusSelector).toHaveBeenCalledWith('#next-in-speedgrader')
      expect(mockSetHighlightEntryId).toHaveBeenCalledWith('300')
    })
  })
})

/*
 * Copyright (C) 2022 - present Instructure, Inc.
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
import useCourseAlignmentStats from '../useCourseAlignmentStats'
import {createCache} from '@canvas/apollo-v3'
import {renderHook, act} from '@testing-library/react'
import {courseAlignmentStatsMocks} from '../../../mocks/Management'
import {MockedProvider} from '@apollo/client/testing'
import OutcomesContext from '../../contexts/OutcomesContext'
import {showFlashAlert} from '@instructure/platform-alerts'

vi.mock('@instructure/platform-alerts', async () => {
  const actual = await vi.importActual('@instructure/platform-alerts')
  return {
    ...actual,
    showFlashAlert: vi.fn(),
  }
})

describe('useCourseAlignmentStats', () => {
  let cache
  const refetchMocks = [...courseAlignmentStatsMocks(), ...courseAlignmentStatsMocks({id: '2'})]
  const getStats = result => {
    const {
      totalOutcomes,
      alignedOutcomes,
      totalAlignments,
      totalArtifacts,
      alignedArtifacts,
      artifactAlignments,
    } = result.current.data.course.outcomeAlignmentStats
    return [
      totalOutcomes,
      alignedOutcomes,
      totalAlignments,
      totalArtifacts,
      alignedArtifacts,
      artifactAlignments,
    ]
  }

  beforeEach(() => {
    vi.useFakeTimers()
    cache = createCache()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  const createWrapper =
    (mocks = courseAlignmentStatsMocks(), contextId = '1', contextType = 'Course') =>
    ({children}) => (
      <MockedProvider cache={cache} mocks={mocks}>
        <OutcomesContext.Provider value={{env: {contextType, contextId}}}>
          {children}
        </OutcomesContext.Provider>
      </MockedProvider>
    )
  const wrapper = createWrapper()

  it('loads properly course alignments stats', async () => {
    const {result} = renderHook(() => useCourseAlignmentStats(), {
      wrapper,
    })
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()
    await act(async () => vi.runOnlyPendingTimers())
    expect(result.current.loading).toBe(false)
    expect(getStats(result)).toEqual([2, 1, 4, 5, 3, 3])
  })

  it('displays flash error message when stats fail to load', async () => {
    const {result} = renderHook(() => useCourseAlignmentStats(), {
      wrapper: createWrapper([]),
    })
    await act(async () => vi.runOnlyPendingTimers())
    expect(showFlashAlert).toHaveBeenCalledWith({
      message: 'An error occurred while loading course alignment statistics.',
      type: 'error',
    })
    expect(result.current.error).not.toBe(null)
  })

  it('should refetch data if query for the same course id is run a second time', async () => {
    let setContextId
    const ContextWrapper = ({children}) => {
      const [contextId, _setContextId] = React.useState('1')
      setContextId = _setContextId
      return (
        <MockedProvider cache={cache} mocks={refetchMocks}>
          <OutcomesContext.Provider value={{env: {contextType: 'Course', contextId}}}>
            {children}
          </OutcomesContext.Provider>
        </MockedProvider>
      )
    }
    const hook = renderHook(() => useCourseAlignmentStats(), {
      wrapper: ContextWrapper,
    })
    expect(hook.result.current.loading).toBe(true)
    expect(hook.result.current.data).toBeUndefined()
    await act(async () => vi.runOnlyPendingTimers())
    expect(hook.result.current.loading).toBe(false)
    expect(getStats(hook.result)).toEqual([2, 1, 4, 5, 3, 3])

    // fetch a different course to force hook rerender
    // then refetch the original course to test refetch
    act(() => setContextId('2'))
    act(() => setContextId('1'))
    expect(hook.result.current.loading).toBe(true)
    await act(async () => vi.runOnlyPendingTimers())
    expect(hook.result.current.loading).toBe(false)
    expect(getStats(hook.result)).toEqual([12, 11, 14, 15, 13, 13])
  })
})

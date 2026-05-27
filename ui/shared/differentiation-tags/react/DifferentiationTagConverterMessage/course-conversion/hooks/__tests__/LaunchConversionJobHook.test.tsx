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

import {act, renderHook, waitFor} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import useLaunchConversionJobHook, {
  CONVERSION_JOB_COMPLETE,
  CONVERSION_JOB_FAILED,
  CONVERSION_JOB_NOT_STARTED,
  CONVERSION_JOB_QUEUED,
  CONVERSION_JOB_RUNNING,
} from '../LaunchConversionJobHook'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('useLaunchConversionJobHook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    server.resetHandlers()
    server.use(
      http.put('/api/v1/courses/1/convert_tag_overrides', () => {
        return new HttpResponse(null, {status: 204})
      }),
      http.get('/api/v1/courses/1/convert_tag_overrides/status', () => {
        return HttpResponse.json({progress: 0, workflow_state: 'queued'})
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return initial state', () => {
    const {result} = renderHook(() => useLaunchConversionJobHook('1', false))

    expect(result.current.launchConversionJob).toBeInstanceOf(Function)
    expect(result.current.conversionJobState).toBe(CONVERSION_JOB_NOT_STARTED)
    expect(result.current.conversionJobProgress).toBe(0)
    expect(result.current.conversionJobError).toBeNull()
  })

  it('should update conversion job state when launchConversionJob is called', async () => {
    const {result} = renderHook(() => useLaunchConversionJobHook('1', false))

    await act(async () => {
      await result.current.launchConversionJob()
    })

    expect(result.current.conversionJobState).toBe(CONVERSION_JOB_QUEUED)
    expect(result.current.conversionJobProgress).toBe(0)
  })

  it('sets failed state when launchConversionJob PUT fails', async () => {
    server.use(http.put('/api/v1/courses/1/convert_tag_overrides', () => HttpResponse.error()))
    const {result} = renderHook(() => useLaunchConversionJobHook('1', false))

    await act(async () => {
      await result.current.launchConversionJob()
    })

    expect(result.current.conversionJobState).toBe(CONVERSION_JOB_FAILED)
  })

  it('returns conversion job progress and state when polling job progress', async () => {
    server.use(
      http.get('/api/v1/courses/1/convert_tag_overrides/status', () => {
        return HttpResponse.json({progress: 30, workflow_state: 'running'})
      }),
    )
    const {result} = renderHook(() => useLaunchConversionJobHook('1', true))

    await vi.advanceTimersByTimeAsync(1000)

    await waitFor(() => {
      expect(result.current.conversionJobState).toBe(CONVERSION_JOB_RUNNING)
      expect(result.current.conversionJobProgress).toBe(30)
    })
  })

  it('returns success state when job completes', async () => {
    server.use(
      http.get('/api/v1/courses/1/convert_tag_overrides/status', () => {
        return HttpResponse.json({progress: 100, workflow_state: 'completed'})
      }),
    )
    const {result} = renderHook(() => useLaunchConversionJobHook('1', true))

    await vi.advanceTimersByTimeAsync(1000)

    await waitFor(() => {
      expect(result.current.conversionJobState).toBe(CONVERSION_JOB_COMPLETE)
      expect(result.current.conversionJobProgress).toBe(100)
    })
  })

  it('returns error state when job fails', async () => {
    server.use(
      http.get('/api/v1/courses/1/convert_tag_overrides/status', () => {
        return HttpResponse.error()
      }),
    )
    const {result} = renderHook(() => useLaunchConversionJobHook('1', true))

    await vi.advanceTimersByTimeAsync(1000)

    await waitFor(() => {
      expect(result.current.conversionJobState).toBe(CONVERSION_JOB_FAILED)
      expect(result.current.conversionJobError).toBe(
        'An error occurred while fetching job progress.',
      )
      expect(result.current.conversionJobProgress).toBe(0)
    })
  })
})

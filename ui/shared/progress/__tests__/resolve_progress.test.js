/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import resolveProgress from '../resolve_progress'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('resolveProgress', () => {
  it('resolves immediately when already completed', async () => {
    const result = await resolveProgress({
      workflow_state: 'completed',
      results: {foo: 'bar'},
      url: '/api/v1/progress/1',
    })
    expect(result).toEqual({foo: 'bar'})
  })

  it('rejects immediately when failed', async () => {
    await expect(
      resolveProgress({
        workflow_state: 'failed',
        message: 'something went wrong',
        url: '/api/v1/progress/1',
      }),
    ).rejects.toBe('something went wrong')
  })

  it('polls until completed', async () => {
    server.use(
      http.get('/api/v1/progress/1', () =>
        HttpResponse.json({
          workflow_state: 'completed',
          results: {done: true},
          url: '/api/v1/progress/1',
        }),
      ),
    )

    const result = await resolveProgress({
      workflow_state: 'running',
      url: '/api/v1/progress/1',
    })
    expect(result).toEqual({done: true})
  })

  it('polls through queued→running→completed states', async () => {
    let callCount = 0
    server.use(
      http.get('/api/v1/progress/1', () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json({workflow_state: 'running', url: '/api/v1/progress/1'})
        }
        return HttpResponse.json({
          workflow_state: 'completed',
          results: {callCount},
          url: '/api/v1/progress/1',
        })
      }),
    )

    const result = await resolveProgress({
      workflow_state: 'queued',
      url: '/api/v1/progress/1',
    })
    expect(result).toEqual({callCount: 2})
  })
})

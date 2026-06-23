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

import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import DiscussionTopic from '../DiscussionTopic'

vi.mock('@instructure/platform-alerts', async () => {
  const actual = await vi.importActual('@instructure/platform-alerts')
  return {
    ...actual,
    showFlashError: vi.fn(() => vi.fn()),
  }
})

import {showFlashError} from '@instructure/platform-alerts'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
})
afterAll(() => server.close())

describe('DiscussionTopic#duplicate', () => {
  it('POSTs to the duplicate URL and passes {json} to the callback', async () => {
    const topic = new DiscussionTopic({id: 42})
    const duplicated = {id: 99, title: 'Copy of Topic'}
    server.use(
      http.post('/api/v1/courses/7/discussion_topics/42/duplicate', () =>
        HttpResponse.json(duplicated, {
          headers: {'Content-Type': 'application/json; charset=utf-8'},
        }),
      ),
    )

    const callback = vi.fn()
    await topic.duplicate('course', '7', callback)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0].json).toEqual(duplicated)
  })

  it('calls showFlashError on server error', async () => {
    const topic = new DiscussionTopic({id: 42})
    const flashHandler = vi.fn()
    showFlashError.mockReturnValue(flashHandler)

    server.use(
      http.post(
        '/api/v1/courses/7/discussion_topics/42/duplicate',
        () => new HttpResponse(null, {status: 500}),
      ),
    )

    const callback = vi.fn()
    await topic.duplicate('course', '7', callback).catch(() => {})

    expect(showFlashError).toHaveBeenCalled()
    expect(callback).not.toHaveBeenCalled()
  })
})

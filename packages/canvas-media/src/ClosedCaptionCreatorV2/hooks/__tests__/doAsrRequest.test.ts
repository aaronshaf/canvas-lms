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

import {HttpResponse, http} from 'msw'
import {setupServer} from 'msw/node'
import {beforeEach, describe, expect, it} from 'vitest'
import {doAsrRequest} from '../doAsrRequest'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('doAsrRequest', () => {
  let capturedRequest: Request | undefined

  beforeEach(() => {
    capturedRequest = undefined
    server.use(
      http.post(/\/api\/v1\/(media_attachments|media_objects)\/.+\/asr/, async ({request}) => {
        capturedRequest = request
        return HttpResponse.json({}, {status: 200})
      }),
    )
  })

  it('calls the attachment URL when attachmentId is provided', async () => {
    await doAsrRequest({attachmentId: '42'}, 'en')

    expect(new URL(capturedRequest!.url).pathname).toBe('/api/v1/media_attachments/42/asr')
  })

  it('calls the media object URL when mediaObjectId is provided', async () => {
    await doAsrRequest({mediaObjectId: 'm-abc'}, 'es')

    expect(new URL(capturedRequest!.url).pathname).toBe('/api/v1/media_objects/m-abc/asr')
  })

  it('prefers attachmentId over mediaObjectId when both are provided', async () => {
    await doAsrRequest({attachmentId: '42', mediaObjectId: 'm-abc'}, 'en')

    expect(new URL(capturedRequest!.url).pathname).toBe('/api/v1/media_attachments/42/asr')
  })

  it('uses POST method', async () => {
    await doAsrRequest({attachmentId: '42'}, 'en')

    expect(capturedRequest!.method).toBe('POST')
  })

  it('sends JSON Content-Type header', async () => {
    await doAsrRequest({attachmentId: '42'}, 'en')

    expect(capturedRequest!.headers.get('Content-Type')).toBe('application/json')
  })

  it('sends locale in the JSON body', async () => {
    await doAsrRequest({attachmentId: '42'}, 'fr')

    const body = await capturedRequest!.json()
    expect(body).toEqual({locale: 'fr'})
  })

  it('resolves on a 2xx response', async () => {
    await expect(doAsrRequest({attachmentId: '42'}, 'en')).resolves.toBeUndefined()
  })

  it('rejects on a non-ok response', async () => {
    server.use(
      http.post(/\/api\/v1\/(media_attachments|media_objects)\/.+\/asr/, () =>
        HttpResponse.json({error: 'bad request'}, {status: 400}),
      ),
    )

    await expect(doAsrRequest({attachmentId: '42'}, 'en')).rejects.toThrow(
      'Request failed with status code 400',
    )
  })

  it('throws when neither attachmentId nor mediaObjectId is provided', async () => {
    await expect(doAsrRequest({}, 'en')).rejects.toThrow(
      'Either mediaObjectId or attachmentId must be provided',
    )
  })
})

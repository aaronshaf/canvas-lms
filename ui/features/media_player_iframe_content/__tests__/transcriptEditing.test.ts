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
import {createOnTranscriptEdit, onConfirmEditChanges} from '../transcriptEditing'
import * as globalUtils from '@canvas/util/globalUtils'

vi.mock('@canvas/util/globalUtils', () => ({reloadWindow: vi.fn()}))

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('createOnTranscriptEdit', () => {
  const ATTACHMENT_ID = 'att-42'
  const JWT = 'test-jwt-token'

  it('POSTs to the correct URL', async () => {
    let capturedMethod: string | undefined
    let capturedPath: string | undefined
    server.use(
      http.post(`/media_attachments/${ATTACHMENT_ID}/media_tracks`, ({request}) => {
        capturedMethod = request.method
        capturedPath = new URL(request.url).pathname
        return new HttpResponse(null, {status: 200})
      }),
    )
    const handler = createOnTranscriptEdit(ATTACHMENT_ID, JWT)
    await handler(new FormData())
    expect(capturedMethod).toBe('POST')
    expect(capturedPath).toBe(`/media_attachments/${ATTACHMENT_ID}/media_tracks`)
  })

  it('sends Authorization: Bearer <jwt> header', async () => {
    let capturedAuth: string | null = null
    server.use(
      http.post(`/media_attachments/${ATTACHMENT_ID}/media_tracks`, ({request}) => {
        capturedAuth = request.headers.get('Authorization')
        return new HttpResponse(null, {status: 200})
      }),
    )
    const handler = createOnTranscriptEdit(ATTACHMENT_ID, JWT)
    await handler(new FormData())
    expect(capturedAuth).toBe(`Bearer ${JWT}`)
  })

  it('resolves to undefined on success', async () => {
    server.use(
      http.post(
        `/media_attachments/${ATTACHMENT_ID}/media_tracks`,
        () => new HttpResponse(null, {status: 200}),
      ),
    )
    const handler = createOnTranscriptEdit(ATTACHMENT_ID, JWT)
    await expect(handler(new FormData())).resolves.toBeUndefined()
  })

  it('rejects on server error', async () => {
    server.use(
      http.post(
        `/media_attachments/${ATTACHMENT_ID}/media_tracks`,
        () => new HttpResponse(null, {status: 500}),
      ),
    )
    const handler = createOnTranscriptEdit(ATTACHMENT_ID, JWT)
    const rejected = await handler(new FormData()).then(
      () => false,
      () => true,
    )
    expect(rejected).toBe(true)
  })
})

describe('onConfirmEditChanges', () => {
  it('reloads the window', () => {
    onConfirmEditChanges()
    expect(globalUtils.reloadWindow).toHaveBeenCalledTimes(1)
  })
})

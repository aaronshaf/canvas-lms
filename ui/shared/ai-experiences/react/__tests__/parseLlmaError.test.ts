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

import {parseLlmaError} from '../parseLlmaError'

const FALLBACK = 'Something went wrong. Please try again.'

interface FakeErrorOpts {
  body?: unknown
  contentType?: string | null
  headers?: Record<string, string>
}

function fetchError(opts: FakeErrorOpts = {}) {
  const {body, contentType = 'application/json', headers = {}} = opts
  const map = new Map<string, string>(Object.entries(headers))
  if (contentType !== null) map.set('Content-Type', contentType)
  const response = {
    headers: {get: (k: string) => map.get(k) ?? null},
    json: () => Promise.resolve(body),
    clone() {
      return this
    },
  }
  return {response}
}

describe('parseLlmaError', () => {
  it('pulls message, code, reference_id, and retryable from a JSON body', async () => {
    const err = fetchError({
      body: {
        error: 'This conversation could not be found.',
        code: 'conversation_not_found',
        reference_id: 'abc-123',
        retryable: false,
      },
    })
    expect(await parseLlmaError(err, FALLBACK)).toEqual({
      message: 'This conversation could not be found.',
      code: 'conversation_not_found',
      referenceId: 'abc-123',
      retryable: false,
    })
  })

  it('falls back to the X-Request-Context-Id header when the body has no reference_id', async () => {
    const err = fetchError({
      body: {error: 'boom', code: 'internal_error', retryable: true},
      headers: {'X-Request-Context-Id': 'hdr-999'},
    })
    const result = await parseLlmaError(err, FALLBACK)
    expect(result.referenceId).toBe('hdr-999')
    expect(result.code).toBe('internal_error')
    expect(result.retryable).toBe(true)
  })

  it('uses the fallback message for a non-JSON response, finds the header id, and is retryable', async () => {
    const err = fetchError({contentType: 'text/html', headers: {'X-Request-Context-Id': 'hdr-1'}})
    const result = await parseLlmaError(err, FALLBACK)
    expect(result).toEqual({
      message: FALLBACK,
      code: undefined,
      referenceId: 'hdr-1',
      retryable: true,
    })
  })

  it('degrades gracefully (and retryable) when there is no response at all', async () => {
    expect(await parseLlmaError(new Error('network down'), FALLBACK)).toEqual({
      message: FALLBACK,
      code: undefined,
      referenceId: undefined,
      retryable: true,
    })
  })

  it('uses the fallback when JSON parsing throws', async () => {
    const response = {
      headers: {get: () => 'application/json'},
      json: () => Promise.reject(new Error('bad json')),
      clone() {
        return this
      },
    }
    const result = await parseLlmaError({response}, FALLBACK)
    expect(result.message).toBe(FALLBACK)
  })
})

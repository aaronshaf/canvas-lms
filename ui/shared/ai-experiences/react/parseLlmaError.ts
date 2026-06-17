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

import {LlmaError} from '../types'
import {messageForCode} from './llmaErrorMessages'

/**
 * Normalize an error thrown by `doFetchApi` into the fields the UI surfaces.
 *
 * `doFetchApi` rejects with a `FetchApiError` carrying the raw Fetch `Response` as
 * `err.response`, and it throws BEFORE reading the body — so the body is still
 * available here but is NOT pre-parsed. We read it (guarding on Content-Type),
 * pulling the AI-Experiences error shape `{ error, code, reference_id }`. The
 * reference id also rides on the `X-Request-Context-Id` response header (present on
 * every Canvas response), which is the reliable fallback when there's no JSON body.
 *
 * Always resolves (never throws): a non-JSON/empty/opaque error degrades to the
 * provided fallback message with whatever reference id we can find.
 */
export async function parseLlmaError(err: unknown, fallbackMessage: string): Promise<LlmaError> {
  const response = (err as {response?: Response} | null)?.response

  let body: {error?: string; code?: string; reference_id?: string; retryable?: boolean} | null =
    null
  if (response && typeof response.json === 'function') {
    const contentType = response.headers?.get?.('Content-Type') ?? ''
    if (/application\/json/i.test(contentType)) {
      try {
        body = await response.clone().json()
      } catch {
        body = null
      }
    }
  }

  const referenceId =
    body?.reference_id ?? response?.headers?.get?.('X-Request-Context-Id') ?? undefined

  return {
    // Prefer the frontend's localized, code-specific copy; then the server's
    // generic message; then the per-surface localized fallback.
    message: messageForCode(body?.code) ?? body?.error ?? fallbackMessage,
    code: body?.code ?? undefined,
    referenceId: referenceId ?? undefined,
    // Coded Canvas errors always carry `retryable`. When it's absent (a non-JSON or
    // network failure that never reached Canvas), treat it as transient → retryable.
    retryable: typeof body?.retryable === 'boolean' ? body.retryable : true,
  }
}

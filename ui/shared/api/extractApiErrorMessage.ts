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

const stripValidationPrefix = (msg: string): string => msg.replace(/^Validation failed:\s*/i, '')

const messageFromEntry = (entry: unknown): string | null => {
  if (typeof entry === 'string') return entry
  if (
    entry &&
    typeof entry === 'object' &&
    typeof (entry as {message?: unknown}).message === 'string'
  ) {
    return (entry as {message: string}).message
  }
  return null
}

// Returns the first user-friendly error message found in a parsed Canvas API
// validation error body, or null if none is found. Handles the three shapes
// Rails commonly emits for these endpoints:
//   { errors: { field: [{ message, attribute, type }, ...] } }   (Api::Errors::Reporter)
//   { field: ["..."] }                                            (ActiveModel#to_json)
//   { invalid_record: ["Validation failed: ..."] }                (RecordInvalid rescued into errors.add)
//
// When `restrictKeys` is provided, only fields in that list are considered —
// useful for the legacy edit page where most field errors are already attached
// to form inputs and only a few error keys (override-related) are silently
// dropped.
export function extractApiErrorMessage(
  body: unknown,
  {restrictKeys}: {restrictKeys?: readonly string[]} = {},
): string | null {
  if (!body || typeof body !== 'object') return null

  const candidates = (body as {errors?: unknown}).errors ?? body
  if (!candidates || typeof candidates !== 'object') return null

  const entries = Object.entries(candidates as Record<string, unknown>)
  for (const [key, value] of entries) {
    if (restrictKeys && !restrictKeys.includes(key)) continue
    const list = Array.isArray(value) ? value : [value]
    for (const entry of list) {
      const message = messageFromEntry(entry)
      if (message) return stripValidationPrefix(message)
    }
  }
  return null
}

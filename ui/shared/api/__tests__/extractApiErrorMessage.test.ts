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

import {extractApiErrorMessage} from '../extractApiErrorMessage'

describe('extractApiErrorMessage', () => {
  it('returns null for non-object inputs', () => {
    expect(extractApiErrorMessage(null)).toBeNull()
    expect(extractApiErrorMessage('oops')).toBeNull()
    expect(extractApiErrorMessage(undefined)).toBeNull()
  })

  it('extracts from the Api::Errors::Reporter shape (object messages under errors)', () => {
    const body = {
      errors: {
        set_id: [{attribute: 'set_id', message: 'is already assigned.', type: 'taken'}],
      },
    }
    expect(extractApiErrorMessage(body)).toBe('is already assigned.')
  })

  it('extracts from the raw ActiveModel#to_json shape (string arrays at the root)', () => {
    const body = {set_id: ['is already assigned.']}
    expect(extractApiErrorMessage(body)).toBe('is already assigned.')
  })

  it('extracts from the RecordInvalid shape and strips the "Validation failed:" prefix', () => {
    const body = {invalid_record: ['Validation failed: Set is already assigned.']}
    expect(extractApiErrorMessage(body)).toBe('Set is already assigned.')
  })

  it('extracts from a top-level array of error objects (Reporter.to_hash shape)', () => {
    const body = {errors: [{field: 'set_id', message: 'is already assigned.', error_code: 'taken'}]}
    expect(extractApiErrorMessage(body)).toBe('is already assigned.')
  })

  it('skips fields not listed when restrictKeys is provided', () => {
    const body = {
      errors: {
        title: [{message: 'is required.'}],
        set_id: [{message: 'is already assigned.'}],
      },
    }
    expect(extractApiErrorMessage(body, {restrictKeys: ['set', 'set_id', 'invalid_record']})).toBe(
      'is already assigned.',
    )
    expect(extractApiErrorMessage(body, {restrictKeys: ['nonexistent']})).toBeNull()
  })

  it('returns null when no usable message is found', () => {
    expect(extractApiErrorMessage({errors: {}})).toBeNull()
    expect(extractApiErrorMessage({errors: {field: [{}]}})).toBeNull()
  })
})

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

import {messageForCode} from '../llmaErrorMessages'

describe('messageForCode', () => {
  it('returns localized copy for a known code', () => {
    expect(messageForCode('conversation_not_found')).toBe('This conversation could not be found.')
    expect(messageForCode('service_unavailable')).toBe(
      'The AI service is currently unavailable. Please check back soon.',
    )
  })

  it('returns undefined for codes we deliberately do not specialize', () => {
    // internal/service-level codes fall back to the server generic / per-surface default
    expect(messageForCode('internal_error')).toBeUndefined()
    expect(messageForCode('llm_upstream_error')).toBeUndefined()
  })

  it('returns undefined for a null/absent code', () => {
    expect(messageForCode(undefined)).toBeUndefined()
    expect(messageForCode(null)).toBeUndefined()
    expect(messageForCode('')).toBeUndefined()
  })
})

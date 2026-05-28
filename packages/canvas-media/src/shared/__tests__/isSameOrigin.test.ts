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

import {describe, expect, it} from 'vitest'
import {isSameOrigin} from '../isSameOrigin'

describe('isSameOrigin', () => {
  it('treats root-relative URLs as same-origin', () => {
    expect(isSameOrigin('/api/v1/media_objects')).toBe(true)
  })

  it('treats absolute URLs at window.location.origin as same-origin', () => {
    expect(isSameOrigin(`${window.location.origin}/api/v1/media_objects`)).toBe(true)
  })

  it('treats absolute URLs at a different origin as cross-origin', () => {
    expect(isSameOrigin('https://rcs.example.com/api/media_objects')).toBe(false)
  })

  it('treats protocol-relative URLs to a different host as cross-origin', () => {
    expect(isSameOrigin('//rcs.example.com/api/media_objects')).toBe(false)
  })
})

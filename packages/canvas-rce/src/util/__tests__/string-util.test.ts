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

import {emptyAsNull, trimmedOrNull} from '../string-util'

describe('emptyAsNull', () => {
  it('returns null for null input', () => {
    expect(emptyAsNull(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(emptyAsNull(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(emptyAsNull('')).toBeNull()
  })

  it('returns the string unchanged for a non-empty string', () => {
    expect(emptyAsNull('hello')).toBe('hello')
  })

  it('preserves whitespace-only strings (only empty length triggers null)', () => {
    expect(emptyAsNull('   ')).toBe('   ')
  })
})

describe('trimmedOrNull', () => {
  it('returns null for null input', () => {
    expect(trimmedOrNull(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(trimmedOrNull(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(trimmedOrNull('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(trimmedOrNull('   ')).toBeNull()
  })

  it('returns the trimmed string for a string with leading/trailing whitespace', () => {
    expect(trimmedOrNull('  hello  ')).toBe('hello')
  })

  it('returns the string unchanged when no surrounding whitespace', () => {
    expect(trimmedOrNull('hello')).toBe('hello')
  })
})

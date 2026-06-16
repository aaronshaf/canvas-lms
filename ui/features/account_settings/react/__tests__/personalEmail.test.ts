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

import {isPersonalEmailDomain} from '../personalEmail'

describe('isPersonalEmailDomain', () => {
  it('flags common consumer providers', () => {
    expect(isPersonalEmailDomain('someone@gmail.com')).toBe(true)
    expect(isPersonalEmailDomain('someone@hotmail.com')).toBe(true)
    expect(isPersonalEmailDomain('someone@outlook.com')).toBe(true)
  })

  it('is case- and whitespace-insensitive on the domain', () => {
    expect(isPersonalEmailDomain('Someone@GMAIL.com ')).toBe(true)
  })

  it('does not flag institutional or unknown domains', () => {
    expect(isPersonalEmailDomain('ciso@university.edu')).toBe(false)
    expect(isPersonalEmailDomain('security@instructure.com')).toBe(false)
  })

  it('returns false for blank or malformed input', () => {
    expect(isPersonalEmailDomain('')).toBe(false)
    expect(isPersonalEmailDomain(null)).toBe(false)
    expect(isPersonalEmailDomain('not-an-email')).toBe(false)
  })

  it('keys off the last @ so subaddressed display names do not fool it', () => {
    expect(isPersonalEmailDomain('weird@name@gmail.com')).toBe(true)
    expect(isPersonalEmailDomain('weird@name@university.edu')).toBe(false)
  })
})

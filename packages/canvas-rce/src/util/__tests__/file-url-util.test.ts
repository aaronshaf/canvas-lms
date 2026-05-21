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

import {guessCanvasFileIdFromUrl} from '../file-url-util'

describe('guessCanvasFileIdFromUrl', () => {
  it('extracts file id from a course file URL', () => {
    expect(guessCanvasFileIdFromUrl('https://canvas.example.com/courses/1/files/42')).toBe('42')
  })

  it('extracts file id from a group file URL', () => {
    expect(guessCanvasFileIdFromUrl('https://canvas.example.com/groups/7/files/99')).toBe('99')
  })

  it('extracts file id from a user file URL', () => {
    expect(guessCanvasFileIdFromUrl('https://canvas.example.com/users/3/files/100')).toBe('100')
  })

  it('returns null for a URL with no matching path pattern', () => {
    expect(guessCanvasFileIdFromUrl('https://canvas.example.com/courses/1/pages/intro')).toBeNull()
  })

  it('returns null for a URL with no path', () => {
    expect(guessCanvasFileIdFromUrl('https://canvas.example.com')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(guessCanvasFileIdFromUrl('')).toBeNull()
  })

  describe('with restrictToOrigin', () => {
    it('returns the file id when origins match', () => {
      expect(
        guessCanvasFileIdFromUrl(
          'https://canvas.example.com/courses/1/files/42',
          'https://canvas.example.com',
        ),
      ).toBe('42')
    })

    it('returns null when origins differ (cross-origin guard)', () => {
      expect(
        guessCanvasFileIdFromUrl(
          'https://evil.example.com/courses/1/files/42',
          'https://canvas.example.com',
        ),
      ).toBeNull()
    })

    it('returns null for a cross-origin URL with different subdomain', () => {
      expect(
        guessCanvasFileIdFromUrl(
          'https://attacker.canvas.example.com/courses/1/files/42',
          'https://canvas.example.com',
        ),
      ).toBeNull()
    })

    it('ignores restrictToOrigin when it is null', () => {
      expect(guessCanvasFileIdFromUrl('https://any.example.com/courses/1/files/42', null)).toBe(
        '42',
      )
    })

    it('ignores restrictToOrigin when it is undefined', () => {
      expect(
        guessCanvasFileIdFromUrl('https://any.example.com/courses/1/files/42', undefined),
      ).toBe('42')
    })
  })
})

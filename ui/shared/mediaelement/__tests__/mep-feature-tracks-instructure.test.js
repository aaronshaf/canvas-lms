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

import {sanitizeCaption} from '../captionSanitizer'

describe('caption sanitizer', () => {
  it('strips <link> elements to prevent stylesheet injection', () => {
    const html =
      '<link rel="stylesheet" href="https://attacker.example.com/evil.css"><b>caption</b>'
    const result = sanitizeCaption(html)
    expect(result).not.toContain('<link')
    expect(result).toContain('<b>caption</b>')
  })

  it('preserves allowed inline caption elements', () => {
    const html = '<b>bold</b> <i>italic</i> <u>underline</u>'
    const result = sanitizeCaption(html)
    expect(result).toContain('<b>bold</b>')
    expect(result).toContain('<i>italic</i>')
    expect(result).toContain('<u>underline</u>')
  })
})

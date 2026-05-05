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

import {IconLikeLine, IconBookmarkLine} from '@instructure/ui-icons'
import {renderIconSvg} from '../renderIconSvg'

describe('renderIconSvg', () => {
  it('returns a string starting with <svg', () => {
    const result = renderIconSvg(IconLikeLine)
    expect(result).toMatch(/^<svg/)
  })

  it('contains no <style> tags', () => {
    const result = renderIconSvg(IconLikeLine)
    expect(result).not.toContain('<style')
  })

  it('contains SVG path data', () => {
    const result = renderIconSvg(IconBookmarkLine)
    expect(result).toContain('<path')
  })

  it('produces valid SVG with a viewBox', () => {
    const result = renderIconSvg(IconLikeLine)
    expect(result).toContain('viewBox')
  })
})

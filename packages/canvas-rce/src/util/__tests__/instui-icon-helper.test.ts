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

import {IconMoreSolid, IconBoldLine} from '@instructure/ui-icons'
import {renderIconSvg, findInstUiIconSvg} from '../instui-icon-helper'

describe('renderIconSvg', () => {
  it('returns a string starting with <svg', () => {
    const result = renderIconSvg(IconMoreSolid)
    expect(result).toMatch(/^<svg/)
  })

  it('contains no <style> tags', () => {
    const result = renderIconSvg(IconMoreSolid)
    expect(result).not.toContain('<style')
  })

  it('contains SVG path data', () => {
    const result = renderIconSvg(IconBoldLine)
    expect(result).toContain('<path')
  })

  it('produces valid SVG with a viewBox', () => {
    const result = renderIconSvg(IconMoreSolid)
    expect(result).toContain('viewBox')
  })
})

describe('findInstUiIconSvg', () => {
  it('returns an SVG string for a known icon', () => {
    expect(findInstUiIconSvg('bold', 'Line')).toMatch(/^<svg/)
  })

  it('returns null for an unknown glyph name', () => {
    expect(findInstUiIconSvg('nonexistent-icon', 'Line')).toBeNull()
  })

  it('contains no <style> tags', () => {
    expect(findInstUiIconSvg('bold', 'Line')).not.toContain('<style')
  })
})

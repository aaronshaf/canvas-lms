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

import {configureGradeFormatting} from '@instructure/platform-grades'
import {configureCanvasGradeFormatting} from '../grades'

vi.mock('@instructure/platform-grades', async () => {
  const actual = await vi.importActual('@instructure/platform-grades')
  return {
    ...actual,
    configureGradeFormatting: vi.fn(),
  }
})

const mockConfigure = vi.mocked(configureGradeFormatting)

describe('configureCanvasGradeFormatting', () => {
  it('passes the scoreOutOf as a raw template, not through I18n.t', () => {
    mockConfigure.mockClear()
    configureCanvasGradeFormatting()

    const config = mockConfigure.mock.calls.at(-1)?.[0]
    // platform-grades interpolates these placeholders itself. If this string
    // were routed through I18n.t, Canvas would eagerly interpolate and emit
    // "[missing score value]/[missing pointsPossible value]" at render time.
    expect(config?.strings?.scoreOutOf).toBe('%{score}/%{pointsPossible}')
    expect(config?.strings?.scoreOutOf).not.toContain('[missing')
  })

  it('provides locale-aware number + parse helpers and translated strings', () => {
    mockConfigure.mockClear()
    configureCanvasGradeFormatting()

    const config = mockConfigure.mock.calls.at(-1)?.[0]
    expect(typeof config?.formatNumber).toBe('function')
    expect(typeof config?.parseNumber).toBe('function')
    // Lowercase to match Canvas's historical @canvas/grading output.
    expect(config?.strings?.complete).toBe('complete')
    expect(config?.strings?.incomplete).toBe('incomplete')
  })
})

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

import {sanitizePlugins} from '../sanitizePlugins'

describe('sanitizePlugins', () => {
  it('returns undefined when plugins is undefined', () => {
    expect(sanitizePlugins(undefined)).toBeUndefined()
  })

  it('passes through an array unchanged', () => {
    const arr = ['plugin1', 'plugin2', 'plugin3']
    expect(sanitizePlugins(arr)).toEqual(['plugin1', 'plugin2', 'plugin3'])
  })

  it('converts a comma-separated string to an array of trimmed plugin names', () => {
    expect(sanitizePlugins('plugin1,plugin2,plugin3')).toEqual(['plugin1', 'plugin2', 'plugin3'])
  })

  it('strips whitespace from each plugin name in the string', () => {
    expect(sanitizePlugins(' plugin1 , plugin2 , plugin3 ')).toEqual([
      'plugin1',
      'plugin2',
      'plugin3',
    ])
  })

  it('strips all internal whitespace (tabs and spaces) from plugin names', () => {
    expect(sanitizePlugins('plug in1,plug\tin2')).toEqual(['plugin1', 'plugin2'])
  })

  it('handles a string with a single plugin name', () => {
    expect(sanitizePlugins('instructure_links')).toEqual(['instructure_links'])
  })

  it('handles an empty string', () => {
    expect(sanitizePlugins('')).toEqual([''])
  })
})

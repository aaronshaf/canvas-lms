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

import {externalToolsForToolbar} from '../externalToolsForToolbar'

type Tool = {id: string | number; favorite: boolean; on_by_default: boolean; name: string}

const tool = (overrides: Partial<Tool> & {id: string | number; name: string}): Tool => ({
  favorite: false,
  on_by_default: false,
  ...overrides,
})

describe('externalToolsForToolbar', () => {
  it('returns empty array for empty input', () => {
    expect(externalToolsForToolbar([])).toEqual([])
  })

  it('excludes non-favorited, non-on_by_default tools', () => {
    const tools = [tool({id: '1', name: 'A', favorite: false, on_by_default: false})]
    expect(externalToolsForToolbar(tools)).toEqual([])
  })

  it('includes favorited tools that are not on_by_default', () => {
    const t = tool({id: '1', name: 'A', favorite: true})
    expect(externalToolsForToolbar([t])).toEqual([t])
  })

  it('limits non-on_by_default favorited tools to 2', () => {
    const tools = [
      tool({id: '1', name: 'A', favorite: true}),
      tool({id: '2', name: 'B', favorite: true}),
      tool({id: '3', name: 'C', favorite: true}),
    ]
    const result = externalToolsForToolbar(tools)
    expect(result).toHaveLength(2)
    expect(result.map(t => t.id)).toEqual(['1', '2'])
  })

  it('includes on_by_default tools that are favorited', () => {
    const t = tool({id: '1', name: 'A', favorite: true, on_by_default: true})
    expect(externalToolsForToolbar([t])).toEqual([t])
  })

  it('excludes on_by_default tools that are not favorited', () => {
    const t = tool({id: '1', name: 'A', favorite: false, on_by_default: true})
    expect(externalToolsForToolbar([t])).toEqual([])
  })

  it('deduplicates tools that appear in both favorited and on_by_default sets', () => {
    const t = tool({id: '1', name: 'A', favorite: true, on_by_default: true})
    const result = externalToolsForToolbar([t])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('sorts on_by_default tools before non-on_by_default tools', () => {
    const tools = [
      tool({id: '2', name: 'Fav', favorite: true}),
      tool({id: '1', name: 'Default', favorite: true, on_by_default: true}),
    ]
    const result = externalToolsForToolbar(tools)
    expect(result[0].on_by_default).toBe(true)
    expect(result[1].on_by_default).toBe(false)
  })

  it('sorts tools with same on_by_default status by id (numeric string ordering)', () => {
    const tools = [
      tool({id: '10', name: 'Ten', favorite: true}),
      tool({id: '2', name: 'Two', favorite: true}),
    ]
    const result = externalToolsForToolbar(tools)
    expect(result.map(t => t.id)).toEqual(['2', '10'])
  })
})

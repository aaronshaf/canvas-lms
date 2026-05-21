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

import parseLinkHeader from '../parse-link-header'

describe('parseLinkHeader', () => {
  it('parses a simple next link', () => {
    const header = '<https://example.com/api?page=2>; rel="next"'
    const result = parseLinkHeader(header)
    expect(result?.next?.url).toBe('https://example.com/api?page=2')
  })

  it('parses multiple rels', () => {
    const header =
      '<https://example.com/api?page=1>; rel="prev", <https://example.com/api?page=3>; rel="next"'
    const result = parseLinkHeader(header)
    expect(result?.prev).toBeDefined()
    expect(result?.next).toBeDefined()
  })

  it('returns null for an empty header', () => {
    expect(parseLinkHeader('')).toBeNull()
  })

  it('returns null for headers exceeding 4000 characters', () => {
    const header = '<https://example.com>; rel="next"' + 'x'.repeat(4001)
    expect(parseLinkHeader(header)).toBeNull()
  })

  it('parses Link headers between 2001-4000 characters (regression: 0219c3d98c8)', () => {
    // Before fix: PARSE_LINK_HEADER_MAXLEN was 2000 — headers > 2000 chars returned null,
    // breaking pagination for courses with many files (large Link response headers).
    // After fix: limit raised to 4000 chars.
    const longParam = 'x'.repeat(2100)
    const header = `<https://example.com/api/files?page=2&${longParam}=1>; rel="next"`
    const result = parseLinkHeader(header)
    expect(result).not.toBeNull()
    expect(result?.next).toBeDefined()
  })
})

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

import {mapStudioEmbedOptions, readViewerRestrictions, mapViewerRestrictions} from '../utils'

describe('mapStudioEmbedOptions', () => {
  it('returns keys where value is true', () => {
    expect(
      mapStudioEmbedOptions({enableDownload: true, enableTranscript: false, enableShare: true}),
    ).toEqual(['enableDownload', 'enableShare'])
  })

  it('returns empty array when all values are false', () => {
    expect(mapStudioEmbedOptions({enableDownload: false})).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(mapStudioEmbedOptions({})).toEqual([])
  })

  it('returns empty array when called with falsy value', () => {
    expect(mapStudioEmbedOptions(null as any)).toEqual([])
    expect(mapStudioEmbedOptions(undefined as any)).toEqual([])
  })
})

describe('readViewerRestrictions', () => {
  it('returns keys with truthy values', () => {
    expect(readViewerRestrictions({show_rolling_transcript: true, other: false})).toEqual([
      'show_rolling_transcript',
    ])
  })

  it('returns empty array when all values are false', () => {
    expect(readViewerRestrictions({show_rolling_transcript: false})).toEqual([])
  })

  it('returns empty array for empty object', () => {
    expect(readViewerRestrictions({})).toEqual([])
  })

  it('returns empty array for falsy input', () => {
    expect(readViewerRestrictions(null as any)).toEqual([])
    expect(readViewerRestrictions(undefined as any)).toEqual([])
  })
})

describe('mapViewerRestrictions', () => {
  it('maps recognized restrictions to true when present in array', () => {
    expect(mapViewerRestrictions(['show_rolling_transcript'])).toEqual({
      show_rolling_transcript: true,
    })
  })

  it('maps recognized restrictions to false when absent from array', () => {
    expect(mapViewerRestrictions([])).toEqual({
      show_rolling_transcript: false,
    })
  })

  it('ignores unknown restriction strings in the input array', () => {
    const result = mapViewerRestrictions(['unknown_restriction', 'show_rolling_transcript'])
    expect(result).toEqual({show_rolling_transcript: true})
    expect(result).not.toHaveProperty('unknown_restriction')
  })

  it('returns all restrictions as false for empty array', () => {
    const result = mapViewerRestrictions([])
    expect(Object.values(result).every(v => v === false)).toBe(true)
  })
})

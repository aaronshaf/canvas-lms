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

import {act, renderHook} from '@testing-library/react'
import {BREAKPOINTS} from '@canvas/breakpoints'
import {useNotesColumnCount} from '../useNotesColumnCount'

const TABLET_MIN_PX = BREAKPOINTS.mobile + 1
const DESKTOP_MIN_PX = BREAKPOINTS.desktop

type MqlListener = (e: {matches: boolean}) => void

class FakeMediaQueryList {
  matches: boolean
  query: string
  private listeners = new Set<MqlListener>()

  constructor(query: string, matches: boolean) {
    this.query = query
    this.matches = matches
  }

  addEventListener(_event: 'change', listener: MqlListener) {
    this.listeners.add(listener)
  }

  removeEventListener(_event: 'change', listener: MqlListener) {
    this.listeners.delete(listener)
  }

  setMatches(matches: boolean) {
    this.matches = matches
    this.listeners.forEach(l => l({matches}))
  }
}

let tabletMql: FakeMediaQueryList
let desktopMql: FakeMediaQueryList
let originalMatchMedia: typeof window.matchMedia

function installMatchMedia(initial: {tablet: boolean; desktop: boolean}) {
  tabletMql = new FakeMediaQueryList(`(min-width: ${TABLET_MIN_PX}px)`, initial.tablet)
  desktopMql = new FakeMediaQueryList(`(min-width: ${DESKTOP_MIN_PX}px)`, initial.desktop)
  window.matchMedia = ((query: string) => {
    if (query.includes(`${DESKTOP_MIN_PX}`)) return desktopMql
    return tabletMql
  }) as unknown as typeof window.matchMedia
}

describe('useNotesColumnCount', () => {
  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('returns 1 column below the tablet breakpoint', () => {
    installMatchMedia({tablet: false, desktop: false})
    const {result} = renderHook(() => useNotesColumnCount())
    expect(result.current).toBe(1)
  })

  it('returns 3 columns between tablet and desktop breakpoints', () => {
    installMatchMedia({tablet: true, desktop: false})
    const {result} = renderHook(() => useNotesColumnCount())
    expect(result.current).toBe(3)
  })

  it('returns 4 columns at or above the desktop breakpoint', () => {
    installMatchMedia({tablet: true, desktop: true})
    const {result} = renderHook(() => useNotesColumnCount())
    expect(result.current).toBe(4)
  })

  it('updates when the viewport crosses a breakpoint', () => {
    installMatchMedia({tablet: false, desktop: false})
    const {result} = renderHook(() => useNotesColumnCount())
    expect(result.current).toBe(1)

    act(() => {
      tabletMql.setMatches(true)
    })
    expect(result.current).toBe(3)

    act(() => {
      desktopMql.setMatches(true)
    })
    expect(result.current).toBe(4)

    act(() => {
      desktopMql.setMatches(false)
      tabletMql.setMatches(false)
    })
    expect(result.current).toBe(1)
  })
})

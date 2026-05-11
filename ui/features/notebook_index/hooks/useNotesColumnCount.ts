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

import {useEffect, useState} from 'react'
import {BREAKPOINTS} from '@canvas/breakpoints'

const MOBILE_COLUMNS = 1
const TABLET_COLUMNS = 3
const DESKTOP_COLUMNS = 4

const TABLET_MIN = `(min-width: ${BREAKPOINTS.mobile + 1}px)`
const DESKTOP_MIN = `(min-width: ${BREAKPOINTS.desktop}px)`

function resolve(tabletOrLarger: boolean, desktop: boolean): number {
  if (desktop) return DESKTOP_COLUMNS
  if (tabletOrLarger) return TABLET_COLUMNS
  return MOBILE_COLUMNS
}

function readCurrent(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DESKTOP_COLUMNS
  }
  return resolve(window.matchMedia(TABLET_MIN).matches, window.matchMedia(DESKTOP_MIN).matches)
}

export function useNotesColumnCount(): number {
  const [columnCount, setColumnCount] = useState<number>(readCurrent)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const tablet = window.matchMedia(TABLET_MIN)
    const desktop = window.matchMedia(DESKTOP_MIN)

    const update = () => setColumnCount(resolve(tablet.matches, desktop.matches))

    tablet.addEventListener('change', update)
    desktop.addEventListener('change', update)
    update()

    return () => {
      tablet.removeEventListener('change', update)
      desktop.removeEventListener('change', update)
    }
  }, [])

  return columnCount
}

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

import React from 'react'
import {act, render} from '@testing-library/react'
import ProgressionModuleHeader from '../ProgressionModuleHeader'

type SelectionCallback = (model: {attributes: {id: string; name: string}}) => void

function buildBridge() {
  let trigger: SelectionCallback | undefined
  return {
    bridge: {
      on: (_event: string, cb: SelectionCallback) => {
        trigger = cb
      },
    },
    fire: (model: {attributes: {id: string; name: string}}) => trigger!(model),
  }
}

describe('ProgressionModuleHeader', () => {
  beforeEach(() => {
    ;(window as any).ENV = {...(window as any).ENV, COURSE_USERS_PATH: '/courses/1/users'}
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('sanitizes hostile HTML reaching the dangerouslySetInnerHTML sink via user.id', () => {
    const {bridge, fire} = buildBridge()
    // @ts-expect-error — minimal bridge shape
    const {baseElement} = render(<ProgressionModuleHeader bridge={bridge} />)

    act(() => {
      fire({
        attributes: {
          id: '"><img src=x onerror="window.__xss_fired = true"><script>window.__xss_fired = true</script>',
          name: 'Alice',
        },
      })
    })

    expect(baseElement.querySelector('script')).toBeNull()
    baseElement.querySelectorAll('img').forEach(img => {
      expect(img.getAttribute('onerror')).toBeNull()
    })
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders the user name as visible text', () => {
    const {bridge, fire} = buildBridge()
    // @ts-expect-error — minimal bridge shape
    const {baseElement} = render(<ProgressionModuleHeader bridge={bridge} />)
    act(() => {
      fire({attributes: {id: '42', name: 'Alice'}})
    })
    expect(baseElement.textContent).toContain('Alice')
    const anchor = baseElement.querySelector('a')
    expect(anchor?.getAttribute('href')).toBe('/courses/1/users/42')
  })
})

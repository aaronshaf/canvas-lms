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
import fakeENV from '@canvas/test-utils/fakeENV'
import ProgressionModuleHeader from '../ProgressionModuleHeader'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

type SelectionAttrs = {id: string; name: string}

type AnyBridge = {on: (event: string, callback: (m: any) => void) => void}

const buildBridge = () => {
  let trigger: ((m: {attributes: SelectionAttrs}) => void) | null = null
  const bridge: AnyBridge = {
    on: (event: string, callback: (m: any) => void) => {
      if (event === 'selectionChanged') trigger = callback
    },
  }
  return {
    bridge,
    fire: (attrs: SelectionAttrs) => {
      if (!trigger) throw new Error('selectionChanged was never registered')
      act(() => trigger!({attributes: attrs}))
    },
  }
}

const renderWith = (attrs: SelectionAttrs) => {
  const {bridge, fire} = buildBridge()
  const result = render(
    <ProgressionModuleHeader
      bridge={bridge as unknown as React.ComponentProps<typeof ProgressionModuleHeader>['bridge']}
    />,
  )
  fire(attrs)
  return result
}

describe('ProgressionModuleHeader — XSS regression', () => {
  beforeEach(() => {
    fakeENV.setup({COURSE_USERS_PATH: '/courses/1/users'})
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    fakeENV.teardown()
    delete (window as any).__xss_fired
  })

  it('does not execute event handlers from a malicious user.name', () => {
    const {container} = renderWith({
      id: '42',
      name: '<img src=x onerror="window.__xss_fired = true">',
    })
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('does not execute event handlers from a malicious user.id in the href', () => {
    const {container} = renderWith({
      id: '1"><img src=x onerror="window.__xss_fired = true">',
      name: 'Aaron',
    })
    expectNoEventHandlers(container)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders the user name as text', () => {
    const {container} = renderWith({id: '42', name: 'Aaron Shafovaloff'})
    expect(container.textContent).toContain('Aaron Shafovaloff')
  })

  it('links to the correct user path', () => {
    const {container} = renderWith({id: '42', name: 'Aaron'})
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/courses/1/users/42')
  })

  it('does not allow javascript: URI if ENV.COURSE_USERS_PATH is mutated', () => {
    fakeENV.setup({COURSE_USERS_PATH: 'javascript:alert(1)'})
    const {container} = renderWith({id: '42', name: 'Aaron'})
    const href = container.querySelector('a')?.getAttribute('href') ?? ''
    expect(href).not.toMatch(/^javascript:/i)
  })
})

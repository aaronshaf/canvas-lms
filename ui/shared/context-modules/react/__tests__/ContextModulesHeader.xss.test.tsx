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

// Regression coverage for the ContextModulesHeader dangerouslySetInnerHTML
// sink that renders an external-tool icon (`tool.icon`). The icon HTML
// originates from external LTI tool metadata and must be passed through
// @canvas/sanitize-html (DOMPurify) before reaching the DOM, regardless of
// what shape the tool vendor supplies.

import React from 'react'
import {render} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContextModulesHeader from '../ContextModulesHeader'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildProps = (icon: string) =>
  ({
    title: 'Modules',
    publishMenu: {
      courseId: '1',
      runningProgressId: null,
      disabled: false,
      visible: true,
    },
    viewProgress: {
      label: 'View Progress',
      url: '/courses/1/modules/progress',
      visible: true,
    },
    expandCollapseAll: {
      onExpandCollapseAll: vi.fn(),
      anyModuleExpanded: true,
    },
    addModule: {
      label: 'Add Module',
      visible: true,
    },
    moreMenu: {
      label: 'More',
      menuTools: {
        items: [
          {
            href: '#url',
            'data-tool-id': 1,
            'data-tool-launch-type': null,
            class: null,
            icon,
            title: 'External Tool',
          },
        ],
        visible: true,
      },
      exportCourseContent: {
        label: 'Export Course Content',
        url: '/courses/1/modules/export',
        visible: false,
      },
    },
    lastExport: {
      label: 'Last Export:',
      url: '/courses/1/modules/last_export',
      date: '2024-01-01 00:00:00',
      visible: true,
    },
  }) as const

const renderWithIconAndOpenMenu = async (icon: string) => {
  // @ts-expect-error — defaultProps shape is partially typed in the existing test
  const result = render(<ContextModulesHeader {...buildProps(icon)} />)
  const button = result.getByRole('button', {name: 'More'})
  await userEvent.click(button)
  return result
}

describe('ContextModulesHeader — XSS regression at tool.icon sink', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from a malicious tool icon', async () => {
    const malicious = '<img src=x onerror="window.__xss_fired = true">'
    const {baseElement, getByRole} = await renderWithIconAndOpenMenu(malicious)
    // Confirm the menu actually opened with the tool item present.
    expect(getByRole('menuitem', {name: 'External Tool'})).toBeInTheDocument()
    expectNoEventHandlers(baseElement)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from a malicious tool icon', async () => {
    const malicious = '<script>window.__xss_fired = true</script>'
    const {baseElement, getByRole} = await renderWithIconAndOpenMenu(malicious)
    expect(getByRole('menuitem', {name: 'External Tool'})).toBeInTheDocument()
    expect(baseElement.querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs nested inside a tool icon', async () => {
    const malicious = '<a href="javascript:window.__xss_fired=true">x</a>'
    const {baseElement, queryAllByRole} = await renderWithIconAndOpenMenu(malicious)
    expect(queryAllByRole('menuitem').length).toBeGreaterThan(0)
    baseElement.querySelectorAll('a').forEach(anchor => {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    })
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves a benign tool icon element', async () => {
    const benign = '<i class="icon-tool"></i>'
    const {baseElement, getByRole} = await renderWithIconAndOpenMenu(benign)
    expect(getByRole('menuitem', {name: 'External Tool'})).toBeInTheDocument()
    expect(baseElement.querySelector('i.icon-tool')).not.toBeNull()
  })
})

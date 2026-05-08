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

// Regression coverage for the ManageUserLabels dangerouslySetInnerHTML sink.
// The component renders the user-authored label name as innerHTML (after a
// space->`&nbsp;` substitution to preserve internal whitespace). Defense-
// in-depth requires that no script tags or event-handler attributes survive
// in the rendered DOM. The shared @canvas/sanitize-html (DOMPurify) helper
// is the final pass at the sink.

import {render} from '@testing-library/react'
import React from 'react'
import {ManageUserLabels} from '../ManageUserLabels'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderWithLabel = (name: string) =>
  render(<ManageUserLabels open={true} labels={[name]} onCreate={() => {}} onDelete={() => {}} />)

describe('ManageUserLabels — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  it('strips inline event handlers from a malicious label name', () => {
    const {baseElement} = renderWithLabel('<img src=x onerror="window.__xss_fired = true">')
    expectNoEventHandlers(baseElement as HTMLElement)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from a malicious label name', () => {
    const {baseElement} = renderWithLabel('<script>window.__xss_fired = true</script>')
    expect((baseElement as HTMLElement).querySelector('script')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('renders a benign label with the &nbsp; substitution intact', () => {
    const {baseElement} = renderWithLabel('Hello World')
    const html = (baseElement as HTMLElement).innerHTML
    // Hard non-breaking space (U+00A0) is what `&nbsp;` decodes to once parsed
    // into the DOM and serialized back out.
    expect(html).toMatch(/Hello[ &nbsp;]+World/)
  })
})

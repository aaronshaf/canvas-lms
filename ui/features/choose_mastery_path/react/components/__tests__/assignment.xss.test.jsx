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

// Regression coverage for the mastery-path assignment description sink.
//
// Assignment.render writes assignment.description into the DOM via
// dangerouslySetInnerHTML after passing it through apiUserContent.convert
// — a media/URL rewriter, not a sanitizer. apiUserContent.convert is
// implemented on top of jQuery `.html(...)`, which strips <script> on
// parse but preserves event-handler attributes (onerror/onload/...) and
// javascript: URIs. Backend CanvasSanitize allowlisting alone is
// insufficient at frontend innerHTML sinks (see May 2026 incident retro,
// CFA-838); the shared @canvas/sanitize-html (DOMPurify) wrapper is the
// final pass at this sink.

import React from 'react'
import {render} from '@testing-library/react'
import Assignment from '../assignment'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildProps = description => ({
  isSelected: false,
  assignment: {
    name: 'Ch 2 Quiz',
    type: 'quiz',
    points_possible: 10,
    due_at: new Date(),
    itemId: 1,
    description,
    category: {
      id: 'other',
      label: 'Other',
    },
  },
})

describe('Assignment — XSS regression (mastery-path description sink)', () => {
  beforeEach(() => {
    delete window.__xss_fired
  })

  afterEach(() => {
    delete window.__xss_fired
  })

  it('strips inline event handlers (onerror) from the rendered description', () => {
    const {container} = render(
      <Assignment {...buildProps('<p>hi <img src=x onerror="window.__xss_fired = true"></p>')} />,
    )

    const description = container.querySelector('.ig-description')
    expectNoEventHandlers(description)
    expect(description.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from anchors in the rendered description', () => {
    const {container} = render(
      <Assignment {...buildProps('<a href="javascript:window.__xss_fired = true">click</a>')} />,
    )

    const description = container.querySelector('.ig-description')
    description.querySelectorAll('a').forEach(anchor => {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    })
    expect(window.__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // Defense-in-depth shape from the May 2026 incident: a payload nested
    // inside a title="..." attribute is dormant at parse time, but a
    // downstream string mutator that escapes the attribute boundary can
    // promote the embedded handler into a real DOM element. The sink-level
    // sanitizer must strip any resulting on* handler in the rendered DOM.
    const {container} = render(
      <Assignment
        {...buildProps(
          '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
        )}
      />,
    )

    const description = container.querySelector('.ig-description')
    expectNoEventHandlers(description)
    expect(window.__xss_fired).toBeUndefined()
  })
})

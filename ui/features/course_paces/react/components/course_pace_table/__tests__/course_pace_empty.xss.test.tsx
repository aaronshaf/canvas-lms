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

// Regression coverage for the course-paces empty-state HTML sink. The
// "more info" footer renders an i18n string with an `<a>` wrapper into a
// `dangerouslySetInnerHTML`. The string itself is dev-controlled (no end-
// user input flows in), so the XSS risk is low — but we route it through
// the shared DOMPurify wrapper as defense-in-depth and to keep the
// "every innerHTML sink in Canvas goes through sanitizeHTML" property
// (CFA-838).
//
// Strategy: mock `@canvas/i18n` so `t()` returns whatever we hand it,
// driving a hostile payload directly into the sink. With the wrapper in
// place the resulting DOM has no event handlers, no `<script>` element,
// and `window.__xss_fired` stays undefined. A control case asserts that
// the legitimate `<a target="_blank" href="...">` wrapper still renders.

import React from 'react'
import {render} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

let mockI18nReturn = ''

vi.mock('@canvas/i18n', () => ({
  useScope: () => ({
    t: (_key: string, _opts?: unknown) => mockI18nReturn,
  }),
}))

// Avoid pulling in real Redux actions during component import.
vi.mock('../../../actions/ui', () => ({
  actions: {
    setSelectedPaceContext: vi.fn(),
  },
}))
vi.mock('../../../actions/pace_contexts', () => ({
  paceContextsActions: {
    setDefaultPaceContextAsSelected: vi.fn(),
  },
}))

import {CoursePaceEmpty} from '../course_pace_empty'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderEmpty = () =>
  render(
    <CoursePaceEmpty
      setSelectedPaceContext={vi.fn() as any}
      setDefaultPaceContextAsSelected={vi.fn() as any}
      responsiveSize="large"
    />,
  )

describe('CoursePaceEmpty — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
    mockI18nReturn = ''
  })

  it('strips inline event handlers from the i18n footer HTML', () => {
    mockI18nReturn = '<img src=x onerror="window.__xss_fired = true"> hello'
    const {container} = renderEmpty()
    const sink = container.querySelector(
      '[data-testid="course-pacing-more-info-link"]',
    ) as HTMLElement
    expect(sink).not.toBeNull()

    expectNoEventHandlers(sink)
    expect(sink.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the i18n footer HTML', () => {
    mockI18nReturn = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    const {container} = renderEmpty()
    const sink = container.querySelector(
      '[data-testid="course-pacing-more-info-link"]',
    ) as HTMLElement
    expect(sink).not.toBeNull()

    expect(sink.querySelector('script')).toBeNull()
    expect(sink.innerHTML).not.toMatch(/<script/i)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from anchors in the footer HTML', () => {
    mockI18nReturn = '<a href="javascript:window.__xss_fired = true">click</a>'
    const {container} = renderEmpty()
    const sink = container.querySelector(
      '[data-testid="course-pacing-more-info-link"]',
    ) as HTMLElement
    expect(sink).not.toBeNull()

    const anchor = sink.querySelector('a')
    if (anchor) {
      expect(anchor.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    }
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('preserves the legitimate <a> wrapper from the real i18n string', () => {
    // Mirror what i18n's `wrappers` substitution would produce for the real
    // copy in the component.
    mockI18nReturn =
      '* Please note that once a Course Pace is saved... Learn more about Course Pacing in the <a target="_blank" href="https://community.canvaslms.com/t5/Course-Pacing-Feature-Preview/gh-p/course_pacing">Course Pacing User Group</a>.'
    const {container} = renderEmpty()
    const sink = container.querySelector(
      '[data-testid="course-pacing-more-info-link"]',
    ) as HTMLElement
    expect(sink).not.toBeNull()

    const anchor = sink.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe(
      'https://community.canvaslms.com/t5/Course-Pacing-Feature-Preview/gh-p/course_pacing',
    )
    expect(anchor?.textContent).toBe('Course Pacing User Group')
    expectNoEventHandlers(sink)
  })
})

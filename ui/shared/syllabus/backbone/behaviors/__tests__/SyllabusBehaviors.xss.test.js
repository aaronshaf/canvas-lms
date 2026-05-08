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

// Regression coverage for stored XSS via the SyllabusBehaviors edit-save
// success sink. After editing the course syllabus the API response is
// written into `#course_syllabus.html(...)`; CFA-858 wraps that value with
// the shared `@canvas/sanitize-html` DOMPurify wrapper as defense-in-depth
// on top of backend `CanvasSanitize`.
//
// Strategy: spy on `$.fn.formSubmit` to capture the options object the
// behavior installs, then invoke its `success` callback directly with a
// hostile `course.syllabus_body` payload. With the wrapper in place the
// rendered DOM has no event handlers and no <script>; without the wrapper
// the payload is live HTML.

import $ from 'jquery'
import SyllabusBehaviors from '../SyllabusBehaviors'
import RichContentEditor from '@canvas/rce/RichContentEditor'

vi.mock('@canvas/rce/RichContentEditor', () => ({
  default: {
    preloadRemoteModule: vi.fn(),
    callOnRCE: vi.fn(),
    closeRCE: vi.fn(),
    freshNode: vi.fn(),
    loadNewEditor: vi.fn(),
  },
}))

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('SyllabusBehaviors — XSS regression', () => {
  let container
  let formSubmitSpy
  let capturedOptions

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)

    // Skeleton DOM that bindToSyllabus expects.
    container.innerHTML = `
      <div id="course_syllabus"></div>
      <div id="course_syllabus_details"></div>
      <form id="edit_course_syllabus_form">
        <input type="hidden" id="course_syllabus_course_summary" />
      </form>
      <a class="edit_syllabus_link" href="#">edit</a>
      <textarea id="course_syllabus_body"></textarea>
    `

    capturedOptions = null
    formSubmitSpy = vi.spyOn($.fn, 'formSubmit').mockImplementation(function (options) {
      capturedOptions = options
      return this
    })
  })

  afterEach(() => {
    formSubmitSpy.mockRestore()
    document.body.removeChild(container)
    vi.clearAllMocks()
  })

  const invokeSuccess = syllabusBody => {
    SyllabusBehaviors.bindToEditSyllabus(false)
    expect(capturedOptions).not.toBeNull()
    capturedOptions.success({
      course: {
        syllabus_body: syllabusBody,
        settings: {syllabus_course_summary: false},
      },
    })
  }

  it('strips inline event handlers from the saved syllabus body', () => {
    const payload = '<p>hi <img src=x onerror="window.__xss_fired = true"></p>'
    invokeSuccess(payload)

    const el = document.getElementById('course_syllabus')
    expectNoEventHandlers(el)
    expect(el.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from the saved syllabus body', () => {
    const payload = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'
    invokeSuccess(payload)

    const el = document.getElementById('course_syllabus')
    expect(el.querySelector('script')).toBeNull()
    expect(el.innerHTML).not.toMatch(/<script/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from the saved syllabus body', () => {
    const payload = '<p><a href="javascript:window.__xss_fired = true">click</a></p>'
    invokeSuccess(payload)

    const el = document.getElementById('course_syllabus')
    const anchor = el.querySelector('a')
    if (anchor) {
      expect(anchor.getAttribute('href') || '').not.toMatch(/^javascript:/i)
    }
    expect(el.innerHTML).not.toMatch(/javascript:/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('renders benign formatting tags unchanged', () => {
    const payload = '<p><strong>bold</strong> and <em>italic</em></p>'
    invokeSuccess(payload)

    const el = document.getElementById('course_syllabus')
    expect(el.querySelector('strong')?.textContent).toBe('bold')
    expect(el.querySelector('em')?.textContent).toBe('italic')
    expectNoEventHandlers(el)
  })
})

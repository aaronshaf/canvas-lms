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

// Guards against re-introducing Plain Text fields into the htmlValues array
// at the three fillTemplateData call sites in jquery/index.jsx. Per the
// CFA-838 RFC, Plain Text content must flow through .text() (the default
// branch of fillTemplateData), never through .html().

import $ from 'jquery'

const PLAIN_TEXT_FIELDS_NEVER_HTML = [
  'estimated_duration_display',
  'estimated_duration_minutes',
  'can_set_estimated_duration',
  'estimated_duration_header_title',
  'estimated_duration_header_minutes',
  'points_possible_display',
]

describe('context-modules jquery htmlValues — Plain Text safety', () => {
  let modules
  let fillSpy
  let originalAjaxJSON

  beforeAll(async () => {
    window.ENV = {
      ...window.ENV,
      horizon_course: true,
      CONTEXT_MODULE_ESTIMATED_DURATION_INFO_URL: '/estimated-duration',
      CONTEXT_MODULE_ASSIGNMENT_INFO_URL: '/assignment-info',
      current_user_id: '1',
    }
    modules = (await import('../index')).default
  })

  beforeEach(() => {
    document.body.innerHTML = ''
    fillSpy = vi.spyOn($.fn, 'fillTemplateData')
    originalAjaxJSON = $.ajaxJSON
  })

  afterEach(() => {
    fillSpy.mockRestore()
    $.ajaxJSON = originalAjaxJSON
  })

  function capturedHtmlFields() {
    return fillSpy.mock.calls
      .map(call => call[0])
      .filter(opts => opts && opts.htmlValues)
      .flatMap(opts => opts.htmlValues)
  }

  function flush() {
    return new Promise(r => setTimeout(r, 0))
  }

  it('updateEstimatedDurations does not route Plain Text item fields through htmlValues', async () => {
    document.body.innerHTML = `
      <div id="context_module_1">
        <div class="ig-header">
          <span class="estimated_duration_header_title"></span>
          <span class="estimated_duration_header_minutes"></span>
        </div>
        <div id="context_module_item_42" class="context_module_item">
          <div class="ig-row"></div>
          <span class="estimated_duration_minutes"></span>
          <span class="can_set_estimated_duration"></span>
          <div class="estimated_duration_display"></div>
        </div>
      </div>
    `

    $.ajaxJSON = (_url, _method, _data, success) => {
      success({
        1: {
          42: {
            estimated_duration_minutes: 30,
            can_set_estimated_duration: true,
          },
        },
      })
    }

    modules.updateEstimatedDurations(1)
    await flush()

    // Sanity: the call site must have been reached.
    expect(fillSpy.mock.calls.length).toBeGreaterThan(0)

    const htmlFields = capturedHtmlFields()
    for (const field of PLAIN_TEXT_FIELDS_NEVER_HTML) {
      expect(htmlFields).not.toContain(field)
    }
  })

  it('updateAssignmentData does not route points_possible_display through htmlValues', async () => {
    document.body.innerHTML = `
      <div id="context_module_item_99" class="context_module_item">
        <div class="lock-icon" data-module-type="assignment" data-content-id="99"></div>
        <div class="points_possible_display"></div>
        <div class="due_date_display"></div>
      </div>
    `

    $.ajaxJSON = (_url, _method, _data, success) => {
      success({
        99: {
          points_possible: 10,
        },
      })
    }

    modules.updateAssignmentData(undefined, 1)
    await flush()

    expect(fillSpy.mock.calls.length).toBeGreaterThan(0)

    const htmlFields = capturedHtmlFields()
    expect(htmlFields).not.toContain('points_possible_display')
  })
})

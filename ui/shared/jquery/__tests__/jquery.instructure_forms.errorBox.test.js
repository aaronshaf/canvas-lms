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

// Regression tests for $.fn.errorBox rendering contract.
// Both the labeled (.labeled-error) and floating-box paths must render the
// same plain-string input identically — prior to the fix, the labeled path
// double-encoded via createTextNode(htmlEscape(msg)) while the floating path
// used .html(msg.toString()), producing different output for the same input.

import $ from 'jquery'
import htmlEscape, {raw} from '@instructure/html-escape'
import '@canvas/jquery/jquery.instructure_forms'

describe('$.fn.errorBox rendering contract', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="fixtures"></div>'
    $.screenReaderFlashError = vi.fn()
    if (!$.fn.zIndex) {
      $.fn.zIndex = function () {
        return 1
      }
    }
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('floating-box path (no .labeled-error class)', () => {
    test('plain I18n string renders as literal text, not HTML', () => {
      const $input = $('<input type="text">').appendTo('#fixtures')
      $input.errorBox('<b>required</b>')
      expect($('.error_text').text()).toBe('<b>required</b>')
    })

    test('raw()-wrapped SafeString renders without double-escaping', () => {
      const $input = $('<input type="text">').appendTo('#fixtures')
      $input.errorBox(raw(htmlEscape("it's required")))
      expect($('.error_text').text()).toBe("it's required")
    })
  })

  describe('labeled-error path (.labeled-error class)', () => {
    test('plain string with apostrophe is not double-encoded', () => {
      const $input = $('<input class="labeled-error">').appendTo('#fixtures')
      $input.errorBox("it's required")
      expect($('.labeled-error-message').text()).toContain("it's required")
    })

    test('same plain string renders same text in labeled and floating paths', () => {
      const msg = "it's required"

      const $labeled = $('<input class="labeled-error">').appendTo('#fixtures')
      $labeled.errorBox(msg)
      const labeledText = $('.labeled-error-message').text()

      $('.labeled-error-message').remove()

      const $floating = $('<input type="text">').appendTo('#fixtures')
      $floating.errorBox(msg)
      const floatingText = $('.error_text').text()

      expect(labeledText).toContain(msg)
      expect(floatingText).toBe(msg)
    })
  })
})

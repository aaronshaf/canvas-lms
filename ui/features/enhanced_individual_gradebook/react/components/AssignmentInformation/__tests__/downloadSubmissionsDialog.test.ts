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

import $ from 'jquery'
import '@canvas/jquery/jquery.ajaxJSON'
import downloadSubmissionsDialog from '../downloadSubmissionsDialog'

const url = '/api/v1/courses/1/assignments/1/submissions?zip=1'

describe('downloadSubmissionsDialog', () => {
  let triggerSuccess: (data: object) => void

  beforeEach(() => {
    // Stub jQuery UI plugins so jsdom doesn't choke on missing layout APIs
    $.fn.dialog = vi.fn().mockImplementation(function (this: JQuery) {
      return this
    }) as any
    $.fn.progressbar = vi.fn().mockImplementation(function (this: JQuery) {
      return this
    }) as any

    // jQuery's :visible selector requires non-zero getClientRects — jsdom
    // returns an empty list by default, making every element appear hidden.
    vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([
      {width: 100, height: 100} as DOMRect,
    ] as unknown as DOMRectList)

    document.body.innerHTML = `
      <div id="download_submissions_dialog">
        <div class="progress"></div>
        <div class="status_loader"></div>
        <div class="status"></div>
      </div>
    `
    // Drive the AJAX callback synchronously in tests
    $.ajaxJSON = vi.fn().mockImplementation((_url, _method, _data, successFn) => {
      triggerSuccess = successFn
    }) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when attachment is zipped (download ready)', () => {
    it('updates .status element with the completion message', () => {
      downloadSubmissionsDialog(url, vi.fn())
      triggerSuccess({attachment: {workflow_state: 'zipped', readable_size: '4.2 MB'}})

      const status = document.querySelector('#download_submissions_dialog .status')
      // replaceChildren added a text node ("Finished! Redirecting...") + br + link
      expect(status?.firstChild?.textContent).toMatch(/Finished/)
    })

    it('does not throw when the .status element is absent from the dialog', () => {
      // Remove .status — simulates partially-rendered or out-of-sequence DOM
      document.querySelector('#download_submissions_dialog .status')?.remove()

      expect(() => {
        downloadSubmissionsDialog(url, vi.fn())
        triggerSuccess({attachment: {workflow_state: 'zipped', readable_size: '4.2 MB'}})
      }).not.toThrow()
    })
  })

  describe('when attachment is still processing', () => {
    it('does not throw when .status element is absent', () => {
      document.querySelector('#download_submissions_dialog .status')?.remove()

      expect(() => {
        downloadSubmissionsDialog(url, vi.fn())
        triggerSuccess({attachment: {workflow_state: 'processing', file_state: '50'}})
      }).not.toThrow()
    })
  })
})

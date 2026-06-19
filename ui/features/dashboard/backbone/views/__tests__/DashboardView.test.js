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
import DashboardView from '../DashboardView'

// Markup mirrors the recent-activity stream after it has been sanitized client
// side: @instructure/platform-sanitize 0.5.1 renames the Rails UJS attributes
// the dismiss link relies on (data-remove -> data-custom-remove, data-url ->
// data-custom-url), so jquery-ujs no longer handles the click.
const row = ({customRemove = 'tr', customUrl = '/dashboard/ignore_stream_item/884144'} = {}) => `
  <tr>
    <td class="remove">
      <a class="close ignore-item" href="#"
         ${customRemove === null ? '' : `data-custom-remove="${customRemove}"`}
         ${customUrl === null ? '' : `data-custom-url="${customUrl}"`}>x</a>
    </td>
  </tr>`

const streamMarkup = (rows = [row()]) => `
  <div id="dashboard-activity">
    <ul class="recent_activity">
      <li class="stream-category stream-announcement" data-category="Announcement">
        <div class="details_container">
          <table>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
      </li>
    </ul>
  </div>`

describe('DashboardView dismissStreamItem', () => {
  let view
  let ajaxJSONSpy

  beforeEach(() => {
    document.body.innerHTML = streamMarkup()
    view = new DashboardView()
    ajaxJSONSpy = jest.spyOn($, 'ajaxJSON')
  })

  const remount = markup => {
    view.undelegateEvents()
    document.body.innerHTML = markup
    view = new DashboardView()
  }

  afterEach(() => {
    view?.undelegateEvents()
    ajaxJSONSpy.mockRestore()
    document.body.innerHTML = ''
  })

  it('removes the row and DELETEs the renamed data-custom-url on dismiss', () => {
    ajaxJSONSpy.mockImplementation((url, _method, _data, success) => success())

    $('.ignore-item').trigger('click')

    expect(ajaxJSONSpy).toHaveBeenCalledWith(
      '/dashboard/ignore_stream_item/884144',
      'DELETE',
      {},
      expect.any(Function),
      expect.any(Function),
    )
    // last row in the category -> the whole announcement category is removed
    expect(document.querySelector('.stream-announcement')).toBeNull()
  })

  it('ignores links without the renamed remove attribute', () => {
    remount(streamMarkup([row({customRemove: null})]))

    $('.ignore-item').trigger('click')

    expect(ajaxJSONSpy).not.toHaveBeenCalled()
    expect(document.querySelector('tbody tr')).not.toBeNull()
  })
})

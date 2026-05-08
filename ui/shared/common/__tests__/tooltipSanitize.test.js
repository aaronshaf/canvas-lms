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
import '../activateTooltips'

$.fn.andSelf = $.fn.addBack

describe('jQuery UI tooltip sanitization', () => {
  let target
  let fixtures

  beforeEach(() => {
    $.fn.offset = () => ({top: 0, left: 0})
    Element.prototype.getClientRects = () => [
      {width: 1, height: 1, top: 0, left: 0, bottom: 1, right: 1},
    ]
    Element.prototype.getBoundingClientRect = () => ({
      width: 1,
      height: 1,
      top: 0,
      left: 0,
      bottom: 1,
      right: 1,
    })

    fixtures = document.createElement('div')
    document.body.appendChild(fixtures)
    const el = document.createElement('span')
    el.setAttribute('title', 'placeholder')
    fixtures.appendChild(el)
    target = $(el)
    target.tooltip({show: false, hide: false, position: {my: 'center', at: 'center'}})
  })

  afterEach(() => {
    if (target.data('ui-tooltip')) target.tooltip('destroy')
    fixtures.remove()
    delete Element.prototype.getClientRects
    delete Element.prototype.getBoundingClientRect
  })

  it('strips event-handler attributes from rendered tooltip content', () => {
    target.tooltip('option', 'content', () => '<img src=x onerror="window.__xss=1">')
    target.tooltip('open')

    const rendered = document.querySelector('.ui-tooltip-content')
    expect(rendered).toBeInTheDocument()
    rendered.querySelectorAll('*').forEach(node => {
      node.getAttributeNames().forEach(name => {
        expect(name).not.toMatch(/^on/i)
      })
    })
    expect(window.__xss).toBeUndefined()
  })

  it('preserves benign HTML used by data-html-tooltip-title popovers', () => {
    target.tooltip('option', 'content', () => '<div class="popover-title">Title</div><br>line')
    target.tooltip('open')

    const rendered = document.querySelector('.ui-tooltip-content')
    expect(rendered.querySelector('.popover-title')).not.toBeNull()
    expect(rendered.querySelector('br')).not.toBeNull()
  })
})

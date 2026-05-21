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

// Regression coverage for aria-expanded state on .al-trigger menu buttons.
// Screen reader users must be able to determine whether a menu is open or
// closed. KyleMenu is the central handler for all .al-trigger menus, so
// the aria-expanded toggle belongs here rather than in each template.

import $ from 'jquery'
import 'jqueryui/menu'
import KyleMenu from 'jquery-kyle-menu'

describe('KyleMenu aria-expanded', () => {
  let $fixtures, $trigger, $menu

  beforeEach(() => {
    $fixtures = $('<div/>').appendTo(document.body)
    $trigger = $('<button class="al-trigger">Menu</button>').appendTo($fixtures)
    $menu = $('<ul><li><a href="#">Option</a></li></ul>').appendTo($fixtures)
    new KyleMenu($trigger, {noButton: true})
  })

  afterEach(() => {
    $fixtures.remove()
  })

  it('sets aria-expanded to false on initialization', () => {
    expect($trigger.attr('aria-expanded')).toBe('false')
  })

  it('sets aria-expanded to true when the menu opens', () => {
    $menu.trigger('popupopen')
    expect($trigger.attr('aria-expanded')).toBe('true')
  })

  it('sets aria-expanded to false when the menu closes after being open', () => {
    $menu.trigger('popupopen')
    $menu.trigger('popupclose')
    expect($trigger.attr('aria-expanded')).toBe('false')
  })
})

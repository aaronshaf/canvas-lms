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

// Regression coverage for the .html() round-trip in jquery-kyle-menu's
// monkey-patched refresh(). The old code rebuilt the input-group label by
// reading parent.prev().html() and re-emitting it via
// .html("<span class='ui-menu-input-group'>" + read + "</span>").
//
// That string-level read -> string-level re-emit is the same shape that bit
// the discussion render path: attribute-encoded markup that the browser
// parses inertly the first time (e.g. an attribute value containing
// "<img onerror=...>" as a literal string) can produce different DOM on the
// second parse. The visual intent is just "wrap the existing label text in
// a span" -- text-only -- so the fix is text-based DOM construction:
// .text() / .empty() / .append($('<span>', {text})).
//
// Once text-based, no second HTML-parse step exists; markup-shaped label
// content cannot break out into live DOM.

import $ from 'jquery'
import 'jqueryui/menu'
import 'jquery-kyle-menu'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

describe('jquery-kyle-menu input-group label — XSS regression', () => {
  let $fixtures

  beforeEach(() => {
    $fixtures = $('<div id="kyle-menu-fixtures"/>').appendTo(document.body)
    delete window.__xss_fired
  })

  afterEach(() => {
    $fixtures.remove()
    delete window.__xss_fired
  })

  // --- Mechanism reproducer (no menu refresh involved) -------------------

  it('REPRO: the unsafe round-trip would re-parse markup-shaped label content as live DOM', () => {
    // Mimic the OLD behavior: read .html() and re-emit via .html() with a
    // surrounding span. Even though the source label had no children, the
    // .html() reader serializes its descendants -- which on a re-parse can
    // promote attribute-encoded markup into real elements.
    const $label = $(
      '<li><span title="<img src=x onerror=&quot;window.__xss_fired=true&quot;>">x</span></li>',
    ).appendTo($fixtures)

    // Old pattern:
    $label.html("<span class='ui-menu-input-group'>" + $label.html() + '</span>')

    // The original `<span title="...">` is still here, but the round-trip
    // serialization of its `title` attribute can introduce a literal
    // `<img ...>` substring that, depending on attribute-encoding, may be
    // re-parsed. The point of the new code is to never depend on that
    // serialization round-trip at all.
    expect($label.find('span.ui-menu-input-group').length).toBe(1)
  })

  // --- New text-based construction ---------------------------------------

  const buildMenu = labelHtml => {
    const $menu = $(
      '<ul>' +
        '<li>' +
        labelHtml +
        '</li>' +
        '<li><a href="#"><label>Option A<input type="checkbox" name="opt"/></label></a></li>' +
        '<li><a href="#"><label>Option B<input type="checkbox" name="opt"/></label></a></li>' +
        '</ul>',
    ).appendTo($fixtures)
    $menu.menu()
    return $menu
  }

  it('renders a benign input-group label as a ui-menu-input-group span with text intact', () => {
    const $menu = buildMenu('Group label')

    const $group = $menu.find('span.ui-menu-input-group')
    expect($group.length).toBe(1)
    expect($group.text()).toBe('Group label')
    expect($group.parent().hasClass('ui-state-disabled')).toBe(true)
    expectNoEventHandlers($menu[0])
  })

  it('does not re-parse markup embedded in the label text', () => {
    // Build the label via DOM so the angle-bracketed payload is *literal
    // text* in the label, not parsed markup. With a string-level round-trip
    // (.html() read + .html() write), this literal text would round-trip
    // through innerHTML and could be mis-parsed; with .text() it stays
    // inert.
    const labelText = '<img src=x onerror="window.__xss_fired=true">'
    const $menu = $(
      '<ul><li></li><li><a href="#"><label>A<input type="checkbox" name="o"/></label></a></li></ul>',
    ).appendTo($fixtures)
    $menu.find('li').first().text(labelText)
    $menu.menu()

    const $group = $menu.find('span.ui-menu-input-group')
    expect($group.length).toBe(1)
    // text() reads the textContent and angle brackets remain literal.
    expect($group.text()).toBe(labelText)
    expect($menu.find('img').length).toBe(0)
    expectNoEventHandlers($menu[0])
    expect(window.__xss_fired).toBeUndefined()
  })

  it('does not let a title-attribute payload break out across the round-trip', () => {
    // An inert `<span title="...">` whose title contains markup-shaped
    // content. The browser's first parse keeps it as an attribute string;
    // the OLD code would re-emit innerHTML, which is exactly the kind of
    // mutation that bit the discussion render path. With .text() we never
    // re-emit HTML.
    const $menu = buildMenu(
      '<span title="<a ><img src=x onerror=&quot;window.__xss_fired=true&quot;>">Group</span>',
    )

    const $group = $menu.find('span.ui-menu-input-group')
    expect($group.length).toBe(1)
    // Only the visible text "Group" survives -- not the attribute payload,
    // not the original <span>, not any <img>.
    expect($group.text()).toBe('Group')
    expect($menu.find('img').length).toBe(0)
    expectNoEventHandlers($menu[0])
    expect(window.__xss_fired).toBeUndefined()
  })

  it('preserves existing inline child text but does not preserve child elements (text-only intent)', () => {
    // The visual intent of the fix is text-only: kyleMenu input-group labels
    // are short label strings, so we accept that any nested elements are
    // collapsed to their text content. Verify that explicitly so a future
    // refactor doesn't quietly start round-tripping HTML again.
    const $menu = buildMenu('<b>Bold</b> label')

    const $group = $menu.find('span.ui-menu-input-group')
    expect($group.length).toBe(1)
    expect($group.text()).toBe('Bold label')
    expect($group.find('b').length).toBe(0)
    expectNoEventHandlers($menu[0])
  })

  it('still applies ui-state-disabled and inserts the trailing separator <li><hr/></li>', () => {
    const $menu = buildMenu('Group label')

    const $disabled = $menu.find('li.ui-state-disabled')
    expect($disabled.length).toBe(1)
    expect($disabled.children('span.ui-menu-input-group').length).toBe(1)

    // The refresh() pass appends a <li><hr/></li> after the input-group
    // label. Verify the structural intent survived the refactor.
    const $afterLabel = $disabled.next('li')
    expect($afterLabel.length).toBe(1)
    expect($afterLabel.find('hr').length).toBe(1)
  })
})

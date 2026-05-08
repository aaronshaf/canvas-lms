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

// Locks in CFA-932 backport: jQuery 3.7.1 must accept TrustedHTML
// wrappers in its DOM-manipulation APIs the way jQuery 4 does
// (PR #4927). Without the backport, .html(TrustedHTML) silently
// produces empty DOM. Remove this test alongside the patches in
// packages/jquery/jquery.js when Canvas upgrades to jQuery 4 (CFA-931).

import $ from 'jquery'

const installTrustedTypesStub = () => {
  const fakeTrustedHTML = s => {
    const wrapper = {
      __isFakeTrustedHTML: true,
      toString: () => s,
      toJSON: () => s,
    }
    return wrapper
  }
  globalThis.trustedTypes = {
    isHTML: v => !!(v && v.__isFakeTrustedHTML),
    createPolicy: (_name, rules) => ({
      createHTML: rules.createHTML
        ? input => fakeTrustedHTML(rules.createHTML(input))
        : input => fakeTrustedHTML(input),
    }),
  }
  return fakeTrustedHTML
}

describe('jQuery TrustedHTML support (CFA-932 backport)', () => {
  let mintTrusted

  beforeEach(() => {
    mintTrusted = installTrustedTypesStub()
    document.body.innerHTML = '<div id="fixture"></div>'
  })

  afterEach(() => {
    delete globalThis.trustedTypes
    $('#fixture').empty()
  })

  test('.html(TrustedHTML) renders the HTML (regression: was silent empty)', () => {
    const $el = $('#fixture')
    const trusted = mintTrusted('<span class="probe">hi</span>')

    $el.html(trusted)

    expect($el.find('.probe').length).toBe(1)
    expect($el.find('.probe').text()).toBe('hi')
  })

  test('.append(TrustedHTML) renders the HTML', () => {
    const $el = $('#fixture')
    $el.html('<p>existing</p>')
    const trusted = mintTrusted('<span class="probe">added</span>')

    $el.append(trusted)

    expect($el.find('.probe').text()).toBe('added')
    expect($el.find('p').text()).toBe('existing')
  })

  test('.prepend(TrustedHTML) renders the HTML', () => {
    const $el = $('#fixture')
    $el.html('<p class="last">existing</p>')
    const trusted = mintTrusted('<span class="probe">first</span>')

    $el.prepend(trusted)

    expect($el.children().first().is('.probe')).toBe(true)
  })

  test('.before(TrustedHTML) inserts before the element', () => {
    const $el = $('#fixture')
    $el.html('<p id="anchor">x</p>')
    const trusted = mintTrusted('<span class="probe">before</span>')

    $('#anchor').before(trusted)

    expect($el.children().first().is('.probe')).toBe(true)
  })

  test('.after(TrustedHTML) inserts after the element', () => {
    const $el = $('#fixture')
    $el.html('<p id="anchor">x</p>')
    const trusted = mintTrusted('<span class="probe">after</span>')

    $('#anchor').after(trusted)

    expect($el.children().last().is('.probe')).toBe(true)
  })

  test('.replaceWith(TrustedHTML) replaces the element', () => {
    const $el = $('#fixture')
    $el.html('<p id="anchor">x</p>')
    const trusted = mintTrusted('<span class="probe">replaced</span>')

    $('#anchor').replaceWith(trusted)

    expect($el.find('#anchor').length).toBe(0)
    expect($el.find('.probe').text()).toBe('replaced')
  })

  test('$.parseHTML(TrustedHTML) returns a parsed node array', () => {
    const trusted = mintTrusted('<span class="probe">parsed</span>')

    const nodes = $.parseHTML(trusted)

    expect(nodes.length).toBeGreaterThan(0)
    const span = nodes.find(n => n.classList && n.classList.contains('probe'))
    expect(span).toBeTruthy()
    expect(span.textContent).toBe('parsed')
  })

  test('$(TrustedHTML) constructor parses HTML', () => {
    const trusted = mintTrusted('<span class="probe">via-constructor</span>')

    const $built = $(trusted)

    expect($built.is('.probe')).toBe(true)
    expect($built.text()).toBe('via-constructor')
  })

  test('non-string non-TrustedHTML object still rejected by parseHTML', () => {
    expect($.parseHTML({foo: 'bar'})).toEqual([])
  })

  test('plain string still works (no regression)', () => {
    const $el = $('#fixture')
    $el.html('<span class="probe">plain</span>')
    expect($el.find('.probe').text()).toBe('plain')
  })
})

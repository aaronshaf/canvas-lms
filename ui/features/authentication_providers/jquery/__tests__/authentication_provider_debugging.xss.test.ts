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

// Regression coverage for XSS via the authentication provider debug
// payload. The debug page is admin-only on the rendering side, but the
// `debug_data` field is populated by the IdP/SAML/CAS/LDAP debug
// transcript — values an attacker can influence by crafting malicious
// IdP responses or directory records. The handler renders the field with
// jQuery `.html(...)`, so without sanitization an attacker-controlled
// payload would land as live DOM. CFA-860 routes the value through the
// shared `@canvas/sanitize-html` DOMPurify wrapper.

import $ from 'jquery'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildFixture = () => {
  const fixture = document.createElement('div')
  fixture.className = 'debugging'
  fixture.innerHTML = `
    <a class="start_debugging" href="/api/v1/auth/1/debug">Start</a>
    <a class="refresh_debugging" href="/api/v1/auth/1/debug" style="display:none">Refresh</a>
    <a class="stop_debugging" href="/api/v1/auth/1/debug" style="display:none">Stop</a>
    <div class="debug_data" style="display:none"></div>
  `
  document.body.appendChild(fixture)
  return fixture
}

describe('authentication_provider_debugging — XSS regression', () => {
  let fixture: HTMLElement
  let originalAjaxJSON: any

  beforeEach(async () => {
    delete (window as any).__xss_fired
    fixture = buildFixture()
    originalAjaxJSON = ($ as any).ajaxJSON
    // Module attaches click handlers via $(document).ready(), so the
    // fixture must exist before the module is (re)imported.
    vi.resetModules()
    await import('../authentication_provider_debugging')
    // jQuery's $(document).ready(...) defers to a microtask in jsdom; flush it.
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  afterEach(() => {
    fixture.remove()
    if (originalAjaxJSON === undefined) {
      delete ($ as any).ajaxJSON
    } else {
      ;($ as any).ajaxJSON = originalAjaxJSON
    }
    delete (window as any).__xss_fired
  })

  const triggerStartWithPayload = (debug_data: string) => {
    ;($ as any).ajaxJSON = (
      _url: string,
      _method: string,
      _data: unknown,
      cb: (resp: {debugging: boolean; debug_data: string}) => void,
    ) => {
      cb({debugging: true, debug_data})
    }
    $(fixture).find('.start_debugging').trigger('click')
  }

  it('strips inline event handlers from rendered debug_data', () => {
    triggerStartWithPayload('<p>real debug</p><img src=x onerror="window.__xss_fired = true">')

    const debugBox = fixture.querySelector<HTMLElement>('.debug_data')!
    expectNoEventHandlers(debugBox)
    expect(debugBox.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect((window as any).__xss_fired).toBeUndefined()
    // Benign content survives.
    expect(debugBox.textContent).toContain('real debug')
  })

  it('strips <script> tags from rendered debug_data', () => {
    triggerStartWithPayload('<p>before</p><script>window.__xss_fired = true</script><p>after</p>')

    const debugBox = fixture.querySelector<HTMLElement>('.debug_data')!
    expect(debugBox.querySelector('script')).toBeNull()
    expect(debugBox.innerHTML.toLowerCase()).not.toContain('<script')
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('neutralizes javascript: hrefs in rendered debug_data', () => {
    triggerStartWithPayload('<a href="javascript:window.__xss_fired = true">click</a>')

    const debugBox = fixture.querySelector<HTMLElement>('.debug_data')!
    const anchor = debugBox.querySelector('a')
    // DOMPurify either drops the anchor's href or replaces it; either way,
    // a live `javascript:` URI must not survive.
    if (anchor) {
      expect((anchor.getAttribute('href') || '').toLowerCase()).not.toContain('javascript:')
    }
  })
})

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

import {setRceHTML} from '../rceTrustedTypes'

describe('setRceHTML (regression: e9a50f42290)', () => {
  // Before fix: RCE innerHTML assignments were not wrapped in a Trusted Types
  // policy, causing failures when TT Phase 2 enforcement is active.
  // After fix: setRceHTML uses a named 'canvas-rce' TT policy when available,
  // falling back to direct innerHTML assignment in environments without TT.

  it('sets innerHTML on the element', () => {
    const el = document.createElement('div')
    setRceHTML(el, '<p>hello</p>')
    expect(el.innerHTML).toBe('<p>hello</p>')
  })

  it('replaces existing innerHTML', () => {
    const el = document.createElement('div')
    el.innerHTML = '<span>old</span>'
    setRceHTML(el, '<p>new</p>')
    expect(el.innerHTML).toBe('<p>new</p>')
  })

  it('sets empty string', () => {
    const el = document.createElement('div')
    el.innerHTML = '<span>content</span>'
    setRceHTML(el, '')
    expect(el.innerHTML).toBe('')
  })

  it('handles complex HTML structures', () => {
    const el = document.createElement('div')
    setRceHTML(el, '<ul><li>a</li><li>b</li></ul>')
    expect(el.querySelectorAll('li')).toHaveLength(2)
  })

  it('works without trustedTypes API (jsdom fallback path)', () => {
    // jsdom does not implement trustedTypes; this verifies the fallback
    // (direct innerHTML assignment) works correctly in test environments.
    expect((window as any).trustedTypes).toBeUndefined()
    const el = document.createElement('div')
    expect(() => setRceHTML(el, '<p>test</p>')).not.toThrow()
    expect(el.innerHTML).toBe('<p>test</p>')
  })
})

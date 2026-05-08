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

// Regression coverage for stored / reflected XSS at the profile-area
// dangerouslySetInnerHTML sinks.
//
// ConfirmEmailAddress and ConfirmCommunicationChannel both interpolate a
// user-controlled identifier (`email` / `phoneNumberOrEmail`) into a
// translated string and render the result via dangerouslySetInnerHTML.
// Canvas's i18n `wrapper` interpolation auto-html-escapes the values that
// fill `*...*` placeholders, so a plain `<img onerror=…>` payload threaded
// through the prop never reaches the sink as raw HTML.
//
// To isolate the sink-level DOMPurify wrapper added in CFA-853 we mock
// `@canvas/i18n`'s `useScope` so `I18n.t(...)` simply returns the malicious
// payload verbatim — that simulates a hypothetical upstream regression
// (broken interpolator, future translation key with `raw()` baked in,
// etc.) where the payload arrives at the sink intact. With sanitizeHTML
// in place, no event handler attribute or <script> tag survives in the
// rendered DOM. Without it, the payload would render as live HTML.

import {render} from '@testing-library/react'
import React from 'react'

let mockTranslation = ''

vi.mock('@canvas/i18n', () => ({
  useScope: () => ({
    t: (..._args: unknown[]) => mockTranslation,
  }),
}))

import ConfirmEmailAddress from '../ConfirmEmailAddress'
import ConfirmCommunicationChannel from '../ConfirmCommunicationChannel'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const INLINE_HANDLER_PAYLOAD = '<p>safe copy</p><img src=x onerror="window.__xss_fired = true">'

const SCRIPT_PAYLOAD = '<p>before</p><script>window.__xss_fired = true</script><p>after</p>'

const BENIGN_PAYLOAD = '<p>hello <strong>world</strong></p>'

describe('profile components — XSS regression at dangerouslySetInnerHTML sinks', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
    mockTranslation = ''
  })

  afterEach(() => {
    delete (window as any).__xss_fired
  })

  describe('ConfirmEmailAddress', () => {
    const renderWithPayload = (payload: string) => {
      mockTranslation = payload
      return render(
        <ConfirmEmailAddress email="ignored@example.com" onClose={() => {}}>
          <div />
        </ConfirmEmailAddress>,
      )
    }

    it('strips inline event handlers from the interpolated message', () => {
      const {baseElement} = renderWithPayload(INLINE_HANDLER_PAYLOAD)
      expectNoEventHandlers(baseElement as HTMLElement)
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags from the interpolated message', () => {
      const {baseElement} = renderWithPayload(SCRIPT_PAYLOAD)
      expect((baseElement as HTMLElement).querySelector('script')).toBeNull()
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('renders benign formatting tags unchanged', () => {
      const {baseElement} = renderWithPayload(BENIGN_PAYLOAD)
      expect((baseElement as HTMLElement).querySelector('strong')?.textContent).toBe('world')
      expectNoEventHandlers(baseElement as HTMLElement)
    })
  })

  describe('ConfirmCommunicationChannel', () => {
    const renderWithPayload = (payload: string) => {
      mockTranslation = payload
      return render(
        <ConfirmCommunicationChannel
          communicationChannel={{user_id: '1', pseudonym_id: '1', channel_id: '1'}}
          phoneNumberOrEmail="ignored@example.com"
          onClose={() => {}}
        >
          <div />
        </ConfirmCommunicationChannel>,
      )
    }

    it('strips inline event handlers from the interpolated message', () => {
      const {baseElement} = renderWithPayload(INLINE_HANDLER_PAYLOAD)
      expectNoEventHandlers(baseElement as HTMLElement)
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips <script> tags from the interpolated message', () => {
      const {baseElement} = renderWithPayload(SCRIPT_PAYLOAD)
      expect((baseElement as HTMLElement).querySelector('script')).toBeNull()
      expect((window as any).__xss_fired).toBeUndefined()
    })
  })
})

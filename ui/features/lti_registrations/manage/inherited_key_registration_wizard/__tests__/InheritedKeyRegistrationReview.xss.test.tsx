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

// Regression coverage for XSS via the inherited-key registration review
// screen. Two dangerouslySetInnerHTML sinks render attacker-influenced
// data from the tool registration:
//   - `toolConfiguration.description`
//   - `placement.text` (the per-placement label)
// Although both are passed through `htmlEscape`, downstream client code
// still injects them into the live DOM as raw HTML, so we apply DOMPurify
// at the sink as defense-in-depth.
//
// "Safety" assertion is "no event handler attribute survives in the
// rendered DOM" — DOMPurify legitimately allows formatting tags but
// strips on* handlers, so a tag may appear while remaining inert.

import {render, cleanup} from '@testing-library/react'
import React from 'react'
import {InheritedKeyRegistrationReview} from '../InheritedKeyRegistrationReview'
import {mockRegistration} from '../../pages/manage/__tests__/helpers'
import {success} from '../../../common/lib/apiResult/ApiResult'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = (root: HTMLElement) => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderReview = ({
  description,
  placementText,
}: {
  description?: string
  placementText?: string
}) => {
  const reg = mockRegistration('Test App', 1, {
    description: description ?? '',
    placements:
      placementText !== undefined
        ? [
            {
              placement: 'course_navigation',
              message_type: 'LtiResourceLinkRequest',
              text: placementText,
            },
          ]
        : [],
  })
  return render(<InheritedKeyRegistrationReview result={success(reg)} />)
}

describe('InheritedKeyRegistrationReview — XSS regression', () => {
  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    delete (window as any).__xss_fired
    cleanup()
  })

  describe('toolConfiguration.description sink (line ~158)', () => {
    it('strips inline event handlers from the description', () => {
      const malicious = '<img src=x onerror="window.__xss_fired=true">'
      const {container} = renderReview({description: malicious})

      expectNoEventHandlers(container)
      expect((window as any).__xss_fired).toBeUndefined()
      // No live <img> element with an event handler should reach the DOM.
      expect(container.querySelector('img')).toBeNull()
    })

    it('strips <script> tags from the description', () => {
      const malicious = '<p>before</p><script>window.__xss_fired=true</script><p>after</p>'
      const {container} = renderReview({description: malicious})

      expect(container.querySelector('script')).toBeNull()
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips javascript: hrefs from anchors in the description', () => {
      const malicious = '<a href="javascript:window.__xss_fired=true">click</a>'
      const {container} = renderReview({description: malicious})

      container.querySelectorAll('a[href]').forEach(a => {
        expect(a.getAttribute('href') || '').not.toMatch(/^\s*javascript:/i)
      })
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('renders the legitimate description text', () => {
      const {container} = renderReview({description: 'A perfectly normal description.'})

      expect(container.textContent).toMatch('A perfectly normal description.')
    })
  })

  describe('placement label sink (line ~173)', () => {
    it('strips inline event handlers from a placement label', () => {
      const malicious = '<img src=x onerror="window.__xss_fired=true">'
      const {container} = renderReview({placementText: malicious})

      expectNoEventHandlers(container)
      expect((window as any).__xss_fired).toBeUndefined()
      // No live <img> element with an event handler should reach the DOM.
      expect(container.querySelector('img')).toBeNull()
    })

    it('strips <script> tags from a placement label', () => {
      const malicious = '<p>label</p><script>window.__xss_fired=true</script>'
      const {container} = renderReview({placementText: malicious})

      expect(container.querySelector('script')).toBeNull()
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('strips javascript: hrefs from a placement label', () => {
      const malicious = '<a href="javascript:window.__xss_fired=true">label</a>'
      const {container} = renderReview({placementText: malicious})

      container.querySelectorAll('a[href]').forEach(a => {
        expect(a.getAttribute('href') || '').not.toMatch(/^\s*javascript:/i)
      })
      expect((window as any).__xss_fired).toBeUndefined()
    })

    it('renders the legitimate placement label text', () => {
      const {container} = renderReview({placementText: 'Course Navigation Label'})

      expect(container.textContent).toMatch('Course Navigation Label')
    })
  })
})

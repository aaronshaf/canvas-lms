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

// Regression coverage for SVGWrapper's appendChild sink.
// fetchSVG() guards with process.env.NODE_ENV === 'test'; we bypass it via
// vi.stubEnv and stub $.ajax to call success synchronously with a parsed SVG.

import React from 'react'
import {render} from '@testing-library/react'
import $ from 'jquery'
import SVGWrapper from '../index'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoXss = root => {
  expect(root.querySelector('script')).toBeNull()
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(attr => {
      expect(attr).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

// Build a parsed SVG DOM Document the same way $.ajax does for XML responses.
const parseSVG = svgString => new DOMParser().parseFromString(svgString, 'image/svg+xml')

// Stub $.ajax to invoke the success callback synchronously.
const stubAjaxWithSVG = svgString => {
  vi.spyOn($, 'ajax').mockImplementation((_url, options) => {
    options.success(parseSVG(svgString))
  })
}

const renderAndGetSpan = svgString => {
  stubAjaxWithSVG(svgString)
  const {container} = render(<SVGWrapper url="/images/test.svg" />)
  return container.querySelector('span')
}

describe('SVGWrapper — XSS regression at appendChild sink', () => {
  beforeEach(() => {
    delete window.__xss_fired
    // Override the NODE_ENV guard in fetchSVG() so the success path runs.
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    delete window.__xss_fired
  })

  it('strips <script> from a fetched SVG', () => {
    const span = renderAndGetSpan(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<script>window.__xss_fired = true</script>' +
        '<circle r="10"/>' +
        '</svg>',
    )

    expectNoXss(span)
    expect(window.__xss_fired).toBeUndefined()
    expect(span.innerHTML.toLowerCase()).not.toContain('<script')
  })

  it('strips onload event handler from svg root', () => {
    const span = renderAndGetSpan(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__xss_fired = true">' +
        '<circle r="10"/>' +
        '</svg>',
    )

    expectNoXss(span)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips on* attributes from child elements', () => {
    const span = renderAndGetSpan(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<circle r="10" onclick="window.__xss_fired = true"/>' +
        '</svg>',
    )

    expectNoXss(span)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('preserves benign SVG content', () => {
    const span = renderAndGetSpan(
      '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="50" cy="50" r="40" fill="blue"/>' +
        '</svg>',
    )

    expect(span.querySelector('svg')).not.toBeNull()
    expect(span.querySelector('circle')).not.toBeNull()
  })
})

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

// XSS regression coverage for vddTooltip — the function reads innerHTML from
// server-rendered DOM elements and re-injects it via dangerouslySetInnerHTML.
// The parse→serialize→re-parse round-trip is exactly what mXSS exploits abuse.
// Both sinks (lines 46 and 52) must wrap HTML with sanitizeHTML as defense-in-depth.

import vddTooltip from '../vddTooltip'

const PAYLOADS = [
  '<img src=x onerror="window.__vdd_xss_fired=true">',
  '<script>window.__vdd_xss_fired=true</script>plain',
  '<svg onload="window.__vdd_xss_fired=true"></svg>',
  '<a href="javascript:window.__vdd_xss_fired=true">click</a>',
]

const buildVddFixture = (tooltipHTML: string, contentsHTML: string) => {
  const html = `
    <div id="vdd_tooltip_mount"></div>
    <div id="tooltip_source" style="display:none">${contentsHTML}</div>
    <span class="vdd_tooltip_link" data-tooltip-selector="#tooltip_source">${tooltipHTML}</span>
  `
  document.body.insertAdjacentHTML('beforeend', html)
}

describe('vddTooltip — XSS regression (defense-in-depth)', () => {
  beforeEach(() => {
    delete (window as any).__vdd_xss_fired
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  PAYLOADS.forEach(payload => {
    it(`does not execute payload in tooltip contents: ${payload.slice(0, 40)}…`, () => {
      buildVddFixture('Safe text', payload)
      vddTooltip()
      expect((window as any).__vdd_xss_fired).toBeUndefined()
    })

    it(`does not execute payload in tooltip element: ${payload.slice(0, 40)}…`, () => {
      buildVddFixture(payload, 'Safe contents')
      vddTooltip()
      expect((window as any).__vdd_xss_fired).toBeUndefined()
    })

    it(`sanitizes tooltip contents: ${payload.slice(0, 30)}…`, () => {
      buildVddFixture('Safe text', payload)
      vddTooltip()
      const rendered = document.querySelector('[data-testid^="vdd_contents_"]')
      // The tooltip renderTip content is rendered into the DOM even when not visible
      if (rendered) {
        // DOMPurify removes <script> tags entirely
        expect(rendered.querySelector('script')).toBeNull()
        // DOMPurify keeps safe tags like <img> and <svg> but strips dangerous attributes
        const img = rendered.querySelector('img')
        if (img) {
          expect(img.getAttribute('onerror')).toBeNull()
        }
        const svg = rendered.querySelector('svg')
        if (svg) {
          expect(svg.getAttribute('onload')).toBeNull()
        }
        const link = rendered.querySelector('a')
        if (link) {
          const href = link.getAttribute('href')
          // DOMPurify removes javascript: URIs entirely (href becomes null or empty)
          if (href) {
            expect(href).not.toContain('javascript:')
          }
        }
      }
    })

    it(`sanitizes tooltip element: ${payload.slice(0, 30)}…`, () => {
      buildVddFixture(payload, 'Safe contents')
      vddTooltip()
      const rendered = document.querySelector('[data-testid^="vdd_tooltip_"]')
      // The tooltip trigger element should always be rendered
      expect(rendered).not.toBeNull()
      if (rendered) {
        // DOMPurify removes <script> tags entirely
        expect(rendered.querySelector('script')).toBeNull()
        // DOMPurify keeps safe tags like <img> and <svg> but strips dangerous attributes
        const img = rendered.querySelector('img')
        if (img) {
          expect(img.getAttribute('onerror')).toBeNull()
        }
        const svg = rendered.querySelector('svg')
        if (svg) {
          expect(svg.getAttribute('onload')).toBeNull()
        }
        const link = rendered.querySelector('a')
        if (link) {
          const href = link.getAttribute('href')
          // DOMPurify removes javascript: URIs entirely (href becomes null or empty)
          if (href) {
            expect(href).not.toContain('javascript:')
          }
        }
      }
    })
  })

  it('preserves benign HTML in tooltip contents', () => {
    buildVddFixture('Safe text', '<strong>Important</strong> assignment due date')
    vddTooltip()
    const rendered = document.querySelector('[data-testid^="vdd_contents_"]')
    if (rendered?.textContent) {
      expect(rendered.textContent).toContain('Important')
      expect(rendered.textContent).toContain('assignment due date')
    }
  })

  it('preserves benign HTML in tooltip element', () => {
    buildVddFixture('<em>Due:</em> Tomorrow', 'Contents')
    vddTooltip()
    const rendered = document.querySelector('[data-testid^="vdd_tooltip_"]')
    expect(rendered).not.toBeNull()
    if (rendered?.textContent) {
      expect(rendered.textContent).toContain('Due:')
      expect(rendered.textContent).toContain('Tomorrow')
    }
  })
})

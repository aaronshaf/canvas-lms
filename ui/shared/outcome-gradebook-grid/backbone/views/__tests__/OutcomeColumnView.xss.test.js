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
import 'jquery-migrate'

// jquery-popover requires real DOM positioning (jqueryui/position) which
// doesn't work in jsdom — stub it so we can exercise the template seam.
vi.mock('jquery-popover', () => ({
  // Must use function (not arrow) — vitest 4.x requires constructable mocks.
  default: vi.fn(function MockPopover() {
    return {
      el: $('<div>'),
      show: vi.fn(),
      hide: vi.fn(),
      on: vi.fn(),
    }
  }),
}))

const OutcomeColumnView = (await import('../OutcomeColumnView')).default

function buildView(attributes) {
  const el = $('<div></div>').appendTo(document.body)
  const view = new OutcomeColumnView({
    el,
    attributes,
    totalsFn: () => {},
  })
  // d3 chart rendering and jquery-popover positioning don't work in jsdom;
  // we only need the template output that createPopover produces.
  view.renderChart = () => {}
  return view
}

function renderedHTMLFor(view) {
  const originalTemplate = view.popover_template
  let captured = ''
  view.popover_template = data => {
    captured = originalTemplate(data)
    return captured
  }
  view.createPopover($.Event('mouseenter'))
  return captured
}

describe('OutcomeColumnView XSS hardening', () => {
  let view
  let originalEnv

  beforeEach(() => {
    originalEnv = global.ENV
    global.ENV = {GRADEBOOK_OPTIONS: {ACCOUNT_LEVEL_MASTERY_SCALES: true}}
  })

  afterEach(() => {
    if (view) view.remove()
    document.body.innerHTML = ''
    global.ENV = originalEnv
  })

  // outcomePopover.handlebars only renders description / friendly_description
  // when `path` is truthy (the "outcome detail" branch). Set it so the test
  // exercises the same template branch the popover/dialog hit in production.
  const base = {path: ['root'], ratings: []}

  it('html escapes friendly_description (treats as plain text)', () => {
    view = buildView({
      ...base,
      id: 1,
      title: 'Outcome 1',
      friendly_description: "<script>alert('xss')</script>safe",
    })
    const html = renderedHTMLFor(view)
    // Handlebars escapes quotes as &#x27;
    expect(html).toContain('&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;safe')
  })

  it('strips javascript: hrefs from description', () => {
    view = buildView({
      ...base,
      id: 3,
      title: 'Outcome 3',
      description: '<a href="javascript:window.__xssCol3=1">x</a>',
    })
    const html = renderedHTMLFor(view)
    expect(html).not.toMatch(/javascript:/i)
  })
})

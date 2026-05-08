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

// Regression coverage for stored-XSS class against outcome descriptions
// rendered via dangerouslySetInnerHTML. The "safety" assertion is "no event
// handler attribute survives in the rendered DOM" — DOMPurify legitimately
// allows benign tags like <img> but strips on* handlers and <script>, so the
// tag may appear while remaining inert.

import React from 'react'
import {render as rtlRender} from '@testing-library/react'
import OutcomeDescription from '../OutcomeDescription'
import OutcomesContext from '@canvas/outcomes/react/contexts/OutcomesContext'
import {defaultRatingsAndCalculationMethod} from './helpers'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const renderExpanded = description =>
  rtlRender(
    <OutcomesContext.Provider
      value={{
        env: {friendlyDescriptionFF: false, accountLevelMasteryScalesFF: true, isStudent: false},
      }}
    >
      <OutcomeDescription
        truncated={false}
        description={description}
        friendlyDescription=""
        calculationMethod={defaultRatingsAndCalculationMethod.calculationMethod}
        calculationInt={defaultRatingsAndCalculationMethod.calculationInt}
        masteryPoints={defaultRatingsAndCalculationMethod.masteryPoints}
        ratings={defaultRatingsAndCalculationMethod.ratings}
        setShouldExpand={() => {}}
      />
    </OutcomesContext.Provider>,
  )

describe('OutcomeDescription — XSS regression', () => {
  beforeEach(() => {
    delete window.__xss_fired
  })

  afterEach(() => {
    delete window.__xss_fired
  })

  it('strips inline event handlers from outcome descriptions', () => {
    const payload = '<p>before</p><img src=x onerror="window.__xss_fired = true"><p>after</p>'
    const {getByTestId} = renderExpanded(payload)
    const expanded = getByTestId('description-expanded')
    expectNoEventHandlers(expanded)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips <script> tags from outcome descriptions', () => {
    const payload = '<p>hello</p><script>window.__xss_fired = true</script><p>world</p>'
    const {getByTestId} = renderExpanded(payload)
    const expanded = getByTestId('description-expanded')
    expect(expanded.querySelector('script')).toBeNull()
    expect(expanded.innerHTML).not.toMatch(/<script/i)
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips javascript: URLs from anchor href attributes', () => {
    const payload = '<p>see <a href="javascript:window.__xss_fired = true">link</a></p>'
    const {getByTestId} = renderExpanded(payload)
    const expanded = getByTestId('description-expanded')
    const anchor = expanded.querySelector('a')
    if (anchor) {
      expect((anchor.getAttribute('href') || '').toLowerCase()).not.toMatch(/^javascript:/)
    }
    expectNoEventHandlers(expanded)
  })

  it('renders benign formatting unchanged', () => {
    const payload = '<p><strong>bold</strong> and <em>italic</em> text</p>'
    const {getByTestId} = renderExpanded(payload)
    const expanded = getByTestId('description-expanded')
    expect(expanded.querySelector('strong')).not.toBeNull()
    expect(expanded.querySelector('em')).not.toBeNull()
    expect(expanded.textContent).toContain('bold')
    expect(expanded.textContent).toContain('italic')
  })
})

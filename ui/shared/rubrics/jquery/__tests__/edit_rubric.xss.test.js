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

// XSS regression coverage for rubricEditing.onFindOutcome — the outcome
// description is round-tripped through innerHTML on a detached div before
// being extracted via textContent. The sink at line 221 must run untrusted
// HTML through sanitizeHTML (or use DOMParser) so a future refactor that
// swaps .text() for .html() does not silently introduce stored XSS.

import 'jquery-migrate'
import rubricEditing from '../edit_rubric'
import {vi} from 'vitest'

// Mock updateAddCriterionLinks to prevent React rendering errors in tests
vi.spyOn(rubricEditing, 'updateAddCriterionLinks').mockImplementation(() => {})

// Mock preventDuplicatedOutcome to always return false (no duplicate)
vi.spyOn(rubricEditing, 'preventDuplicatedOutcome').mockReturnValue(false)

const PAYLOADS = [
  '<img src=x onerror="window.__rubric_xss_fired=true">',
  '<script>window.__rubric_xss_fired=true</script>plain',
  '<svg onload="window.__rubric_xss_fired=true"></svg>',
  '<a href="javascript:window.__rubric_xss_fired=true">click</a>',
]

const buildRubricFixture = () => {
  const html = `
    <div class="rubric_holder rubric">
      <a id="add_learning_outcome_link" href="#"></a>
      <div class="rubric_title"><span class="title"></span></div>
      <table class="rubric_table" style="display:table">
        <tbody>
          <tr class="criterion blank">
            <td>
              <div class="long_description"></div>
              <div class="long_description_holder"></div>
              <span class="description_title"></span>
              <span class="outcome_sr_content"></span>
              <input class="criterion_description" />
              <input class="criterion_points" value="5" />
              <input class="mastery_points" />
              <span class="learning_outcome_id"></span>
              <a class="cancel_button"></a>
              <a class="delete_criterion_link"></a>
              <span class="rating blank"></span>
              <span class="rating"><a class="links"></a></span>
              <span class="hide_when_learning_outcome"></span>
            </td>
          </tr>
        </tbody>
      </table>
      <div id="add_criterion_holder"></div>
    </div>`
  document.body.insertAdjacentHTML('beforeend', html)

  // Force jQuery to recognize the table as visible by ensuring it's in the document
  // and has layout dimensions (JSDOM's :visible implementation checks offsetWidth/offsetHeight)
  const table = document.querySelector('.rubric_table')
  if (table) {
    // jsdom doesn't compute layout by default, so we need to make sure
    // the element will be treated as visible by jQuery's :visible selector
    Object.defineProperty(table, 'offsetWidth', {get: () => 100, configurable: true})
    Object.defineProperty(table, 'offsetHeight', {get: () => 100, configurable: true})
  }
}

const fakeOutcome = description => ({
  id: 1,
  useForScoring: true,
  get(key) {
    return {
      mastery_points: 3,
      ratings: [{points: 5}, {points: 3}, {points: 0}],
      description,
      title: 'Outcome title',
    }[key]
  },
})

describe('rubricEditing.onFindOutcome — XSS regression (defense-in-depth)', () => {
  beforeEach(() => {
    delete window.__rubric_xss_fired
    buildRubricFixture()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  PAYLOADS.forEach(payload => {
    it(`does not execute payload: ${payload.slice(0, 40)}…`, () => {
      rubricEditing.onFindOutcome(fakeOutcome(payload))
      expect(window.__rubric_xss_fired).toBeUndefined()
    })

    it(`renders ${payload.slice(0, 30)}… as text only — no event handlers, no <script>`, () => {
      rubricEditing.onFindOutcome(fakeOutcome(payload))
      const desc = document.querySelector('.long_description')
      expect(desc).not.toBeNull()
      expect(desc.querySelector('script')).toBeNull()
      expect(desc.querySelector('img')).toBeNull()
      expect(desc.querySelector('svg')).toBeNull()
      desc.querySelectorAll('*').forEach(el => {
        el.getAttributeNames().forEach(name => {
          expect(name).not.toMatch(/^on[a-z]+$/i)
        })
      })
    })
  })

  it('preserves benign plain-text outcome descriptions', () => {
    rubricEditing.onFindOutcome(fakeOutcome('Demonstrates mastery of subject.'))
    const desc = document.querySelector('.criterion:not(.blank) .long_description')
    expect(desc).not.toBeNull()
    expect(desc.textContent).toContain('Demonstrates mastery of subject.')
  })
})

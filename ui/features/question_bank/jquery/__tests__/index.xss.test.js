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

// Regression coverage for the question_bank "more questions" sink. The
// handler in jquery/index.js fetches paginated questions via $.ajaxJSON
// and renders each question's `question_text` into the page using
// jQuery's `.html()` (via templateData htmlValues). The field can carry
// rich-content HTML (round-trips through the RCE), so without
// sanitization an attacker-controlled payload would land as live DOM.
// CFA-883 routes the value through the shared `@canvas/sanitize-html`
// DOMPurify wrapper.

import $ from 'jquery'
import {attachPageEvents} from '../index'

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildFixture = () => {
  const fixture = document.createElement('div')
  fixture.id = 'fixtures'
  fixture.innerHTML = `
    <div id="bank_urls" style="display:none">
      <a class="more_questions_url" href="/api/v1/question_banks/1/questions?page={{ page }}"></a>
    </div>
    <a class="more_questions_link" href="/api/v1/question_banks/1/questions?page={{ page }}">more</a>
    <div id="more_questions" data-current-page="1" data-total-pages="2"></div>
    <div id="questions"></div>
    <div id="question_teaser_blank" class="question_holder" style="display:none">
      <a class="question_name"></a>
      <div class="question_text"></div>
      <span class="assessment_question_id"></span>
    </div>
  `
  document.body.appendChild(fixture)
  return fixture
}

describe('question_bank — XSS regression', () => {
  let fixture
  let originalAjaxJSON

  beforeEach(() => {
    delete window.__xss_fired
    fixture = buildFixture()
    originalAjaxJSON = $.ajaxJSON
    // Wire up the click handler exposed by the legacy jQuery entry-point.
    attachPageEvents()
  })

  afterEach(() => {
    fixture.remove()
    if (originalAjaxJSON === undefined) {
      delete $.ajaxJSON
    } else {
      $.ajaxJSON = originalAjaxJSON
    }
    delete window.__xss_fired
  })

  const triggerMoreQuestionsWithText = questionText => {
    // Stub $.ajaxJSON to immediately invoke the success callback with a
    // single question whose question_text carries the XSS payload.
    $.ajaxJSON = (_url, _method, _data, success) => {
      success({
        questions: [
          {
            assessment_question: {
              id: 42,
              question_data: {
                question_name: 'Q1',
                question_text: questionText,
              },
            },
          },
        ],
      })
    }
    $('.more_questions_link').trigger('click')
  }

  it('strips inline event handlers from rendered question_text', () => {
    triggerMoreQuestionsWithText('<p>real text</p><img src=x onerror="window.__xss_fired = true">')

    const teaser = fixture.querySelector('#question_teaser_42')
    expect(teaser).not.toBeNull()
    expectNoEventHandlers(teaser)
    expect(teaser.innerHTML).not.toMatch(/\son[a-z]+\s*=/i)
    expect(window.__xss_fired).toBeUndefined()
    // Benign content survives.
    expect(teaser.textContent).toContain('real text')
  })

  it('strips <script> tags from rendered question_text', () => {
    triggerMoreQuestionsWithText(
      '<p>before</p><script>window.__xss_fired = true</script><p>after</p>',
    )

    const teaser = fixture.querySelector('#question_teaser_42')
    expect(teaser).not.toBeNull()
    expect(teaser.querySelector('script')).toBeNull()
    expect(teaser.innerHTML.toLowerCase()).not.toContain('<script')
    expect(window.__xss_fired).toBeUndefined()
  })

  it('does not promote a title-attribute breakout payload into a live event handler', () => {
    // Defense-in-depth shape: even if the input text contains tag-like
    // content inside a title attribute and a downstream string mutator
    // were to break the attribute boundary, the sink-level sanitizer
    // must strip any resulting on* handler in the rendered DOM.
    triggerMoreQuestionsWithText(
      '<p title="<a ><img src=x onerror=\'window.__xss_fired = true\'>">visible</p>',
    )

    const teaser = fixture.querySelector('#question_teaser_42')
    expect(teaser).not.toBeNull()
    expectNoEventHandlers(teaser)
    expect(window.__xss_fired).toBeUndefined()
  })
})

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

// XSS regression tests for moveMultipleQuestionBanks.onData().
// Verifies that question_text is passed through sanitizeHTML before
// the Handlebars template renders it via triple-braces (unescaped HTML),
// matching the sanitization already applied on the single-question path.

import moveQuestions from '../moveMultipleQuestionBanks'

function makeData(questionText) {
  return {
    questions: [
      {
        assessment_question: {
          id: '42',
          question_data: {
            question_name: 'Q1',
            question_text: questionText,
          },
        },
      },
    ],
    pages: 1,
  }
}

describe('moveMultipleQuestionBanks XSS hardening', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="move_question_dialog">
        <ul class="questions"></ul>
      </div>
    `
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('strips onerror event handlers from question_text before DOM insertion', () => {
    const data = makeData('<img src="x" onerror="window.__xss_fired=true">')
    moveQuestions.onData(data)

    const img = document.querySelector('#move_question_dialog .list_question_text img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('onerror')).toBeNull()
    expect(window.__xss_fired).toBeUndefined()
  })

  it('strips javascript: hrefs from question_text before DOM insertion', () => {
    const data = makeData('<a href="javascript:window.__xss_link=true">click</a>')
    moveQuestions.onData(data)

    const anchor = document.querySelector('#move_question_dialog .list_question_text a')
    expect(anchor).not.toBeNull()
    const href = anchor.getAttribute('href') ?? ''
    expect(href).not.toMatch(/^javascript:/i)
  })

  it('preserves safe HTML in question_text', () => {
    const data = makeData('<strong>Bold question</strong>')
    moveQuestions.onData(data)

    const strong = document.querySelector('#move_question_dialog .list_question_text strong')
    expect(strong).not.toBeNull()
    expect(strong.textContent).toBe('Bold question')
  })
})

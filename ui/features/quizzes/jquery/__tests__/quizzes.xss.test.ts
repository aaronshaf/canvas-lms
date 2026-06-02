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

// Regression coverage for the question_text / text_after_answers jQuery sinks
// in quiz.updateDisplayQuestion. Both were writing raw() HTML to the DOM;
// they now go through sanitizeHTML() before insertion.

import $ from 'jquery'

// Polyfill jQuery plugin methods (jquery.instructure_forms side-effect import)
;[
  'formSubmit',
  'fillFormData',
  'getFormData',
  'formErrors',
  'errorBox',
  'fillTemplateData',
].forEach(method => {
  ;($ as any).fn[method] = vi.fn(function (this: unknown) {
    return this
  })
})

vi.mock('@canvas/rce/RichContentEditor', () => ({
  default: {
    preloadRemoteModule: vi.fn(),
    loadNewEditor: vi.fn(),
    destroyRCE: vi.fn(),
    callOnRCE: vi.fn(() => ''),
  },
}))
vi.mock('@canvas/due-dates', () => ({
  default: vi.fn(function MockDueDates() {
    return {render: vi.fn()}
  }),
}))
vi.mock('@canvas/due-dates/backbone/models/DueDateList', () => ({default: vi.fn()}))
vi.mock('@canvas/sections/backbone/collections/SectionCollection', () => ({default: vi.fn()}))
vi.mock('@canvas/due-dates/backbone/views/MissingDateDialogView', () => ({default: vi.fn()}))
vi.mock('@canvas/blueprint-courses/react/components/LockManager/index', () => ({
  default: vi.fn(function MockLockManager() {
    return {
      init: vi.fn(),
      isChildContent: vi.fn(() => false),
      getItemLocks: vi.fn(() => ({})),
    }
  }),
}))
vi.mock('@canvas/quizzes/backbone/models/Quiz', () => ({default: vi.fn()}))
vi.mock('@canvas/conditional-release-editor', () => ({default: {attach: vi.fn()}}))
vi.mock('../react/QuizRegradeModal', () => ({default: vi.fn(() => null)}))
vi.mock('./MultipleChoiceToggle', () => ({default: vi.fn()}))
vi.mock('@canvas/editor-toggle', () => ({default: vi.fn()}))
vi.mock('../quiz_formula_solution', () => ({default: vi.fn()}))
vi.mock('./quiz_labels', () => ({default: vi.fn()}))
vi.mock('@canvas/sis/SisValidationHelper', () => ({default: {}}))
vi.mock('deparam', () => ({default: vi.fn()}))
vi.mock('@canvas/jquery/jquery.ajaxJSON', () => ({}))
vi.mock('@canvas/jquery/jquery.instructure_forms', () => ({}))
vi.mock('jqueryui/dialog', () => ({}))
vi.mock('@canvas/datetime/jquery/DatetimeField', () => ({renderDatetimeField: vi.fn()}))
vi.mock('./calcCmd', () => ({default: {functionExamples: vi.fn(() => [])}}))

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoXss = (root: HTMLElement) => {
  expect(root.querySelector('script')).toBeNull()
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(attr => {
      expect(attr).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const buildQuestionFixture = () => {
  const $question = $(`
    <div class="question display_question">
      <div class="blank_id_select"></div>
      <div class="question_text"></div>
      <div class="text"><div class="answers"></div></div>
      <div class="original_question_text"></div>
      <div class="equation_combinations"></div>
      <div class="equation_combinations_holder_holder" style="display:none"></div>
      <div class="multiple_answer_sets_holder" style="display:none"></div>
      <div class="variable_definitions_holder" style="display:none"><tbody></tbody></div>
      <div class="formulas_holder" style="display:none"><div class="formulas_list"></div></div>
    </div>
  `)
  document.body.appendChild($question[0])
  return $question
}

let quizModule: typeof import('../quizzes')

beforeAll(async () => {
  quizModule = await import('../quizzes')
  await new Promise(resolve => setTimeout(resolve, 0))
})

describe('quiz.updateDisplayQuestion — XSS regression', () => {
  let $fixture: ReturnType<typeof $>

  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    $fixture?.remove()
    document.body.innerHTML = ''
    delete (window as any).__xss_fired
  })

  it('strips <script> from question_text in a missing_word_question', () => {
    $fixture = buildQuestionFixture()
    const {quiz} = quizModule

    quiz.updateDisplayQuestion(
      $fixture,
      {
        question_type: 'missing_word_question',
        question_text: 'Before <script>window.__xss_fired = true</script> after',
        text_after_answers: 'the answer',
        answers: [],
        points_possible: 1,
      },
      true,
    )

    const $qt = $fixture.find('.question_text')[0]
    expectNoXss($qt)
    expect((window as any).__xss_fired).toBeUndefined()
    expect($qt.innerHTML.toLowerCase()).not.toContain('<script')
  })

  it('strips inline event handlers from question_text', () => {
    $fixture = buildQuestionFixture()
    const {quiz} = quizModule

    quiz.updateDisplayQuestion(
      $fixture,
      {
        question_type: 'missing_word_question',
        question_text: '<img src=x onerror="window.__xss_fired = true">',
        text_after_answers: '',
        answers: [],
        points_possible: 1,
      },
      true,
    )

    const $qt = $fixture.find('.question_text')[0]
    expectNoXss($qt)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('strips <script> from text_after_answers', () => {
    $fixture = buildQuestionFixture()
    const {quiz} = quizModule

    quiz.updateDisplayQuestion(
      $fixture,
      {
        question_type: 'missing_word_question',
        question_text: 'pick one',
        text_after_answers: '<script>window.__xss_fired = true</script>',
        answers: [],
        points_possible: 1,
      },
      true,
    )

    const $qt = $fixture.find('.question_text')[0]
    expectNoXss($qt)
    expect((window as any).__xss_fired).toBeUndefined()
    expect($qt.innerHTML.toLowerCase()).not.toContain('<script')
  })
})

// addHTMLFeedback sanitizes HTML feedback before rendering
describe('addHTMLFeedback — XSS prevention', () => {
  let $fixture: ReturnType<typeof $>

  const buildFeedbackFixture = (commentType: string, htmlContent: string) => {
    // Build the question holder with pre-populated HTML feedback
    const $holder = $(`
      <div class="question_holder">
        <div id="question_1" class="question display_question multiple_choice_question">
          <span class="question_type">multiple_choice_question</span>
          <div class="text">
            <textarea name="question_text">Sample question text</textarea>
          </div>
          <div class="answers"></div>
          <div class="${commentType}">
            <div class="${commentType}_html"></div>
            <input type="hidden" />
          </div>
          <a class="edit_question_link" href="#">Edit</a>
        </div>
      </div>
    `)
    document.body.appendChild($holder[0])

    // Mock getTemplateData to return the malicious HTML
    ;($ as any).fn.getTemplateData = vi.fn(function (this: any) {
      return {
        question_type: 'multiple_choice_question',
        question_text: 'Sample question text',
        correct_comments: '',
        incorrect_comments: '',
        neutral_comments: '',
        correct_comments_html: commentType === 'correct_comments' ? htmlContent : '',
        incorrect_comments_html: commentType === 'incorrect_comments' ? htmlContent : '',
        neutral_comments_html: commentType === 'neutral_comments' ? htmlContent : '',
        question_name: '',
        question_points: '',
        answer_selection_type: '',
        blank_id: '',
        matching_answer_incorrect_matches: '',
        regrade_option: '',
        regrade_disabled: '',
      }
    })

    return $holder
  }

  const buildQuestionFormTemplate = () => {
    const $template = $(`
      <div id="question_form_template">
        <div class="question">
          <input name="question_type" value="multiple_choice_question" />
        </div>
        <div class="question_correct_comment">
          <div class="correct_comments_html"></div>
          <input type="hidden" />
        </div>
        <div class="question_incorrect_comment">
          <div class="incorrect_comments_html"></div>
          <input type="hidden" />
        </div>
        <div class="question_neutral_comment">
          <div class="neutral_comments_html"></div>
          <input type="hidden" />
        </div>
        <div class="answer_selection_type"></div>
        <div class="form_answers"></div>
      </div>
    `)
    document.body.appendChild($template[0])
    return $template
  }

  let _savedGetTemplateData: unknown

  beforeEach(() => {
    _savedGetTemplateData = ($ as any).fn.getTemplateData
    delete (window as any).__xss_fired
    buildQuestionFormTemplate()
  })

  afterEach(() => {
    // buildFeedbackFixture overrides $.fn.getTemplateData; restore it so later
    // describe blocks still see the real implementation.
    ;($ as any).fn.getTemplateData = _savedGetTemplateData
    $fixture?.remove()
    $('#question_form_template').remove()
    document.body.innerHTML = ''
    delete (window as any).__xss_fired
  })

  it('sanitizes <script> tags in correct_comments_html', () => {
    $fixture = buildFeedbackFixture(
      'correct_comments',
      '<script>window.__xss_fired = true</script>Good job!',
    )

    // Trigger the edit link which calls addHTMLFeedback
    $fixture.find('.edit_question_link').trigger('click')

    // The form is inserted after the question element
    const $insertedForm = $fixture.find('.display_question').next()
    const $feedbackEl = $insertedForm.find('.question_correct_comment .correct_comments_html')[0]

    expectNoXss($feedbackEl)
    expect((window as any).__xss_fired).toBeUndefined()
    expect($feedbackEl.innerHTML.toLowerCase()).not.toContain('<script')
  })

  it('sanitizes inline event handlers in incorrect_comments_html', () => {
    $fixture = buildFeedbackFixture(
      'incorrect_comments',
      '<img src=x onerror="window.__xss_fired = true">Try again',
    )

    $fixture.find('.edit_question_link').trigger('click')

    const $insertedForm = $fixture.find('.display_question').next()
    const $feedbackEl = $insertedForm.find(
      '.question_incorrect_comment .incorrect_comments_html',
    )[0]

    expectNoXss($feedbackEl)
    expect((window as any).__xss_fired).toBeUndefined()
  })

  it('sanitizes <script> tags in neutral_comments_html', () => {
    $fixture = buildFeedbackFixture(
      'neutral_comments',
      'Here is feedback <script>window.__xss_fired = true</script>',
    )

    $fixture.find('.edit_question_link').trigger('click')

    const $insertedForm = $fixture.find('.display_question').next()
    const $feedbackEl = $insertedForm.find('.question_neutral_comment .neutral_comments_html')[0]

    expectNoXss($feedbackEl)
    expect((window as any).__xss_fired).toBeUndefined()
    expect($feedbackEl.innerHTML.toLowerCase()).not.toContain('<script')
  })

  it('sanitizes javascript: protocol in correct_comments_html', () => {
    $fixture = buildFeedbackFixture(
      'correct_comments',
      '<a href="javascript:window.__xss_fired = true">Click me</a>',
    )

    $fixture.find('.edit_question_link').trigger('click')

    const $insertedForm = $fixture.find('.display_question').next()
    const $feedbackEl = $insertedForm.find('.question_correct_comment .correct_comments_html')[0]

    expectNoXss($feedbackEl)
    expect((window as any).__xss_fired).toBeUndefined()
    expect($feedbackEl.innerHTML.toLowerCase()).not.toContain('javascript:')
  })
})

// Regression: $tr was left unrenamed when $tr -> _ctr refactor was applied.
// Editing a calculated question threw: ReferenceError: $tr is not defined
describe('calculated question edit — $tr rename regression', () => {
  let $holder: ReturnType<typeof $>
  let updateFormSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Build the question DOM that quizData() reads from.
    // Variable "x" has one answer combination: x=5 -> 42.
    $holder = $(`
      <div class="question_holder">
        <div id="question_regr_1" class="question display_question calculated_question">
          <span class="question_type">calculated_question</span>
          <span class="question_points">1</span>
          <div class="original_question_text"></div>
          <div class="answers"></div>
          <div class="equation_combinations_holder_holder"></div>
          <div class="multiple_answer_sets_holder"></div>
          <div class="variable_definitions_holder">
            <table class="variable_definitions"><tbody>
              <tr>
                <td class="name">x</td>
                <td class="min">1</td>
                <td class="max">10</td>
                <td class="scale">0</td>
              </tr>
            </tbody></table>
          </div>
          <div class="formulas_holder"><div class="formulas_list"></div></div>
          <div class="equation_combinations">
            <table><tbody>
              <tr>
                <td>5</td>
                <td class="final_answer">42</td>
              </tr>
            </tbody></table>
          </div>
          <span class="formula_decimal_places">2</span>
          <span class="answer_tolerance"></span>
          <a class="edit_question_link" href="#">Edit</a>
        </div>
      </div>
    `)
    document.body.appendChild($holder[0] as HTMLElement)

    $(`
      <div id="question_form_template">
        <div class="question">
          <input name="question_type" value="calculated_question" />
        </div>
        <div class="form_answers"></div>
        <div class="answer_selection_type"></div>
        <div class="variables"></div>
        <input class="combination_count" type="text" />
        <div class="combinations_holder">
          <div class="combinations">
            <table>
              <thead><tr></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `).appendTo(document.body)

    updateFormSpy = vi
      .spyOn(quizModule.quiz, 'updateFormQuestion')
      .mockReturnValue({question_type: 'calculated_question'} as any)
  })

  afterEach(() => {
    $holder?.remove()
    $('#question_form_template').remove()
    document.body.innerHTML = ''
    updateFormSpy?.mockRestore()
  })

  it('does not throw when the edit link is clicked', () => {
    expect(() => {
      $holder.find('.edit_question_link').trigger('click')
    }).not.toThrow()
  })

  it('appends one <tr> to .combinations tbody for each answer', () => {
    $holder.find('.edit_question_link').trigger('click')
    // $form is inserted after the (now-hidden) .question element in the DOM
    const $insertedForm = $holder.find('.question').next()
    expect($insertedForm.find('.combinations tbody tr').length).toBe(1)
  })
})

// Regression coverage for the calculated-question "final answer" sink in
// quiz.updateDisplayQuestion. The answer is rendered with $td.html(), so it
// must be escaped. I18n.n returns its input verbatim when the value contains
// the letter "e" (it treats it as scientific notation), so an answer string
// like '1e<img onerror=...>' slips past number formatting unchanged — it must
// still be html-escaped before being written to the DOM.
describe('quiz.updateDisplayQuestion — calculated question answer XSS', () => {
  let $fixture: ReturnType<typeof $>

  const renderCalculatedQuestion = (answer: unknown) => {
    $fixture = buildQuestionFixture()
    const {quiz} = quizModule

    quiz.updateDisplayQuestion(
      $fixture,
      {
        question_type: 'calculated_question',
        question_text: 'compute the value',
        variables: [{name: 'x', min: 1, max: 10, scale: 0}],
        formulas: [{formula: 'x'}],
        formula_decimal_places: 2,
        answers: [{answer, variables: [{name: 'x', value: 5}]}],
        points_possible: 1,
      },
      true,
    )

    return $fixture.find('.equation_combinations .final_answer')[0]
  }

  beforeEach(() => {
    delete (window as any).__xss_fired
  })

  afterEach(() => {
    $fixture?.remove()
    document.body.innerHTML = ''
    delete (window as any).__xss_fired
  })

  it('escapes an <img onerror> answer that bypasses I18n.n via scientific notation', () => {
    const $cell = renderCalculatedQuestion('1e<img src=x onerror="window.__xss_fired = true">')

    expectNoXss($cell)
    expect($cell.querySelector('img')).toBeNull()
    expect((window as any).__xss_fired).toBeUndefined()
    // the payload survives as inert text, not as a live element
    expect($cell.textContent).toContain('<img')
  })

  it('escapes a <script> answer that bypasses I18n.n via scientific notation', () => {
    const $cell = renderCalculatedQuestion('1e<script>window.__xss_fired = true</script>')

    expectNoXss($cell)
    expect((window as any).__xss_fired).toBeUndefined()
    expect($cell.innerHTML.toLowerCase()).not.toContain('<script')
  })

  it('renders a legitimate scientific-notation answer as plain text', () => {
    const $cell = renderCalculatedQuestion('1.5e-7')

    expectNoXss($cell)
    expect($cell.textContent).toBe('1.5e-7')
  })
})

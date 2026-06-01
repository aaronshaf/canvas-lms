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
import RichContentEditor from '@canvas/rce/RichContentEditor'

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

let quizModule: typeof import('../quizzes')

beforeAll(async () => {
  quizModule = await import('../quizzes')
  await new Promise(resolve => setTimeout(resolve, 0))
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

// Covers selenium row spec/selenium/quizzes/quizzes_question_creation_spec.rb:106
// (fill_in_multiple_blanks blank_id_select populated from question_text placeholders)
// and spec/selenium/quizzes/quizzes_question_creation_spec.rb:176
// (multiple_dropdowns_question equivalent) and
// spec/selenium/quizzes/quizzes_question_creation_spec.rb:420
// (live update of blank_id_select when typing new placeholder).
describe('quiz.rebindMultiChange — [blank_id] placeholders populate blank_id_select', () => {
  const mountFormFixture = (questionType: string, contentId: string) => {
    const $form = $(`
      <div class="question_form">
        <div class="question ${questionType}">
          <input class="question_type" value="${questionType}" />
          <div class="question_content" id="${contentId}"></div>
          <select class="blank_id_select"></select>
        </div>
      </div>
    `)
    document.body.appendChild($form[0])
    return $form
  }

  it('populates blank_id_select with one option per unique [blank_id] for fill_in_multiple_blanks_question', () => {
    const $form = mountFormFixture('fill_in_multiple_blanks_question', 'qc_fimb_1')
    const {quiz} = quizModule
    ;(RichContentEditor.callOnRCE as ReturnType<typeof vi.fn>).mockReturnValue(
      'Roses are [color1], violets are [color2]',
    )

    const $select = $form.find('.blank_id_select')
    quiz.rebindMultiChange('fill_in_multiple_blanks_question', 'qc_fimb_1', $select)

    const opts = $select
      .find('option')
      .filter((_i, el) => !$(el).hasClass('shown_when_no_other_options_available'))
      .toArray()
      .map(el => $(el).val())
    expect(opts).toEqual(['color1', 'color2'])
  })

  it('populates blank_id_select with one option per unique [blank_id] for multiple_dropdowns_question', () => {
    const $form = mountFormFixture('multiple_dropdowns_question', 'qc_md_1')
    const {quiz} = quizModule
    ;(RichContentEditor.callOnRCE as ReturnType<typeof vi.fn>).mockReturnValue(
      'Roses are [color1], violets are [color2]',
    )

    const $select = $form.find('.blank_id_select')
    quiz.rebindMultiChange('multiple_dropdowns_question', 'qc_md_1', $select)

    const opts = $select
      .find('option')
      .filter((_i, el) => !$(el).hasClass('shown_when_no_other_options_available'))
      .toArray()
      .map(el => $(el).val())
    expect(opts).toEqual(['color1', 'color2'])
  })

  it('inserts a placeholder option when no [blank_id] tokens are present', () => {
    const $form = mountFormFixture('fill_in_multiple_blanks_question', 'qc_fimb_2')
    const {quiz} = quizModule
    ;(RichContentEditor.callOnRCE as ReturnType<typeof vi.fn>).mockReturnValue(
      'Roses are red, violets are blue',
    )

    const $select = $form.find('.blank_id_select')
    quiz.rebindMultiChange('fill_in_multiple_blanks_question', 'qc_fimb_2', $select)

    expect($select.find('option').length).toBe(1)
    expect($select.find('option.shown_when_no_other_options_available').length).toBe(1)
    expect($select.find('option').val()).toBe('0')
  })

  it('updates blank_id_select options live when the question_content change event refires with a new placeholder', () => {
    const $form = mountFormFixture('fill_in_multiple_blanks_question', 'qc_fimb_3')
    const {quiz} = quizModule
    const callOnRCE = RichContentEditor.callOnRCE as ReturnType<typeof vi.fn>

    callOnRCE.mockReturnValue('Roses are [color1]')
    const $select = $form.find('.blank_id_select')
    quiz.rebindMultiChange('fill_in_multiple_blanks_question', 'qc_fimb_3', $select)

    let opts = $select
      .find('option')
      .filter((_i, el) => !$(el).hasClass('shown_when_no_other_options_available'))
      .toArray()
      .map(el => $(el).val())
    expect(opts).toEqual(['color1'])

    // simulate typing a second placeholder; the bound change handler reruns
    callOnRCE.mockReturnValue('Roses are [color1], violets are [color2]')
    $form.find('#qc_fimb_3').trigger('change')

    opts = $select
      .find('option')
      .filter((_i, el) => !$(el).hasClass('shown_when_no_other_options_available'))
      .toArray()
      .map(el => $(el).val())
    expect(opts).toEqual(['color1', 'color2'])
  })

  it('does not bind a change handler for unrelated question types', () => {
    const $form = mountFormFixture('multiple_choice_question', 'qc_mc_1')
    const {quiz} = quizModule

    const $select = $form.find('.blank_id_select')
    quiz.rebindMultiChange('multiple_choice_question', 'qc_mc_1', $select)

    expect($select.find('option').length).toBe(0)
  })
})

// Covers selenium row spec/selenium/quizzes/quizzes_teacher_questions_spec.rb:161
// (numerical answer_exact field is rounded to 4 decimal places on blur).
describe('quiz.parseInput — float_long rounds to four decimal places', () => {
  it('rounds 0.000675 to 0.0007 when type is float_long', () => {
    const $input = $('<input type="text" name="answer_exact" />')
    document.body.appendChild($input[0])
    $input.val('0.000675')

    const {quiz} = quizModule
    quiz.parseInput($input, 'float_long')

    expect($input.val()).toBe('0.0007')
  })

  it('leaves an empty input untouched', () => {
    const $input = $('<input type="text" name="answer_exact" />')
    document.body.appendChild($input[0])
    $input.val('')

    const {quiz} = quizModule
    quiz.parseInput($input, 'float_long')

    expect($input.val()).toBe('')
  })

  it('treats non-numeric input as 0', () => {
    const $input = $('<input type="text" name="answer_exact" />')
    document.body.appendChild($input[0])
    $input.val('not a number')

    const {quiz} = quizModule
    quiz.parseInput($input, 'float_long')

    expect($input.val()).toBe('0')
  })
})

// Covers selenium row spec/selenium/quizzes/quizzes_teacher_questions_spec.rb:151
// (.points_possible reflects sum of all question_points after adding a question)
// and spec/selenium/quizzes/quizzes_teacher_questions_spec.rb:172
// (large totals use a thousands separator when rendered).
describe('quiz.calculatePointsPossible — sums question_points across .question_holder', () => {
  const mountQuestionHolders = (pointsList: string[]) => {
    const $container = $('<div id="questions"></div>')
    pointsList.forEach((pts, idx) => {
      const $holder = $(`
        <div class="question_holder">
          <div class="question" id="question_${idx + 1}">
            <span class="question_points">${pts}</span>
          </div>
        </div>
      `)
      $container.append($holder)
    })
    document.body.appendChild($container[0])
    return $container
  }

  it('returns 0 when no question holders exist', () => {
    document.body.appendChild($('<div id="questions"></div>')[0])
    const {quiz} = quizModule
    expect(quiz.calculatePointsPossible()).toBe(0)
  })

  it('sums a single multiple_choice question worth 50 points', () => {
    mountQuestionHolders(['50'])
    const {quiz} = quizModule
    expect(quiz.calculatePointsPossible()).toBe(50)
  })

  it('returns 60 after adding a 10-point question to a quiz with one 50-point question (50 + 10)', () => {
    mountQuestionHolders(['50', '10'])
    const {quiz} = quizModule
    expect(quiz.calculatePointsPossible()).toBe(60)
  })

  it('returns 1284.5 for 50 + 1234.5 (large decimal totals)', () => {
    mountQuestionHolders(['50', '1234.5'])
    const {quiz} = quizModule
    expect(quiz.calculatePointsPossible()).toBe(1284.5)
  })

  it('renders the calculated total into all .points_possible elements via updateDisplayComments', () => {
    mountQuestionHolders(['50', '1234.5'])
    $('<div class="points_possible"></div>').appendTo(document.body)
    const {quiz} = quizModule

    quiz.updateDisplayComments()

    // I18n.n() formats large numbers with a thousands separator (e.g. "1,284.5")
    // in default locale; we assert the human-formatted total ends up in the DOM.
    const rendered = $('.points_possible').text()
    expect(rendered).toBe('1,284.5')
  })

  it('skips #question_new placeholder rows when totalling', () => {
    const $container = $('<div id="questions"></div>')
    $container.append(`
      <div class="question_holder">
        <div class="question" id="question_1">
          <span class="question_points">50</span>
        </div>
      </div>
      <div class="question_holder">
        <div class="question" id="question_new">
          <span class="question_points">9999</span>
        </div>
      </div>
    `)
    document.body.appendChild($container[0])
    const {quiz} = quizModule
    expect(quiz.calculatePointsPossible()).toBe(50)
  })

  it('clamps negative or NaN question_points to 0', () => {
    mountQuestionHolders(['50', '-7', 'notanumber'])
    const {quiz} = quizModule
    expect(quiz.calculatePointsPossible()).toBe(50)
  })
})

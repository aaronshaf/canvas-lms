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
vi.mock('../MultipleChoiceToggle', () => ({default: vi.fn()}))
vi.mock('@canvas/editor-toggle', () => ({default: vi.fn()}))
vi.mock('../../quiz_formula_solution', () => ({default: vi.fn()}))
vi.mock('../quiz_labels', () => ({default: vi.fn()}))
vi.mock('@canvas/sis/SisValidationHelper', () => ({default: {}}))
vi.mock('deparam', () => ({default: vi.fn()}))
vi.mock('@canvas/jquery/jquery.ajaxJSON', () => ({}))
vi.mock('@canvas/jquery/jquery.instructure_forms', () => ({}))
vi.mock('jqueryui/dialog', () => ({}))
vi.mock('@canvas/datetime/jquery/DatetimeField', () => ({renderDatetimeField: vi.fn()}))
vi.mock('../calcCmd', () => ({default: {functionExamples: vi.fn(() => [])}}))

let quizModule: typeof import('../quizzes')

beforeAll(async () => {
  quizModule = await import('../quizzes')
  await new Promise(resolve => setTimeout(resolve, 0))
})

const buildQuestionsFixture = (pointValues: number[]) => {
  const holders = pointValues
    .map(
      (pts, i) => `
        <div class="question_holder">
          <div class="question" id="question_${i + 1}">
            <span class="question_points">${pts}</span>
          </div>
        </div>
      `,
    )
    .join('')
  const $display = $(`
    <div id="quiz_display_points_possible">
      <span class="points_possible"></span>
    </div>
  `)
  const $questions = $(`<div id="questions">${holders}</div>`)
  document.body.appendChild($questions[0])
  document.body.appendChild($display[0])
  return {$questions, $display}
}

describe('QuestionBank — quiz points tally after batch-add from question bank', () => {
  let $fixture: ReturnType<typeof buildQuestionsFixture>

  afterEach(() => {
    $fixture?.$questions.remove()
    $fixture?.$display.remove()
    document.body.innerHTML = ''
  })

  it('sums points_possible across all questions added from the bank (1 + 1 + 15 = 17)', () => {
    $fixture = buildQuestionsFixture([1, 1, 15])
    const {quiz} = quizModule

    const tally = quiz.calculatePointsPossible()

    expect(tally).toBe(17)
  })

  it('writes the tallied total into #quiz_display_points_possible .points_possible', () => {
    $fixture = buildQuestionsFixture([1, 1, 15])
    const {quiz} = quizModule

    quiz.updateDisplayComments()

    const text = document
      .querySelector('#quiz_display_points_possible .points_possible')
      ?.textContent?.trim()
    expect(text).toBe('17')
  })

  it('ignores negative and NaN question_points when tallying', () => {
    $fixture = buildQuestionsFixture([1, -3, 15])
    const {quiz} = quizModule

    const tally = quiz.calculatePointsPossible()

    expect(tally).toBe(16)
  })
})

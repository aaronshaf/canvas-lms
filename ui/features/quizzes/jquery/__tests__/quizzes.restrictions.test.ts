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

// Mirrors the structure emitted by app/views/quizzes/quizzes/_quiz_edit_details.erb
// for the two Quiz Restrictions option-groups. This is the DOM contract the new
// quiz page (GET /courses/:course_id/quizzes/new) is expected to render and that
// the change handlers in ui/features/quizzes/jquery/quizzes.jsx wire up to.
const QUIZ_RESTRICTIONS_FIXTURE = `
  <form id="quiz_options_form">
    <div class="option-group">
      <label class="checkbox" for="enable_quiz_access_code">
        <input type="checkbox" id="enable_quiz_access_code">
        Require an access code
      </label>
      <div class="options control-group form-control access-code screenreader-only">
        <label for="quiz_access_code" class="bold form-control__label">
          Required access code
        </label>
        <input type="text" tabindex="-1" name="quiz[access_code]" id="quiz_access_code" value="" />
      </div>
    </div>
    <div class="option-group">
      <label class="checkbox" for="enable_quiz_ip_filter">
        <input type="checkbox" id="enable_quiz_ip_filter">
        Filter IP Addresses
      </label>
      <div class="form-control ip-filter options control-group screenreader-only">
        <label for="quiz_ip_filter" class="bold form-control__label">
          Filter by IP address
        </label>
        <input type="text" tabindex="-1" name="quiz[ip_filter]" id="quiz_ip_filter" value="" />
      </div>
    </div>
  </form>
`

// Inject the fixture BEFORE importing ../quizzes so the module's ready() callback
// attaches its change handlers to these elements.
document.body.innerHTML = QUIZ_RESTRICTIONS_FIXTURE

beforeAll(async () => {
  await import('../quizzes')
  await new Promise(resolve => setTimeout(resolve, 0))
})

describe('quiz restrictions — new quiz page checkboxes', () => {
  describe('access-code restriction', () => {
    it('renders the #enable_quiz_access_code checkbox', () => {
      const checkbox = document.getElementById('enable_quiz_access_code') as HTMLInputElement
      expect(checkbox).not.toBeNull()
      expect(checkbox.type).toBe('checkbox')
    })

    it('renders the access-code checkbox inside an .option-group with the access-code input', () => {
      const checkbox = document.getElementById('enable_quiz_access_code') as HTMLInputElement
      const optionGroup = checkbox.closest('.option-group')
      expect(optionGroup).not.toBeNull()
      expect(optionGroup?.querySelector('#quiz_access_code')).not.toBeNull()
    })

    it('flips the access-code input tabindex from -1 to 0 when the checkbox is checked', () => {
      const $checkbox = $('#enable_quiz_access_code')
      const $accessCode = $('#quiz_access_code')
      $accessCode.attr('tabindex', '-1')
      $checkbox.prop('checked', false).trigger('change')
      expect($accessCode.attr('tabindex')).toBe('-1')

      $checkbox.prop('checked', true).trigger('change')
      expect($accessCode.attr('tabindex')).toBe('0')
    })
  })

  describe('ip-filter restriction', () => {
    it('renders the #enable_quiz_ip_filter checkbox', () => {
      const checkbox = document.getElementById('enable_quiz_ip_filter') as HTMLInputElement
      expect(checkbox).not.toBeNull()
      expect(checkbox.type).toBe('checkbox')
    })

    it('renders the ip-filter checkbox inside an .option-group with the ip-filter input', () => {
      const checkbox = document.getElementById('enable_quiz_ip_filter') as HTMLInputElement
      const optionGroup = checkbox.closest('.option-group')
      expect(optionGroup).not.toBeNull()
      expect(optionGroup?.querySelector('#quiz_ip_filter')).not.toBeNull()
    })

    it('flips the ip-filter input tabindex from -1 to 0 when the checkbox is checked', () => {
      const $checkbox = $('#enable_quiz_ip_filter')
      const $ipFilter = $('#quiz_ip_filter')
      $ipFilter.attr('tabindex', '-1')
      $checkbox.prop('checked', false).trigger('change')
      expect($ipFilter.attr('tabindex')).toBe('-1')

      $checkbox.prop('checked', true).trigger('change')
      expect($ipFilter.attr('tabindex')).toBe('0')
    })
  })
})

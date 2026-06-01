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

// Mock the broken `createErrorReporter` transitive dependency. The
// `@instructure/platform-generic-error-page` package shipped in the current
// snapshot does not export `createErrorReporter`, which causes
// `ui/shared/canvas-error-page/index.tsx` to throw at module-evaluation time
// when `@canvas/publish-icon-view` is loaded indirectly via
// `DelayedPublishDialog.jsx` -> `@canvas/canvas-error-page`.
vi.mock('@instructure/platform-generic-error-page', async () => {
  const actual = await vi.importActual('@instructure/platform-generic-error-page')
  return {
    ...actual,
    createErrorReporter: () => () => Promise.resolve(),
  }
})

import $ from 'jquery'
import {waitFor} from '@testing-library/react'
import Quiz from '@canvas/quizzes/backbone/models/Quiz'
import PublishIconView from '@canvas/publish-icon-view'
import fakeENV from '@canvas/test-utils/fakeENV'
import QuizItemView from '../QuizItemView'

$.fn.tooltip = vi.fn()
$.fn.simulate = vi.fn()

const PAST = '2020-01-01T00:00:00Z'
const DUE_AT_A = '2099-04-10T23:59:00Z'
const DUE_AT_B = '2099-05-20T23:59:00Z'
const LOCK_AT_A = '2099-06-01T23:59:00Z'
const UNLOCK_AT_B = '2099-07-01T00:00:00Z'

const buildQuiz = (overrides = {}) =>
  new Quiz({
    id: 1,
    title: 'Test Quiz',
    permissions: {delete: true, ...overrides.permissions},
    ...overrides,
  })

const buildView = (quiz, options = {}) => {
  const icon = new PublishIconView({model: quiz})

  ENV.PERMISSIONS = {
    manage: !!options.canManage,
    create: !!(options.canCreate || options.canManage),
    manage_assign_to: !!options.canManage,
  }
  ENV.FEATURES = ENV.FEATURES || {}
  ENV.FLAGS = {
    post_to_sis_enabled: false,
    migrate_quiz_enabled: false,
    DIRECT_SHARE_ENABLED: false,
    quiz_lti_enabled: false,
    show_additional_speed_grader_link: true,
  }
  ENV.context_asset_string = 'course_1'
  ENV.COURSE_ID = '1'
  ENV.SHOW_SPEED_GRADER_LINK = true
  ENV.current_user_roles = options.currentUserRoles || ['teacher']

  const view = new QuizItemView({model: quiz, publishIconView: icon})
  const $fixtures = $('<div id="fixtures" />').appendTo(document.body)
  view.$el.appendTo($fixtures)
  view.render()
  return view
}

// Manager-facing scenarios (teacher / TA): multiple due dates with section overrides
// produce a tooltip link "Multiple Dates" in both the date-due and date-available
// mount points. The selenium VDD specs verified the rendered tooltip text for
// teachers and TAs; at the component layer we assert that the section override
// plus a base "Everyone else" row produces the "Multiple Dates" affordance.
describe('QuizItemView varied due dates - manager actors (teacher, TA)', () => {
  let $fixtures

  beforeEach(() => {
    $fixtures = $('<div id="fixtures" />').appendTo(document.body)
    fakeENV.setup()
  })

  afterEach(() => {
    $fixtures.remove()
    fakeENV.teardown()
  })

  it('renders the due-date column with Multiple Dates link for teacher when quiz has Section A override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section A', due_at: DUE_AT_A, set_type: 'CourseSection'},
        {title: 'Everyone else', due_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['teacher']})

    expect(view.$('[data-view=date-due]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-due]').text()).toContain('Multiple Dates')
    })
  })

  it('renders the due-date column with Multiple Dates link for teacher when quiz has Section B override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section B', due_at: DUE_AT_B, set_type: 'CourseSection'},
        {title: 'Everyone else', due_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['teacher']})

    expect(view.$('[data-view=date-due]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-due]').text()).toContain('Multiple Dates')
    })
  })

  it('renders the availability column with Multiple Dates link for teacher when Section A has lock_at override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section A', unlock_at: PAST, lock_at: LOCK_AT_A, set_type: 'CourseSection'},
        {title: 'Everyone else', unlock_at: null, lock_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['teacher']})

    expect(view.$('[data-view=date-available]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-available]').text()).toContain('Multiple Dates')
    })
  })

  it('renders the availability column with Multiple Dates link for teacher when Section B has unlock_at override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section B', unlock_at: UNLOCK_AT_B, lock_at: null, set_type: 'CourseSection'},
        {title: 'Everyone else', unlock_at: null, lock_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['teacher']})

    expect(view.$('[data-view=date-available]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-available]').text()).toContain('Multiple Dates')
    })
  })

  it('renders the due-date column with Multiple Dates link for TA when quiz has Section A override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section A', due_at: DUE_AT_A, set_type: 'CourseSection'},
        {title: 'Everyone else', due_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['ta']})

    expect(view.$('[data-view=date-due]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-due]').text()).toContain('Multiple Dates')
    })
  })

  it('renders the due-date column with Multiple Dates link for TA when quiz has Section B override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section B', due_at: DUE_AT_B, set_type: 'CourseSection'},
        {title: 'Everyone else', due_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['ta']})

    expect(view.$('[data-view=date-due]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-due]').text()).toContain('Multiple Dates')
    })
  })

  it('renders the availability column with Multiple Dates link for TA when Section A has lock_at override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section A', unlock_at: PAST, lock_at: LOCK_AT_A, set_type: 'CourseSection'},
        {title: 'Everyone else', unlock_at: null, lock_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['ta']})

    expect(view.$('[data-view=date-available]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-available]').text()).toContain('Multiple Dates')
    })
  })

  it('renders the availability column with Multiple Dates link for TA when Section B has unlock_at override', async () => {
    const quiz = buildQuiz({
      all_dates: [
        {title: 'Section B', unlock_at: UNLOCK_AT_B, lock_at: null, set_type: 'CourseSection'},
        {title: 'Everyone else', unlock_at: null, lock_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['ta']})

    expect(view.$('[data-view=date-available]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-available]').text()).toContain('Multiple Dates')
    })
  })
})

// Student- and observer-facing scenarios: at the component layer, a non-manager
// actor sees the section override projected onto the model's own due_at /
// unlock_at / lock_at attributes (the API normalizes these per-user). We
// therefore set those attributes directly so DateDue / DateAvailable render
// the single-date affordance rather than the "Multiple Dates" tooltip.
describe('QuizItemView varied due dates - student and observer actors', () => {
  let $fixtures

  beforeEach(() => {
    $fixtures = $('<div id="fixtures" />').appendTo(document.body)
    fakeENV.setup()
  })

  afterEach(() => {
    $fixtures.remove()
    fakeENV.teardown()
  })

  it('renders Due label for a student in Section A with a section-specific due_at', async () => {
    const quiz = buildQuiz({
      due_at: DUE_AT_A,
      all_dates: [{title: 'Section A', due_at: DUE_AT_A, set_type: 'CourseSection'}],
    })
    const view = buildView(quiz, {currentUserRoles: ['student']})

    expect(view.$('[data-view=date-due]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-due]').text()).toContain('Due')
    })
  })

  it('renders "Available until" for a student in Section A with a section-specific lock_at', async () => {
    const quiz = buildQuiz({
      unlock_at: PAST,
      lock_at: LOCK_AT_A,
      all_dates: [
        {title: 'Section A', unlock_at: PAST, lock_at: LOCK_AT_A, set_type: 'CourseSection'},
      ],
    })
    const view = buildView(quiz, {currentUserRoles: ['student']})

    expect(view.$('[data-view=date-available]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-available]').text()).toContain('Available until')
    })
  })

  it('renders Due label for a student in Section B with a section-specific due_at', async () => {
    const quiz = buildQuiz({
      due_at: DUE_AT_B,
      all_dates: [{title: 'Section B', due_at: DUE_AT_B, set_type: 'CourseSection'}],
    })
    const view = buildView(quiz, {currentUserRoles: ['student']})

    expect(view.$('[data-view=date-due]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-due]').text()).toContain('Due')
    })
  })

  it('renders "Not available until" for a student in Section B with a future unlock_at', async () => {
    const quiz = buildQuiz({
      unlock_at: UNLOCK_AT_B,
      lock_at: null,
      all_dates: [
        {title: 'Section B', unlock_at: UNLOCK_AT_B, lock_at: null, set_type: 'CourseSection'},
      ],
    })
    const view = buildView(quiz, {currentUserRoles: ['student']})

    expect(view.$('[data-view=date-available]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-available]').text()).toContain('Not available until')
    })
  })

  it('renders Due label for an observer linked to a Section B student with a section-specific due_at', async () => {
    const quiz = buildQuiz({
      due_at: DUE_AT_B,
      all_dates: [{title: 'Section B', due_at: DUE_AT_B, set_type: 'CourseSection'}],
    })
    const view = buildView(quiz, {currentUserRoles: ['observer']})

    expect(view.$('[data-view=date-due]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-due]').text()).toContain('Due')
    })
  })

  it('renders "Not available until" for an observer linked to a Section B student with a future unlock_at', async () => {
    const quiz = buildQuiz({
      unlock_at: UNLOCK_AT_B,
      lock_at: null,
      all_dates: [
        {title: 'Section B', unlock_at: UNLOCK_AT_B, lock_at: null, set_type: 'CourseSection'},
      ],
    })
    const view = buildView(quiz, {currentUserRoles: ['observer']})

    expect(view.$('[data-view=date-available]')).toHaveLength(1)
    await waitFor(() => {
      expect(view.$('[data-view=date-available]').text()).toContain('Not available until')
    })
  })
})

// Course paces interaction: when the course has paces enabled, the quiz index
// should not render date-available or date-due mount points for a manager.
describe('QuizItemView with course paces enabled', () => {
  let $fixtures

  beforeEach(() => {
    $fixtures = $('<div id="fixtures" />').appendTo(document.body)
    fakeENV.setup()
  })

  afterEach(() => {
    $fixtures.remove()
    fakeENV.teardown()
  })

  it('does not render date-due or date-available mount points when the course has paces enabled', () => {
    const quiz = buildQuiz({
      title: 'Test Quiz',
      in_paced_course: true,
      all_dates: [
        {title: 'Section A', due_at: DUE_AT_A, set_type: 'CourseSection'},
        {title: 'Everyone else', due_at: null, base: true},
      ],
    })
    const view = buildView(quiz, {canManage: true, currentUserRoles: ['teacher']})

    expect(view.$el.text()).toContain('Test Quiz')
    expect(view.$('[data-view=date-available]')).toHaveLength(0)
    expect(view.$('[data-view=date-due]')).toHaveLength(0)
  })
})

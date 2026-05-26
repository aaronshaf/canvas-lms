/*
 * Copyright (C) 2024 - present Instructure, Inc.
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
import Assignment from '@canvas/assignments/backbone/models/Assignment'
import AssignmentGroupSelector from '@canvas/assignments/backbone/views/AssignmentGroupSelector'
import GradingTypeSelector from '@canvas/assignments/backbone/views/GradingTypeSelector'
import PeerReviewsSelector from '@canvas/assignments/backbone/views/PeerReviewsSelector'
import DueDateOverrideView from '@canvas/due-dates'
import DueDateList from '@canvas/due-dates/backbone/models/DueDateList'
import GroupCategorySelector from '@canvas/groups/backbone/views/GroupCategorySelector'
import RCELoader from '@canvas/rce/serviceRCELoader'
import SectionCollection from '@canvas/sections/backbone/collections/SectionCollection'
import Section from '@canvas/sections/backbone/models/Section'
import fakeENV from '@canvas/test-utils/fakeENV'
import {unfudgeDateForProfileTimezone} from '@instructure/moment-utils'
import EditView from '../EditView'
import '@canvas/jquery/jquery.simulate'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import {getUrlWithHorizonParams} from '@canvas/horizon/utils'

vi.mock('@canvas/rce/serviceRCELoader')

// Mock the horizon utils module
vi.mock('@canvas/horizon/utils', () => ({
  getUrlWithHorizonParams: vi.fn(),
}))

const s_params = 'some super secure params'
const currentOrigin = window.location.origin

// Mock RCE initialization
EditView.prototype._attachEditorToDescription = () => {}

// MSW server setup
const server = setupServer(
  http.get('/api/v1/courses/1/settings', () => {
    return HttpResponse.json({})
  }),
  http.get('/api/v1/courses/1/sections', () => {
    return HttpResponse.json([])
  }),
  http.get(/\/api\/v1\/courses\/\d+\/lti_apps\/launch_definitions.*/, () => {
    return HttpResponse.json([])
  }),
  http.post(/.*\/api\/graphql/, () => {
    return HttpResponse.json({})
  }),
)

const _createdViews = []
const editView = (assignmentOpts = {}) => {
  const defaultAssignmentOpts = {
    name: 'Test Assignment',
    secure_params: s_params,
    assignment_overrides: [],
  }
  assignmentOpts = {
    ...defaultAssignmentOpts,
    ...assignmentOpts,
  }
  const assignment = new Assignment(assignmentOpts)

  const sectionList = new SectionCollection([Section.defaultDueDateSection()])
  const dueDateList = new DueDateList(
    assignment.get('assignment_overrides'),
    sectionList,
    assignment,
  )

  const assignmentGroupSelector = new AssignmentGroupSelector({
    parentModel: assignment,
    assignmentGroups: ENV?.ASSIGNMENT_GROUPS || [],
  })
  const gradingTypeSelector = new GradingTypeSelector({
    parentModel: assignment,
    canEditGrades: ENV?.PERMISSIONS.can_edit_grades,
  })
  const groupCategorySelector = new GroupCategorySelector({
    parentModel: assignment,
    groupCategories: ENV?.GROUP_CATEGORIES || [],
    inClosedGradingPeriod: assignment.inClosedGradingPeriod(),
  })
  const peerReviewsSelector = new PeerReviewsSelector({parentModel: assignment})
  const app = new EditView({
    model: assignment,
    assignmentGroupSelector,
    gradingTypeSelector,
    groupCategorySelector,
    peerReviewsSelector,
    views: {
      'js-assignment-overrides': new DueDateOverrideView({
        model: dueDateList,
        views: {},
      }),
    },
    canEditGrades: ENV.PERMISSIONS.can_edit_grades || !assignment.gradedSubmissionsExist(),
  })

  const view = app.render()
  _createdViews.push(view)
  return view
}

const checkCheckbox = id => {
  document.getElementById(id).checked = true
}

const disableCheckbox = id => {
  document.getElementById(id).disabled = true
}

describe('EditView', () => {
  let fixtures

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    fixtures = document.createElement('div')
    fixtures.id = 'fixtures'
    fixtures.innerHTML = `
      <span data-component="ModeratedGradingFormFieldGroup"></span>
      <input id="annotatable_attachment_id" type="hidden" />
      <div id="annotated_document_usage_rights_container"></div>
    `
    document.body.appendChild(fixtures)

    fakeENV.setup({
      AVAILABLE_MODERATORS: [],
      current_user_roles: ['teacher'],
      HAS_GRADED_SUBMISSIONS: false,
      LOCALE: 'en',
      MODERATED_GRADING_ENABLED: true,
      MODERATED_GRADING_MAX_GRADER_COUNT: 2,
      VALID_DATE_RANGE: {},
      use_rce_enhancements: true,
      COURSE_ID: 1,
      USAGE_RIGHTS_REQUIRED: true,
      SETTINGS: {},
      FEATURES: {},
    })

    // Setup default mock for getUrlWithHorizonParams
    getUrlWithHorizonParams.mockImplementation((url, additionalParams) => {
      if (additionalParams && Object.keys(additionalParams).length > 0) {
        const separator = url.includes('?') ? '&' : '?'
        const params = new URLSearchParams(additionalParams).toString()
        return `${url}${separator}${params}`
      }
      return url
    })

    RCELoader.RCE = null
    return RCELoader.loadRCE()
  })

  afterEach(() => {
    _createdViews.splice(0).forEach(v => {
      try {
        v.moderatedGradingRoot?.unmount()
      } catch {}
      try {
        v.allowedAttemptsRoot?.unmount()
      } catch {}
      try {
        v.annotatedDocumentRoot?.unmount()
      } catch {}
      try {
        v.usageRightsRoot?.unmount()
      } catch {}
      try {
        v.defaultToolFormRoot?.unmount()
      } catch {}
      try {
        v.submissionTypeContainerRoot?.unmount()
      } catch {}
      try {
        v.submissionTypeSelectionDialogRoot?.unmount()
      } catch {}
      try {
        v.errorRoots && Object.values(v.errorRoots).forEach(r => r?.unmount())
      } catch {}
      try {
        v.remove()
      } catch {}
    })
    fakeENV.teardown()
    $('.ui-dialog').remove()
    $('ul[id^=ui-id-]').remove()
    $('.form-dialog').remove()
    fixtures.remove()
    server.resetHandlers()
    vi.clearAllMocks()
  })

  it('routes to return_to', () => {
    const view = editView({html_url: currentOrigin + '/foo'})
    expect(view.locationAfterSave({return_to: currentOrigin + '/bar'})).toBe(currentOrigin + '/bar')
  })

  describe('routes to the build page normally regardless of the return_to param', () => {
    let view

    beforeEach(() => {
      view = editView({html_url: 'http://foo'})
    })

    const testLocationAfterSave = (isFeatureFlagEnabled, expectedDisplay) => {
      ENV.FEATURES.new_quizzes_navigation_updates = isFeatureFlagEnabled
      vi.spyOn(view.assignment, 'showBuildButton').mockReturnValue(true)
      view.preventBuildNavigation = false

      expect(view.locationAfterSave({return_to: 'http://calendar'})).toBe(
        `http://foo?display=${expectedDisplay}`,
      )
    }

    it('returns with ?display=full_width_with_nav when feature flag is enabled', () => {
      testLocationAfterSave(true, 'full_width_with_nav')
    })

    it('returns with ?display=full_width when feature flag is disabled', () => {
      testLocationAfterSave(false, 'full_width')
    })
  })

  it('does not route to return_to with javascript protocol', () => {
    const view = editView({html_url: currentOrigin + '/foo'})
    expect(view.locationAfterSave({return_to: 'javascript:alert(1)'})).toBe(currentOrigin + '/foo')
  })

  it('cancels to env normally', () => {
    ENV.CANCEL_TO = currentOrigin + '/foo'
    const view = editView()
    expect(view.locationAfterCancel({})).toBe(currentOrigin + '/foo')
  })

  it('cancels to referrer if allowed', () => {
    Object.defineProperty(document, 'referrer', {
      value: currentOrigin + '/foo',
      configurable: true,
    })
    ENV.CAN_CANCEL_TO = [currentOrigin + '/foo']
    ENV.CANCEL_TO = currentOrigin + '/bar'
    const view = editView()
    expect(view.locationAfterCancel({})).toBe(currentOrigin + '/foo')
  })

  it('cancels to CANCEL_TO if referrer not allowed', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'http://evil.com',
      configurable: true,
    })
    ENV.CAN_CANCEL_TO = [currentOrigin + '/foo']
    ENV.CANCEL_TO = currentOrigin + '/bar'
    const view = editView()
    expect(view.locationAfterCancel({})).toBe(currentOrigin + '/bar')
  })

  it('cancels to return_to', () => {
    ENV.CANCEL_TO = currentOrigin + '/foo'
    const view = editView()
    expect(view.locationAfterCancel({return_to: currentOrigin + '/bar'})).toBe(
      currentOrigin + '/bar',
    )
  })

  it('does not cancel to return_to with javascript protocol', () => {
    ENV.CANCEL_TO = currentOrigin + '/foo'
    const view = editView()
    expect(view.locationAfterCancel({return_to: 'javascript:alert(1)'})).toBe(
      currentOrigin + '/foo',
    )
  })

  it('does not follow a cross-origin return_to', () => {
    ENV.CANCEL_TO = currentOrigin + '/foo'
    const view = editView()
    expect(view.locationAfterCancel({return_to: 'http://evil.com'})).toBe(currentOrigin + '/foo')
  })

  it('disableCheckbox is called for a disabled checkbox', () => {
    const view = editView({in_closed_grading_period: true})
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="checkbox_fixture"/>').appendTo($(view.$el))
    disableCheckbox('checkbox_fixture')
    expect(document.getElementById('checkbox_fixture').disabled).toBe(true)
  })

  it('keeps original due_at seconds if only the seconds value has changed', () => {
    const view = editView({
      due_at: unfudgeDateForProfileTimezone(new Date('2000-08-29T11:59:23')),
    })
    const override = view.assignment.attributes.assignment_overrides.models[0]
    expect(override.get('due_at').getSeconds()).toBe(23)
  })

  it('hides the build button for non NQ assignments', () => {
    const view = editView()
    expect(view.$el.find('button.build_button')).toHaveLength(0)
  })

  it('unchecks the group category checkbox if the anonymous grading checkbox is checked', () => {
    const view = editView()
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="assignment_anonymous_grading"/>').appendTo($(view.$el))
    checkCheckbox('assignment_anonymous_grading')
    expect(document.getElementById('assignment_anonymous_grading').checked).toBe(true)
  })

  describe('#togglePeerReviewsAndGroupCategoryEnabled', () => {
    it('locks down group category after students submit', () => {
      const view = editView({has_submitted_submissions: true})
      expect(view.$('.group_category_locked_explanation').length).toBeTruthy()
    })

    it('does not lock down group category if no students have submitted', () => {
      const view = editView({has_submitted_submissions: false})
      expect(view.$('.group_category_locked_explanation').length).toBeFalsy()
    })

    it('does not lock down group category if anonymous grading is enabled', () => {
      const view = editView({anonymous_grading: true})
      expect(view.$('.group_category_locked_explanation').length).toBeFalsy()
    })

    it('does not lock down group category if peer reviews are enabled', () => {
      const view = editView({peer_reviews: true})
      expect(view.$('.group_category_locked_explanation').length).toBeFalsy()
    })

    it('does not lock down group category if peer reviews are enabled and anonymous grading is enabled', () => {
      const view = editView({peer_reviews: true, anonymous_grading: true})
      expect(view.$('.group_category_locked_explanation').length).toBeFalsy()
    })
  })

  it('disables the group category checkbox if anonymous grading is enabled', () => {
    const view = editView({anonymous_grading: true})
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="group_category_checkbox"/>').appendTo($(view.$el))
    disableCheckbox('group_category_checkbox')
    expect(document.getElementById('group_category_checkbox').disabled).toBe(true)
  })

  it('disables the group category checkbox if peer reviews are enabled', () => {
    const view = editView({peer_reviews: true})
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="group_category_checkbox"/>').appendTo($(view.$el))
    disableCheckbox('group_category_checkbox')
    expect(document.getElementById('group_category_checkbox').disabled).toBe(true)
  })

  it('disables the group category checkbox if peer reviews are enabled and anonymous grading is enabled', () => {
    const view = editView({peer_reviews: true, anonymous_grading: true})
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="group_category_checkbox"/>').appendTo($(view.$el))
    disableCheckbox('group_category_checkbox')
    expect(document.getElementById('group_category_checkbox').disabled).toBe(true)
  })

  it('disables the group category checkbox if the assignment is in a closed grading period', () => {
    const view = editView({in_closed_grading_period: true})
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="group_category_checkbox"/>').appendTo($(view.$el))
    disableCheckbox('group_category_checkbox')
    expect(document.getElementById('group_category_checkbox').disabled).toBe(true)
  })

  it('disables the group category checkbox if the assignment is in a closed grading period and anonymous grading is enabled', () => {
    const view = editView({in_closed_grading_period: true, anonymous_grading: true})
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="group_category_checkbox"/>').appendTo($(view.$el))
    disableCheckbox('group_category_checkbox')
    expect(document.getElementById('group_category_checkbox').disabled).toBe(true)
  })

  it('disables the group category checkbox if the assignment is in a closed grading period and peer reviews are enabled', () => {
    const view = editView({in_closed_grading_period: true, peer_reviews: true})
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="group_category_checkbox"/>').appendTo($(view.$el))
    disableCheckbox('group_category_checkbox')
    expect(document.getElementById('group_category_checkbox').disabled).toBe(true)
  })

  it('disables the group category checkbox if the assignment is in a closed grading period and peer reviews are enabled and anonymous grading is enabled', () => {
    const view = editView({
      in_closed_grading_period: true,
      peer_reviews: true,
      anonymous_grading: true,
    })
    view.$el.appendTo($(fixtures))
    $('<input type="checkbox" id="group_category_checkbox"/>').appendTo($(view.$el))
    disableCheckbox('group_category_checkbox')
    expect(document.getElementById('group_category_checkbox').disabled).toBe(true)
  })
})

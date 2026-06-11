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
import {screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Assignment from '@canvas/assignments/backbone/models/Assignment'
import AssignmentGroupSelector from '@canvas/assignments/backbone/views/AssignmentGroupSelector'
import GradingTypeSelector from '@canvas/assignments/backbone/views/GradingTypeSelector'
import PeerReviewsSelector from '@canvas/assignments/backbone/views/PeerReviewsSelector'
import DueDateOverrideView from '@canvas/due-dates'
import DueDateList from '@canvas/due-dates/backbone/models/DueDateList'
import GroupCategorySelector from '@canvas/groups/backbone/views/GroupCategorySelector'
import SectionCollection from '@canvas/sections/backbone/collections/SectionCollection'
import Section from '@canvas/sections/backbone/models/Section'
import fakeENV from '@canvas/test-utils/fakeENV'
import {unfudgeDateForProfileTimezone} from '@instructure/moment-utils'
import React from 'react'
import EditView, {handleAbGuidMessage} from '../EditView'
import '@canvas/jquery/jquery.simulate'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'

// MSW server setup
const server = setupServer(
  http.get(/\/api\/v1\/courses\/\d+\/lti_apps\/launch_definitions/, () => {
    return HttpResponse.json([])
  }),
  http.get(/\/api\/v1\/courses\/\d+\/assignments\/\d+/, () => {
    return HttpResponse.json([])
  }),
  http.get(/\/api\/v1\/courses\/\d+\/settings/, () => {
    return HttpResponse.json({})
  }),
  http.get(/\/api\/v1\/courses\/\d+\/sections/, () => {
    return HttpResponse.json([])
  }),
  http.post('http://localhost/api/graphql', () => {
    return HttpResponse.json({
      data: {
        legacyNode: {
          id: '1',
          name: 'Test Course',
          enrollmentsConnection: {
            edges: [],
          },
        },
      },
    })
  }),
)

vi.mock('@canvas/rce/serviceRCELoader')
vi.mock('@canvas/external-tools/react/components/ExternalToolModalLauncher')
vi.mock('../../../react/AssignmentSubmissionTypeContainer')
vi.mock('@canvas/jquery/jquery.instructure_misc_helpers', () => ({}))
vi.mock('@canvas/common/activateTooltips', () => ({
  __esModule: true,
  default: vi.fn(),
}))
vi.mock('@canvas/grading-scheme', () => ({
  GradingSchemesSelector: vi.fn(() => null),
}))

// Mock jQuery UI components
$.fn.dialog = vi.fn()
$.fn.tooltip = vi.fn()

// Mock jQuery Widget Factory
const widgetPrototype = {
  _createWidget: vi.fn(),
  destroy: vi.fn(),
  option: vi.fn(),
}

// Must use function (not arrow) — vitest 4.x requires constructable mocks.
$.Widget = vi.fn(function MockWidget() {
  return widgetPrototype
})
$.Widget.prototype = widgetPrototype

// Mock widget creation
$.widget = vi.fn((name, base, prototype = {}) => {
  const [namespace, widgetName] = name.split('.')
  $[namespace] = $[namespace] || {}
  $[namespace][widgetName] = vi.fn()
  $.fn[widgetName] = vi.fn()
})

const s_params = 'some super secure params'
const currentOrigin = window.location.origin

// Mock RCE initialization
EditView.prototype._attachEditorToDescription = () => {}

const unmountViewRoots = v => {
  if (!v) return
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
}

const nameLengthHelper = (
  view,
  length,
  maxNameLengthRequiredForAccount,
  maxNameLength,
  postToSis,
  gradingType,
) => {
  const name = 'a'.repeat(length)
  window.ENV.MAX_NAME_LENGTH_REQUIRED_FOR_ACCOUNT = maxNameLengthRequiredForAccount
  window.ENV.MAX_NAME_LENGTH = maxNameLength
  return view.validateBeforeSave({name, post_to_sis: postToSis, grading_type: gradingType}, {})
}

const createEditView = (assignmentOpts = {}) => {
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
    assignmentGroups: window.ENV?.ASSIGNMENT_GROUPS || [],
  })
  const gradingTypeSelector = new GradingTypeSelector({
    parentModel: assignment,
    canEditGrades: window.ENV?.PERMISSIONS?.can_edit_grades,
  })
  const groupCategorySelector = new GroupCategorySelector({
    parentModel: assignment,
    groupCategories: window.ENV?.GROUP_CATEGORIES || [],
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
    canEditGrades: window.ENV.PERMISSIONS.can_edit_grades || !assignment.gradedSubmissionsExist(),
  })

  return app.render()
}

const checkCheckbox = id => {
  document.getElementById(id).checked = true
}

const disableCheckbox = id => {
  document.getElementById(id).disabled = true
}

beforeAll(() => server.listen())
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

describe('EditView#handleModeratedGradingChanged', () => {
  let view

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="fixtures">
        <div data-component="ModeratedGradingFormFieldGroup"></div>
        <div id="editor_tabs"></div>
        <div id="annotated_document_chooser_container"></div>
        <div id="assignment_annotated_document_info" style="display: none;"></div>
        <input type="checkbox" id="assignment_annotated_document" />
        <div id="annotated_document_usage_rights_container"></div>
        <div id="assignment_graded_assignment_fields"></div>
        <div id="assignment_external_tools"></div>
        <div id="assignment_peer_reviews_fields"></div>
        <div id="assignment_group_selector"></div>
        <div id="grading_type_selector"></div>
        <div id="group_category_selector"></div>
        <input type="checkbox" id="assignment_graders_anonymous_to_graders" />
        <label for="assignment_graders_anonymous_to_graders" style="display: none;">Graders Anonymous to Graders</label>
      </div>
    `

    fakeENV.setup({
      AVAILABLE_MODERATORS: [],
      current_user_roles: ['teacher'],
      HAS_GRADED_SUBMISSIONS: false,
      LOCALE: 'en',
      MODERATED_GRADING_ENABLED: true,
      MODERATED_GRADING_MAX_GRADER_COUNT: 2,
      VALID_DATE_RANGE: {},
      COURSE_ID: 1,
      PERMISSIONS: {
        can_edit_grades: true,
      },
      SETTINGS: {
        suppress_assignments: false,
      },
      context_asset_string: 'course_1',
      ASSIGNMENT_GROUPS: [],
      GROUP_CATEGORIES: [],
      USAGE_RIGHTS_REQUIRED: false,
      ROOT_FOLDER_ID: '1',
    })

    view = createEditView()
  })

  afterEach(() => {
    unmountViewRoots(view)
    fakeENV.teardown()
    document.body.innerHTML = ''
  })

  it('sets the moderated grading attribute on the assignment', () => {
    view.handleModeratedGradingChanged(true)
    expect(view.assignment.moderatedGrading()).toBe(true)
  })

  it('calls togglePeerReviewsAndGroupCategoryEnabled', () => {
    const toggleSpy = vi.spyOn(view, 'togglePeerReviewsAndGroupCategoryEnabled')
    view.handleModeratedGradingChanged(true)
    expect(toggleSpy).toHaveBeenCalledTimes(1)
  })

  it('reveals the "Graders Anonymous to Graders" option when passed true and grader comments are visible to graders', () => {
    view.assignment.graderCommentsVisibleToGraders(true)
    view.handleModeratedGradingChanged(true)
    const label = document.querySelector('label[for="assignment_graders_anonymous_to_graders"]')
    expect(label.style.display).not.toBe('none')
  })

  it('does not reveal the "Graders Anonymous to Graders" option when passed true and grader comments are not visible to graders', () => {
    view.handleModeratedGradingChanged(true)
    const label = document.querySelector('label[for="assignment_graders_anonymous_to_graders"]')
    expect(label.style.display).toBe('none')
  })

  it('calls uncheckAndHideGraderAnonymousToGraders when passed false', () => {
    const uncheckSpy = vi.spyOn(view, 'uncheckAndHideGraderAnonymousToGraders')
    view.handleModeratedGradingChanged(false)
    expect(uncheckSpy).toHaveBeenCalledTimes(1)
  })

  it('shows the moderated grading form fields when Moderated Grading is enabled', async () => {
    const checkbox = document.querySelector('#assignment_moderated_grading')
    checkbox.checked = true
    await userEvent.click(checkbox)

    const moderatedGradingFormGroup = document.querySelector(
      '[data-component="ModeratedGradingFormFieldGroup"]',
    )
    expect(moderatedGradingFormGroup.style.display).not.toBe('none')
  })

  it('hides the moderated grading form fields when Moderated Grading is disabled', () => {
    view.afterRender()
    const moderatedGradingFormGroup = document.querySelector(
      '[data-component="ModeratedGradingFormFieldGroup"]',
    )
    moderatedGradingFormGroup.style.display = 'none'
    view.handleModeratedGradingChanged(false)
    expect(moderatedGradingFormGroup.style.display).toBe('none')
  })
})

describe('EditView#handleMessageEvent', () => {
  let view

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="fixtures">
        <div data-component="ModeratedGradingFormFieldGroup"></div>
        <div id="editor_tabs"></div>
        <div id="annotated_document_chooser_container"></div>
        <div id="assignment_annotated_document_info" style="display: none;"></div>
        <input type="checkbox" id="assignment_annotated_document" />
        <div id="annotated_document_usage_rights_container"></div>
        <div id="assignment_graded_assignment_fields"></div>
        <div id="assignment_external_tools"></div>
        <div id="assignment_peer_reviews_fields"></div>
        <div id="assignment_group_selector"></div>
        <div id="grading_type_selector"></div>
        <div id="group_category_selector"></div>
        <input type="checkbox" id="assignment_graders_anonymous_to_graders" />
        <label for="assignment_graders_anonymous_to_graders" style="display: none;">Graders Anonymous to Graders</label>
      </div>
    `

    fakeENV.setup({
      AVAILABLE_MODERATORS: [],
      current_user_roles: ['teacher'],
      HAS_GRADED_SUBMISSIONS: false,
      LOCALE: 'en',
      MODERATED_GRADING_ENABLED: true,
      MODERATED_GRADING_MAX_GRADER_COUNT: 2,
      VALID_DATE_RANGE: {},
      COURSE_ID: 1,
      PERMISSIONS: {
        can_edit_grades: true,
      },
      SETTINGS: {
        suppress_assignments: false,
      },
      context_asset_string: 'course_1',
      ASSIGNMENT_GROUPS: [],
      GROUP_CATEGORIES: [],
      USAGE_RIGHTS_REQUIRED: false,
      ROOT_FOLDER_ID: '1',
      DEEP_LINKING_POST_MESSAGE_ORIGIN: currentOrigin,
    })

    view = createEditView()
  })

  afterEach(() => {
    unmountViewRoots(view)
    fakeENV.teardown()
    document.body.innerHTML = ''
  })

  const abGuidEvent = (overrides = {}) => ({
    origin: currentOrigin,
    data: {
      subject: 'assignment.set_ab_guid',
      data: ['1E20776E-7053-11DF-8EBF-BE719DFF4B22', '1e20776e-7053-11df-8eBf-Be719dff4b22'],
    },
    ...overrides,
  })

  it('sets ab_guid when subject is assignment.set_ab_guid and the ab_guid is formatted correctly', () => {
    view.handleMessageEvent(abGuidEvent())

    expect(view.assignment.get('ab_guid')).toEqual([
      '1E20776E-7053-11DF-8EBF-BE719DFF4B22',
      '1e20776e-7053-11df-8eBf-Be719dff4b22',
    ])
  })

  it('does not set ab_guid when subject is not assignment.set_ab_guid', () => {
    view.handleMessageEvent(
      abGuidEvent({
        data: {subject: 'some.other.subject', data: ['1E20776E-7053-11DF-8EBF-BE719DFF4B22']},
      }),
    )

    expect(view.assignment.has('ab_guid')).toBe(false)
  })

  it('does not set ab_guid when the ab_guid is not formatted correctly', () => {
    view.handleMessageEvent(
      abGuidEvent({
        data: {
          subject: 'assignment.set_ab_guid',
          data: ['not_an_ab_guid', '1e20776e-7053-11df-8eBf-Be719dff4b22'],
        },
      }),
    )

    expect(view.assignment.has('ab_guid')).toBe(false)
  })

  describe('origin guard', () => {
    it.each([
      ['foreign origin', 'https://evil.example.com'],
      ['typosquat origin', currentOrigin.replace('localhost', 'localhost.evil.com')],
      ['empty origin', ''],
      ['null origin', 'null'],
    ])('ignores assignment.set_ab_guid from %s', (_label, origin) => {
      view.handleMessageEvent(abGuidEvent({origin}))

      expect(view.assignment.has('ab_guid')).toBe(false)
    })

    it('ignores messages when DEEP_LINKING_POST_MESSAGE_ORIGIN is not configured', () => {
      ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN = undefined

      view.handleMessageEvent(abGuidEvent())

      expect(view.assignment.has('ab_guid')).toBe(false)
    })

    it('ignores messages when DEEP_LINKING_POST_MESSAGE_ORIGIN is empty', () => {
      ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN = ''

      view.handleMessageEvent(abGuidEvent({origin: ''}))

      expect(view.assignment.has('ab_guid')).toBe(false)
    })

    const appendIframe = (origin, source) => {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('src', `${origin}/courses/1/external_tools/9?display=borderless`)
      Object.defineProperty(iframe, 'contentWindow', {value: source, configurable: true})
      document.body.appendChild(iframe)
      return iframe
    }

    it('sets ab_guid when the cross-origin sender lives in a same-origin Canvas iframe', () => {
      const toolWindow = {}
      const iframe = appendIframe(window.location.origin, toolWindow)

      try {
        view.handleMessageEvent(
          abGuidEvent({origin: 'https://mastery.example.com', source: toolWindow}),
        )
        expect(view.assignment.get('ab_guid')).toEqual([
          '1E20776E-7053-11DF-8EBF-BE719DFF4B22',
          '1e20776e-7053-11df-8eBf-Be719dff4b22',
        ])
      } finally {
        iframe.remove()
      }
    })

    it('ignores set_ab_guid from an iframe whose src is cross-origin', () => {
      const toolWindow = {}
      const iframe = appendIframe('https://evil.example', toolWindow)

      try {
        view.handleMessageEvent(
          abGuidEvent({origin: 'https://mastery.example.com', source: toolWindow}),
        )
        expect(view.assignment.has('ab_guid')).toBe(false)
      } finally {
        iframe.remove()
      }
    })
  })

  it('processes LtiDeepLinkingResponse messages', () => {
    const messageData = {
      messageType: 'LtiDeepLinkingResponse',
      content_items: [
        {
          type: 'link',
          url: 'http://example.com',
          title: 'Example Link',
        },
      ],
    }

    const messageEvent = new MessageEvent('message', {
      data: messageData,
      origin: currentOrigin,
    })

    view.handleMessageEvent(messageEvent)
    // Add assertions based on what the handler should do with LtiDeepLinkingResponse
  })
})

describe('EditView#handlesuppressFromGradebookChange', () => {
  let view

  beforeEach(() => {
    fakeENV.setup({
      current_user_roles: ['teacher'],
      COURSE_ID: 1,
      SETTINGS: {
        suppress_assignments: true,
      },
      PERMISSIONS: {can_edit_grades: true},
      ASSIGNMENT_GROUPS: [],
      GROUP_CATEGORIES: [],
    })

    document.body.innerHTML = `<div id="fixtures"></div>`
    view = createEditView()
    view.render()

    view.$suppressAssignment = view.$el.find('#assignment_suppress_from_gradebook')

    $('#fixtures').append(view.$el)
  })

  afterEach(() => {
    unmountViewRoots(view)
    fakeENV.teardown()
    document.body.innerHTML = ''
  })

  it('registers the suppressAssignment element manually', () => {
    expect(view.$suppressAssignment).toHaveLength(1)
  })

  it('calls suppressAssignment on the model when checkbox is changed', () => {
    const spy = vi.spyOn(view.model, 'suppressAssignment').mockImplementation(() => {})

    view.$suppressAssignment = view.$el.find('#assignment_suppress_from_gradebook')
    expect(view.$suppressAssignment).toHaveLength(1)
    view.$suppressAssignment.prop('checked', true)

    view.handlesuppressFromGradebookChange()

    expect(spy).toHaveBeenCalledWith(true)
  })

  it('sets model.suppressAssignment to false when unchecked', () => {
    const spy = vi.spyOn(view.model, 'suppressAssignment').mockImplementation(() => {})

    view.$suppressAssignment = view.$el.find('#assignment_suppress_from_gradebook')
    expect(view.$suppressAssignment).toHaveLength(1)
    view.$suppressAssignment.prop('checked', false)

    view.handlesuppressFromGradebookChange()

    expect(spy).toHaveBeenCalledWith(false)
  })
})

describe('handleAbGuidMessage (exported helper)', () => {
  const trustedOrigin = 'https://canvas.example.com'
  const validUuid = '1E20776E-7053-11DF-8EBF-BE719DFF4B22'
  const validateGuidData = event => {
    const data = event.data.data
    const arr = Array.isArray(data) ? data : [data]
    const re = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/
    return arr.every(s => re.test(s)) ? arr : false
  }

  const buildEvent = (overrides = {}) => ({
    origin: trustedOrigin,
    data: {subject: 'assignment.set_ab_guid', data: [validUuid]},
    ...overrides,
  })

  it('invokes setAbGuid with parsed guids when origin matches', () => {
    const setAbGuid = vi.fn()
    handleAbGuidMessage(buildEvent(), {trustedOrigin, validateGuidData, setAbGuid})
    expect(setAbGuid).toHaveBeenCalledWith([validUuid])
  })

  it.each([
    ['foreign', 'https://evil.example.com'],
    ['typosquat', 'https://canvas.example.com.evil.com'],
    ['scheme downgrade', 'http://canvas.example.com'],
    ['empty', ''],
    ['null string', 'null'],
  ])('does not invoke setAbGuid for %s origin', (_label, origin) => {
    const setAbGuid = vi.fn()
    handleAbGuidMessage(buildEvent({origin}), {trustedOrigin, validateGuidData, setAbGuid})
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('does not invoke setAbGuid when trustedOrigin is missing', () => {
    const setAbGuid = vi.fn()
    handleAbGuidMessage(buildEvent(), {trustedOrigin: undefined, validateGuidData, setAbGuid})
    handleAbGuidMessage(buildEvent({origin: ''}), {trustedOrigin: '', validateGuidData, setAbGuid})
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('does not invoke setAbGuid for non-matching subject even on trusted origin', () => {
    const setAbGuid = vi.fn()
    handleAbGuidMessage(buildEvent({data: {subject: 'other.subject', data: [validUuid]}}), {
      trustedOrigin,
      validateGuidData,
      setAbGuid,
    })
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('does not invoke setAbGuid when payload fails validation', () => {
    const setAbGuid = vi.fn()
    handleAbGuidMessage(
      buildEvent({data: {subject: 'assignment.set_ab_guid', data: ['not-a-uuid']}}),
      {trustedOrigin, validateGuidData, setAbGuid},
    )
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('invokes setAbGuid for a cross-origin sender that is in a Canvas frame', () => {
    const setAbGuid = vi.fn()
    const toolWindow = {}
    handleAbGuidMessage(buildEvent({origin: 'https://mastery.example.com', source: toolWindow}), {
      trustedOrigin,
      validateGuidData,
      setAbGuid,
      isFromCanvasFrame: src => src === toolWindow,
    })
    expect(setAbGuid).toHaveBeenCalledWith([validUuid])
  })

  it('does not invoke setAbGuid for a cross-origin sender that is not in a Canvas frame', () => {
    const setAbGuid = vi.fn()
    handleAbGuidMessage(buildEvent({origin: 'https://evil.example.com', source: {}}), {
      trustedOrigin,
      validateGuidData,
      setAbGuid,
      isFromCanvasFrame: () => false,
    })
    expect(setAbGuid).not.toHaveBeenCalled()
  })
})

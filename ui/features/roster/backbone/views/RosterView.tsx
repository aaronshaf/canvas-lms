//
// Copyright (C) 2012 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import {useScope as createI18nScope} from '@canvas/i18n'
import $, {event} from 'jquery'
import Backbone from '@canvas/backbone'
import template from '../../jst/index.handlebars'
import ValidatedMixin from '@canvas/forms/backbone/views/ValidatedMixin'
import AddPeopleApp from '@canvas/add-people'
import React from 'react'
import {render, rerender} from '@canvas/react'
import {TextInput} from '@instructure/ui-text-input'
import {IconSearchLine} from '@instructure/ui-icons'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {initializeTopNavPortalWithDefaults} from '@canvas/top-navigation/react/TopNavPortalWithDefaults'
import UserDifferentiationTagManager from '@canvas/differentiation-tags/react/UserDifferentiationTagManager/UserDifferentiationTagManager'
import AlertManager from '@canvas/alerts/react/AlertManager'
import PeopleFilter from '@canvas/differentiation-tags/react/PeopleFilter/PeopleFilter'
import MessageBus from '@canvas/util/MessageBus'
import {QueryClientProvider} from '@tanstack/react-query'
import {queryClient} from '@canvas/query'
import {union} from 'es-toolkit/compat'

const I18n = createI18nScope('RosterView')

export default class RosterView extends Backbone.View {
  static initClass() {
    /* @ts-expect-error -- TODO: TSify */
    this.mixin(ValidatedMixin)

    /* @ts-expect-error -- TODO: TSify */
    this.child('usersView', '[data-view=users]')

    /* @ts-expect-error -- TODO: TSify */
    this.child('inputFilterView', '[data-view=inputFilter]')

    if (
      /* @ts-expect-error -- TODO: TSify */
      !ENV.permissions.can_manage_differentiation_tags ||
      /* @ts-expect-error -- TODO: TSify */
      !ENV.permissions.allow_assign_to_differentiation_tags
    ) {
      /* @ts-expect-error -- TODO: TSify */
      this.child('roleSelectView', '[data-view=roleSelect]')
    }

    /* @ts-expect-error -- TODO: TSify */
    this.child('resendInvitationsView', '[data-view=resendInvitations]')

    /* @ts-expect-error -- TODO: TSify */
    this.child('rosterTabsView', '[data-view=rosterTabs]')

    /* @ts-expect-error -- TODO: TSify */
    this.optionProperty('roles')

    /* @ts-expect-error -- TODO: TSify */
    this.optionProperty('permissions')

    /* @ts-expect-error -- TODO: TSify */
    this.optionProperty('course')

    /* @ts-expect-error -- TODO: TSify */
    this.prototype.template = template

    /* @ts-expect-error -- TODO: TSify */
    this.prototype.els = {
      '#addUsers': '$addUsersButton',
      '#createUsersModalHolder': '$createUsersModalHolder',
    }
    /* @ts-expect-error -- TODO: TSify */
    this.prototype.events = {
      'change .select-all-users-checkbox': 'handleSelectAllCheckboxChange',
    }
    /* @ts-expect-error -- TODO: TSify */
    const handleBreadCrumbSetter = ({getCrumbs, setCrumbs}) => {
      const crumbs = getCrumbs()
      crumbs.push({name: I18n.t('People'), url: ''})
      setCrumbs(crumbs)
    }
    initializeTopNavPortalWithDefaults({
      getBreadCrumbSetter: handleBreadCrumbSetter,
      useStudentView: true,
    })
  }

  /* @ts-expect-error -- TODO: TSify */
  constructor(options) {
    super(options)
    /* @ts-expect-error -- TODO: TSify */
    this.root = null
  }

  // When the master checkbox changes, either select everything or clear all.
  // Also resets the deselected list if we uncheck the master.
  /* @ts-expect-error -- TODO: TSify */
  handleSelectAllCheckboxChange(e) {
    const isChecked = e.currentTarget.checked
    /* @ts-expect-error -- TODO: TSify */
    this.collection.masterSelected = isChecked

    /* @ts-expect-error -- TODO: TSify */
    this.collection.lastCheckedIndex = null

    if (isChecked) {
      // Clear the de-selected list
      /* @ts-expect-error -- TODO: TSify */
      this.collection.deselectedUserIds = []

      // Collect all loaded user IDs that have a checkbox (students)
      /* @ts-expect-error -- TODO: TSify */
      const allUserIds = this.collection
        /* @ts-expect-error -- TODO: TSify */
        .filter(model => model.hasEnrollmentType('StudentEnrollment'))
        /* @ts-expect-error -- TODO: TSify */
        .map(m => m.id)

      /* @ts-expect-error -- TODO: TSify */
      this.collection.selectedUserIds = union(this.collection.selectedUserIds, allUserIds)
    } else {
      /* @ts-expect-error -- TODO: TSify */
      this.collection.selectedUserIds = []
      /* @ts-expect-error -- TODO: TSify */
      this.collection.deselectedUserIds = []
    }

    /* @ts-expect-error -- TODO: TSify */
    this.$('.select-user-checkbox').prop('checked', isChecked)
    this.updateSelectAllState()

    MessageBus.trigger('userSelectionChanged', {
      /* @ts-expect-error -- TODO: TSify */
      selectedUsers: this.collection.selectedUserIds,
      /* @ts-expect-error -- TODO: TSify */
      deselectedUserIds: this.collection.deselectedUserIds,
      /* @ts-expect-error -- TODO: TSify */
      masterSelected: this.collection.masterSelected,
    })
  }

  handleCollectionSync() {
    // If the user has “select all” turned on, automatically select newly loaded user IDs
    // except those specifically de-selected.
    /* @ts-expect-error -- TODO: TSify */
    if (this.collection.masterSelected) {
      /* @ts-expect-error -- TODO: TSify */
      let allUserIds = this.collection
        /* @ts-expect-error -- TODO: TSify */
        .filter(model => model.hasEnrollmentType('StudentEnrollment'))
        /* @ts-expect-error -- TODO: TSify */
        .map(m => m.id)

      // Exclude any that the user has specifically de-selected
      /* @ts-expect-error -- TODO: TSify */
      allUserIds = allUserIds.filter(id => !this.collection.deselectedUserIds.includes(id))

      /* @ts-expect-error -- TODO: TSify */
      this.collection.selectedUserIds = union(this.collection.selectedUserIds, allUserIds)

      /* @ts-expect-error -- TODO: TSify */
      this.$('.select-user-checkbox').prop('checked', true)
    }
    this.updateSelectAllState()
  }

  updateSelectAllState() {
    /* @ts-expect-error -- TODO: TSify */
    const $masterCheckbox = this.$('.select-all-users-checkbox')
    if (!$masterCheckbox.length) return

    /* @ts-expect-error -- TODO: TSify */
    const totalStudentCount = this.collection.filter(m =>
      m.hasEnrollmentType('StudentEnrollment'),
    ).length

    /* @ts-expect-error -- TODO: TSify */
    const selectedCount = this.collection.selectedUserIds.length

    if (selectedCount === 0) {
      $masterCheckbox.prop('indeterminate', false)
      $masterCheckbox.prop('checked', false)
    } else if (selectedCount === totalStudentCount) {
      $masterCheckbox.prop('indeterminate', false)
      $masterCheckbox.prop('checked', true)
      /* @ts-expect-error -- TODO: TSify */
      this.collection.masterSelected = true
    } else {
      $masterCheckbox.prop('checked', false)
      $masterCheckbox.prop('indeterminate', true)
    }
  }

  afterRender() {
    /* @ts-expect-error -- TODO: TSify */
    const container = this.$el.find('#search_input_container')[0]
    if (container) {
      /* @ts-expect-error -- TODO: TSify */
      this.root = render(
        <TextInput
          onChange={e => {
            // Sends events to hidden input to utilize backbone
            const hiddenInput = $('[data-view=inputFilter]')
            /* @ts-expect-error -- TODO: TSify */
            hiddenInput[0].value = e.target?.value
            hiddenInput.keyup()
          }}
          display="inline-block"
          type="text"
          placeholder={I18n.t('Search people')}
          renderLabel={
            <ScreenReaderContent>
              {I18n.t(
                'Search people. As you type in this field, the list of people will be automatically filtered to only include those whose names match your input.',
              )}
            </ScreenReaderContent>
          }
          renderBeforeInput={() => <IconSearchLine />}
        />,
        container,
      )
    }

    /* @ts-expect-error -- TODO: TSify */
    this.$addUsersButton.on('click', this.showCreateUsersModal.bind(this))
    /* @ts-expect-error -- TODO: TSify */
    this.mountUserDiffTagManager([])
    this.mountPeopleFilter()
    /* @ts-expect-error -- TODO: TSify */
    const canReadSIS = 'permissions' in ENV ? !!ENV.permissions.read_sis : true
    /* @ts-expect-error -- TODO: TSify */
    const canAddUser = role => role.addable_by_user

    /* @ts-expect-error -- TODO: TSify */
    return (this.addPeopleApp = new AddPeopleApp(this.$createUsersModalHolder[0], {
      courseId: (ENV.course && ENV.course.id) || 0,
      defaultInstitutionName: ENV.ROOT_ACCOUNT_NAME || '',
      /* @ts-expect-error -- TODO: TSify */
      roles: (ENV.ALL_ROLES || []).filter(canAddUser),
      sections: ENV.SECTIONS || [],
      onClose: () => this.fetchOnCreateUsersClose(),
      /* @ts-expect-error -- TODO: TSify */
      inviteUsersURL: ENV.INVITE_USERS_URL,
      canReadSIS,
    }))
  }

  attach() {
    MessageBus.on('userSelectionChanged', this.HandleUserSelected, this)
    MessageBus.on('removeUserTagIcon', this.removeTagIcon, this)
    MessageBus.on('reloadUsersTable', this.reloadUsersTable, this)
    MessageBus.on('peopleFilterChange', this.updatePeopleFilter, this)

    /* @ts-expect-error -- TODO: TSify */
    return this.collection.on('setParam deleteParam', this.fetch, this)
  }

  /* @ts-expect-error -- TODO: TSify */
  removeTagIcon(event) {
    if (event.hasOwnProperty('userId')) {
      $(`#tag-icon-id-${event.userId}`).remove()
    }
  }

  reloadUsersTable() {
    /* @ts-expect-error -- TODO: TSify */
    this.collection.masterSelected = false
    /* @ts-expect-error -- TODO: TSify */
    this.collection.deselectedUserIds = []
    /* @ts-expect-error -- TODO: TSify */
    this.collection.selectedUserIds = []

    /* @ts-expect-error -- TODO: TSify */
    this.collection.fetch()
    $('.select-user-checkbox').prop('checked', false).trigger('change')
  }
  /* @ts-expect-error -- TODO: TSify */
  updatePeopleFilter(event) {
    /* @ts-expect-error -- TODO: TSify */
    this.collection?.off('setParam deleteParam')
    /* @ts-expect-error -- TODO: TSify */
    this.collection?.deleteParam('differentiation_tag_id')
    /* @ts-expect-error -- TODO: TSify */
    this.collection?.deleteParam('enrollment_role_id')
    /* @ts-expect-error -- TODO: TSify */
    this.collection?.on('setParam deleteParam', this.fetch, this)
    if (!event || (typeof event === 'object' && Object.keys(event).length === 0)) {
      this.fetch()
      return
    }
    /* @ts-expect-error -- TODO: TSify */
    this.collection?.setParams(event)
  }

  fetchOnCreateUsersClose() {
    /* @ts-expect-error -- TODO: TSify */
    if (this.addPeopleApp.usersHaveBeenEnrolled()) {
      /* @ts-expect-error -- TODO: TSify */
      return this.collection.fetch()
    }
  }

  fetch() {
    /* @ts-expect-error -- TODO: TSify */
    if (this.lastRequest != null) {
      /* @ts-expect-error -- TODO: TSify */
      this.lastRequest.abort()
    }
    /* @ts-expect-error -- TODO: TSify */
    return (this.lastRequest = this.collection.fetch().fail(this.onFail.bind(this)))
  }

  course_id() {
    return ENV.context_asset_string.split('_')[1]
  }

  canAddCategories() {
    /* @ts-expect-error -- TODO: TSify */
    return ENV.canManageCourse
  }

  isHorizonCourse() {
    return ENV.horizon_course
  }

  toJSON() {
    return this
  }

  /* @ts-expect-error -- TODO: TSify */
  onFail(xhr) {
    if (xhr.statusText === 'abort') return
    const parsed = JSON.parse(xhr.responseText)
    const message =
      /* @ts-expect-error -- TODO: TSify */
      __guard__(parsed != null ? parsed.errors : undefined, x => x[0].message) ===
      '3 or more characters is required'
        ? I18n.t('greater_than_three', 'Please enter a search term with three or more characters')
        : I18n.t('unknown_error', 'Something went wrong with your search, please try again.')
    /* @ts-expect-error -- TODO: TSify */
    return this.showErrors({search_term: [{message}]})
  }

  showCreateUsersModal() {
    /* @ts-expect-error -- TODO: TSify */
    return this.addPeopleApp.open()
  }

  /* @ts-expect-error -- TODO: TSify */
  mountUserDiffTagManager(users, exceptions, allInCourse) {
    /* @ts-expect-error -- TODO: TSify */
    const userDTManager = this.$el.find('#userDiffTagManager')[0]
    if (
      userDTManager &&
      /* @ts-expect-error -- TODO: TSify */
      ENV.permissions.can_manage_differentiation_tags &&
      /* @ts-expect-error -- TODO: TSify */
      ENV.permissions.allow_assign_to_differentiation_tags
    ) {
      const component = (
        <QueryClientProvider client={queryClient}>
          <AlertManager breakpoints={{}}>
            <UserDifferentiationTagManager
              /* @ts-expect-error -- TODO: TSify */
              courseId={ENV.course.id}
              users={[...users]}
              allInCourse={allInCourse}
              userExceptions={exceptions}
            />
          </AlertManager>
        </QueryClientProvider>
      )
      /* @ts-expect-error -- TODO: TSify */
      if (!this.userDTManager) {
        /* @ts-expect-error -- TODO: TSify */
        this.userDTManager = render(component, userDTManager)
      } else {
        /* @ts-expect-error -- TODO: TSify */
        rerender(this.userDTManager, component)
      }
    }
  }

  mountPeopleFilter() {
    /* @ts-expect-error -- TODO: TSify */
    const peopleFilter = this.$el.find('#peopleFilterContainer')[0]
    if (
      peopleFilter &&
      /* @ts-expect-error -- TODO: TSify */
      ENV.permissions.can_manage_differentiation_tags &&
      /* @ts-expect-error -- TODO: TSify */
      ENV.permissions.allow_assign_to_differentiation_tags
    ) {
      /* @ts-expect-error -- TODO: TSify */
      const component = <PeopleFilter courseId={ENV.course.id} />
      /* @ts-expect-error -- TODO: TSify */
      if (!this.peopleFilter) {
        /* @ts-expect-error -- TODO: TSify */
        this.peopleFilter = render(component, peopleFilter)
      } else {
        /* @ts-expect-error -- TODO: TSify */
        rerender(this.peopleFilter, component)
      }
    }
  }

  /* @ts-expect-error -- TODO: TSify */
  HandleUserSelected(event) {
    this.updateSelectAllState()
    this.mountUserDiffTagManager(event.selectedUsers, event.deselectedUserIds, event.masterSelected)
  }

  remove() {
    /* @ts-expect-error -- TODO: TSify */
    if (this.root) {
      /* @ts-expect-error -- TODO: TSify */
      this.root.unmount()
      /* @ts-expect-error -- TODO: TSify */
      this.root = null
    }
    /* @ts-expect-error -- TODO: TSify */
    if (this.differentiationTagTrayRoot) {
      /* @ts-expect-error -- TODO: TSify */
      this.differentiationTagTrayRoot.unmount()
      /* @ts-expect-error -- TODO: TSify */
      this.differentiationTagTrayRoot = null
    }
    /* @ts-expect-error -- TODO: TSify */
    if (this.userDTManager) {
      /* @ts-expect-error -- TODO: TSify */
      this.userDTManager.unmount()
      /* @ts-expect-error -- TODO: TSify */
      this.userDTManager = null
    }
    super.remove()
  }
}
RosterView.initClass()
/* @ts-expect-error -- TODO: TSify */
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null ? transform(value) : undefined
}

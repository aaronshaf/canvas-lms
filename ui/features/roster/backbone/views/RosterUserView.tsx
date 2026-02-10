//
// Copyright (C) 2013 - present Instructure, Inc.
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
import $ from 'jquery'
import {map, some, every, find as _find, filter, reject, isEmpty} from 'es-toolkit/compat'
import {View} from '@canvas/backbone'
import template from '../../jst/rosterUser.handlebars'
import EditSectionsModal from '../../react/EditSectionsModal'
import EditRolesModal from '../../react/EditRolesModal'
import InvitationsView from './InvitationsView'
import React from 'react'
import {render, rerender} from '@canvas/react'
import {Avatar} from '@instructure/ui-avatar'
import LinkToStudents from '../../react/LinkToStudents'
import {nanoid} from 'nanoid'
import 'jquery-kyle-menu'
import '@canvas/jquery/jquery.disableWhileLoading'
import RosterDialogMixin from './RosterDialogMixin'
import UserTaggedModal from '@canvas/differentiation-tags/react/UserTaggedModal/UserTaggedModal'
import MessageBus from '@canvas/util/MessageBus'
import {queryClient} from '@canvas/query'
import {createSectionEnrollments, deleteExistingSectionEnrollments} from '../../react/api'

const I18n = createI18nScope('RosterUserView')

/* @ts-expect-error -- TODO: TSify */
let invitationDialog = null
/* @ts-expect-error -- TODO: TSify */
let editSectionsRoot = null
/* @ts-expect-error -- TODO: TSify */
let linkToStudentsRoot = null
/* @ts-expect-error -- TODO: TSify */
let editRolesRoot = null

export default class RosterUserView extends View {
  static initClass() {
    /* @ts-expect-error -- TODO: TSify */
    this.mixin(RosterDialogMixin)

    /* @ts-expect-error -- TODO: TSify */
    this.prototype.tagName = 'tr'

    /* @ts-expect-error -- TODO: TSify */
    this.prototype.className = 'rosterUser al-hover-container'

    /* @ts-expect-error -- TODO: TSify */
    this.prototype.template = template

    /* @ts-expect-error -- TODO: TSify */
    this.prototype.events = {
      'click .admin-links [data-event]': 'handleMenuEvent',
      'focus *': 'focus',
      'blur *': 'blur',
      'change .select-user-checkbox': 'handleCheckboxChange',
      'click .user-tags-icon': 'handleTagIconClick',
      'keydown .select-user-checkbox': 'handleKeyDown',
    }
  }

  attach() {
    $(document).on('keydown', e => {
      if (e.key === 'Shift') {
        /* @ts-expect-error -- TODO: TSify */
        this.isShiftPressed = true
      }
    })

    $(document).on('keyup', e => {
      if (e.key === 'Shift') {
        /* @ts-expect-error -- TODO: TSify */
        this.isShiftPressed = false
      }
    })

    /* @ts-expect-error -- TODO: TSify */
    return this.model.on('change', this.render, this)
  }

  /* @ts-expect-error -- TODO: TSify */
  initialize(options) {
    options.model.attributes.avatarId = `user-avatar-people-page-${nanoid()}`
    super.initialize(...arguments)
    // assumes this model only has enrollments for 1 role
    /* @ts-expect-error -- TODO: TSify */
    this.model.currentRole = __guard__(this.model.get('enrollments')[0], x => x.role)

    /* @ts-expect-error -- TODO: TSify */
    this.$el.attr('id', `user_${options.model.get('id')}`)

    /* @ts-expect-error -- TODO: TSify */
    this.isShiftPressed = false
    /* @ts-expect-error -- TODO: TSify */
    return Array.from(this.model.get('enrollments')).map(e => this.$el.addClass(e.type))
  }

  toJSON() {
    const json = super.toJSON(...arguments)
    this.permissionsJSON(json)
    this.observerJSON(json)
    this.contextCardJSON(json)
    /* @ts-expect-error -- TODO: TSify */
    const collection = this.model.collection
    if (collection && collection.masterSelected) {
      // If masterSelected is true, mark as selected unless explicitly de-selected.
      /* @ts-expect-error -- TODO: TSify */
      json.isSelected = !collection.deselectedUserIds.includes(this.model.id)
    } else {
      /* @ts-expect-error -- TODO: TSify */
      json.isSelected = collection?.selectedUserIds?.includes(this.model.id) ?? false
    }
    return json
  }

  /* @ts-expect-error -- TODO: TSify */
  contextCardJSON(json) {
    let enrollment
    if ((enrollment = _find(json.enrollments, e => e.type === 'StudentEnrollment'))) {
      return (json.course_id = enrollment.course_id)
    }
  }

  /* @ts-expect-error -- TODO: TSify */
  permissionsJSON(json) {
    /* @ts-expect-error -- TODO: TSify */
    json.url = `${ENV.COURSE_ROOT_URL}/users/${this.model.get('id')}`
    /* @ts-expect-error -- TODO: TSify */
    json.isObserver = this.model.hasEnrollmentType('ObserverEnrollment')
    /* @ts-expect-error -- TODO: TSify */
    json.isStudent = this.model.hasEnrollmentType('StudentEnrollment')
    /* @ts-expect-error -- TODO: TSify */
    json.isPending = this.model.pending(this.model.currentRole)
    /* @ts-expect-error -- TODO: TSify */
    json.isInactive = this.model.inactive()
    if (!json.isInactive) {
      json.enrollments = reject(json.enrollments, en => en.enrollment_state === 'inactive') // if not _completely_ inactive, treat the inactive enrollments as deleted
    }
    /* @ts-expect-error -- TODO: TSify */
    json.canRemoveUsers = every(this.model.get('enrollments'), e => e.can_be_removed)
    json.canResendInvitation =
      !json.isInactive &&
      /* @ts-expect-error -- TODO: TSify */
      some(this.model.get('enrollments'), en =>
        /* @ts-expect-error -- TODO: TSify */
        ENV.permissions.active_granular_enrollment_permissions.includes(en.type),
      )

    /* @ts-expect-error -- TODO: TSify */
    if (json.canRemoveUsers && !ENV.course.concluded) {
      json.canEditRoles = !some(
        /* @ts-expect-error -- TODO: TSify */
        this.model.get('enrollments'),
        e => e.type === 'ObserverEnrollment' && e.associated_user_id,
      )
    }

    /* @ts-expect-error -- TODO: TSify */
    json.canEditSections = !json.isInactive && !isEmpty(this.model.sectionEditableEnrollments())
    /* @ts-expect-error -- TODO: TSify */
    json.canLinkStudents = json.isObserver && !ENV.course.concluded
    /* @ts-expect-error -- TODO: TSify */
    json.canViewLoginIdColumn = ENV.permissions.view_user_logins
    /* @ts-expect-error -- TODO: TSify */
    json.canViewSisIdColumn = ENV.permissions.read_sis
    json.canManageDifferentiationTags =
      /* @ts-expect-error -- TODO: TSify */
      ENV.permissions.can_manage_differentiation_tags &&
      /* @ts-expect-error -- TODO: TSify */
      ENV.permissions.allow_assign_to_differentiation_tags

    /* @ts-expect-error -- TODO: TSify */
    const canDoAdminActions = ENV.permissions.can_allow_course_admin_actions
    if (
      some(['TeacherEnrollment', 'DesignerEnrollment', 'TaEnrollment'], et =>
        /* @ts-expect-error -- TODO: TSify */
        this.model.hasEnrollmentType(et),
      )
    ) {
      json.canManage = canDoAdminActions
      /* @ts-expect-error -- TODO: TSify */
    } else if (this.model.hasEnrollmentType('ObserverEnrollment')) {
      /* @ts-expect-error -- TODO: TSify */
      json.canManage = canDoAdminActions || ENV.permissions.manage_students
    } else {
      /* @ts-expect-error -- TODO: TSify */
      json.canManage = ENV.permissions.manage_students
    }
    /* @ts-expect-error -- TODO: TSify */
    json.customLinks = this.model.get('custom_links')

    if (json.canViewLoginIdColumn) {
      json.canViewLoginId = true
    }

    if (json.canViewSisIdColumn) {
      json.canViewSisId = true
      json.sis_id = json.sis_user_id
    }
    /* @ts-expect-error -- TODO: TSify */
    json.hideSectionsOnCourseUsersPage = ENV.course.hideSectionsOnCourseUsersPage
    return json
  }

  /* @ts-expect-error -- TODO: TSify */
  observerJSON(json) {
    if (json.isObserver) {
      let user
      const observerEnrollments = filter(json.enrollments, en => en.type === 'ObserverEnrollment')
      json.enrollments = reject(json.enrollments, en => en.type === 'ObserverEnrollment')

      /* @ts-expect-error -- TODO: TSify */
      json.sections = map(json.enrollments, en => ENV.CONTEXTS.sections[en.course_section_id])

      const users = {}
      if (
        observerEnrollments.length >= 1 &&
        every(observerEnrollments, enrollment => !enrollment.observed_user)
      ) {
        /* @ts-expect-error -- TODO: TSify */
        users[''] = {name: I18n.t('nobody', 'nobody')}
      } else {
        for (const en of Array.from(observerEnrollments)) {
          if (!en.observed_user) {
            continue
          }
          user = en.observed_user
          /* @ts-expect-error -- TODO: TSify */
          if (!users[user.id]) {
            /* @ts-expect-error -- TODO: TSify */
            users[user.id] = user
          }
        }
      }

      return (() => {
        const result = []
        for (const id in users) {
          /* @ts-expect-error -- TODO: TSify */
          user = users[id]
          const ob = {
            role: I18n.t('observing_user', 'Observing: %{user_name}', {user_name: user.name}),
          }
          result.push(json.enrollments.push(ob))
        }
        return result
      })()
    }
  }

  resendInvitation() {
    /* @ts-expect-error -- TODO: TSify */
    if (!invitationDialog) {
      invitationDialog = new InvitationsView()
    }
    /* @ts-expect-error -- TODO: TSify */
    invitationDialog.model = this.model
    return invitationDialog.render().show()
  }

  editSections() {
    const mountPoint = document.getElementById('edit_sections_mount_point')
    if (mountPoint) {
      /* @ts-expect-error -- TODO: TSify */
      const enrollments = this.model.sectionEditableEnrollments()
      /* @ts-expect-error -- TODO: TSify */
      const excludeSections = enrollments.map(enrollment => {
        /* @ts-expect-error -- TODO: TSify */
        const section = ENV.SECTIONS.find(s => s.id === enrollment.course_section_id)
        if (section) {
          return {
            id: section.id,
            name: section.name,
            role: enrollment.role,
            can_be_removed: enrollment.can_be_removed,
          }
        } else {
          // if we can't find the associated section, don't bother excluding it
          return null
        }
      })
      /* @ts-expect-error -- TODO: TSify */
      const filteredExcludeSections = excludeSections.filter(section => section !== null)
      const component = (
        <EditSectionsModal
          onClose={() => {
            /* @ts-expect-error -- TODO: TSify */
            rerender(editSectionsRoot, null)
          }}
          onUpdate={sections => this.updateSections(sections)}
          excludeSections={filteredExcludeSections}
        />
      )
      /* @ts-expect-error -- TODO: TSify */
      if (editSectionsRoot === null) {
        editSectionsRoot = render(component, mountPoint)
      } else {
        /* @ts-expect-error -- TODO: TSify */
        rerender(editSectionsRoot, component)
      }
    }
  }

  /* @ts-expect-error -- TODO: TSify */
  async updateSections(sections) {
    /* @ts-expect-error -- TODO: TSify */
    const editableEnrollments = this.model.sectionEditableEnrollments()
    /* @ts-expect-error -- TODO: TSify */
    const enrollment = this.model.findEnrollmentByRole(this.model.currentRole)
    /* @ts-expect-error -- TODO: TSify */
    const currentIds = editableEnrollments.map(en => en.course_section_id)
    /* @ts-expect-error -- TODO: TSify */
    const sectionIds = sections.map(s => s.id)
    /* @ts-expect-error -- TODO: TSify */
    const newSections = sectionIds.filter(id => !currentIds.includes(id))

    // delete old section enrollments
    /* @ts-expect-error -- TODO: TSify */
    const sectionsToRemove = currentIds.filter(id => !sectionIds.includes(id))
    /* @ts-expect-error -- TODO: TSify */
    const enrollmentsToRemove = editableEnrollments.filter(en =>
      sectionsToRemove.includes(en.course_section_id),
    )
    if (newSections.length === 0 && enrollmentsToRemove.length === 0) {
      return
    }
    const formData = new FormData()
    /* @ts-expect-error -- TODO: TSify */
    formData.append('enrollment[user_id]', this.model.get('id'))
    formData.append('enrollment[type]', enrollment.type)
    formData.append(
      'enrollment[limit_privileges_to_course_section]',
      enrollment.limit_privileges_to_course_section.toString(),
    )
    if (enrollment.role !== enrollment.type) {
      formData.append('enrollment[role_id]', enrollment.role_id)
    }
    /* @ts-expect-error -- TODO: TSify */
    if (!this.model.pending(this.model.currentRole)) {
      formData.append('enrollment[enrollment_state]', 'active')
    }

    const createdEnrollments = await createSectionEnrollments(newSections, formData)
    /* @ts-expect-error -- TODO: TSify */
    await deleteExistingSectionEnrollments(enrollmentsToRemove.map(en => en.id))
    /* @ts-expect-error -- TODO: TSify */
    this.updateEnrollments(createdEnrollments, enrollmentsToRemove)
  }

  /* @ts-expect-error -- TODO: TSify */
  getUniqueObservees(enrollments) {
    const uniqueObserveesMap = new Map()

    for (const enrollment of enrollments) {
      if (uniqueObserveesMap.has(enrollment.observed_user.id)) {
        continue
      }
      uniqueObserveesMap.set(enrollment.observed_user.id, enrollment.observed_user)
    }

    return Array.from(uniqueObserveesMap.values())
  }

  linkToStudents() {
    const mountPoint = document.getElementById('link_to_students_mount_point')
    /* @ts-expect-error -- TODO: TSify */
    const observer = this.model.attributes
    const observerEnrollmentsWithObservedUser = observer.enrollments.filter(
      /* @ts-expect-error -- TODO: TSify */
      enrollment => enrollment.type === 'ObserverEnrollment' && enrollment.observed_user,
    )
    const initialObservees = this.getUniqueObservees(observerEnrollmentsWithObservedUser)
    const course = ENV.current_context

    const component = (
      <LinkToStudents
        observer={observer}
        initialObservees={initialObservees}
        /* @ts-expect-error -- TODO: TSify */
        course={course}
        onSubmit={(addedEnrollments, removedEnrollments) => {
          /* @ts-expect-error -- TODO: TSify */
          this.updateEnrollments(addedEnrollments, removedEnrollments)
        }}
        onClose={() => {
          /* @ts-expect-error -- TODO: TSify */
          rerender(linkToStudentsRoot, null)
        }}
      />
    )
    /* @ts-expect-error -- TODO: TSify */
    if (linkToStudentsRoot === null) {
      linkToStudentsRoot = render(component, mountPoint)
    } else {
      /* @ts-expect-error -- TODO: TSify */
      rerender(linkToStudentsRoot, component)
    }
  }

  editRoles() {
    const mountPoint = document.getElementById('edit_roles_mount_point')
    /* @ts-expect-error -- TODO: TSify */
    const availableRoles = ENV.ALL_ROLES.filter(role => role.addable_by_user)
    const component = (
      <EditRolesModal
        /* @ts-expect-error -- TODO: TSify */
        currentEnrollments={this.model.enrollments()}
        availableRoles={availableRoles}
        /* @ts-expect-error -- TODO: TSify */
        userId={this.model.get('id')}
        onClose={() => {
          /* @ts-expect-error -- TODO: TSify */
          rerender(editRolesRoot, null)
        }}
        onSubmit={(newEnrollments, deletedEnrollments) => {
          /* @ts-expect-error -- TODO: TSify */
          this.updateEnrollments(newEnrollments, deletedEnrollments)
        }}
      />
    )
    /* @ts-expect-error -- TODO: TSify */
    if (editRolesRoot === null) {
      editRolesRoot = render(component, mountPoint)
    } else {
      /* @ts-expect-error -- TODO: TSify */
      rerender(editRolesRoot, component)
    }
  }

  deactivateUser() {
    if (
      !window.confirm(
        I18n.t(
          'Are you sure you want to deactivate %{name}? They will be unable to participate in the course while inactive.',
          /* @ts-expect-error -- TODO: TSify */
          {name: this.model.get('name')},
        ),
      )
    ) {
      return
    }
    const deferreds = []
    /* @ts-expect-error -- TODO: TSify */
    for (const en of Array.from(this.model.get('enrollments'))) {
      /* @ts-expect-error -- TODO: TSify */
      if (en.enrollment_state !== 'inactive') {
        /* @ts-expect-error -- TODO: TSify */
        const url = `/api/v1/courses/${ENV.course.id}/enrollments/${en.id}?task=deactivate`
        /* @ts-expect-error -- TODO: TSify */
        en.enrollment_state = 'inactive'
        deferreds.push($.ajaxJSON(url, 'DELETE'))
      }
    }

    return $('.roster-tab').disableWhileLoading(
      $.when(...Array.from(deferreds || []))
        .done(() => {
          /* @ts-expect-error -- TODO: TSify */
          this.render()
          return $.flashMessage(I18n.t('User successfully deactivated'))
        })
        .fail(() =>
          $.flashError(
            I18n.t('Something went wrong while deactivating the user. Please try again later.'),
          ),
        ),
    )
  }

  reactivateUser() {
    const deferreds = []
    /* @ts-expect-error -- TODO: TSify */
    for (const en of Array.from(this.model.get('enrollments'))) {
      /* @ts-expect-error -- TODO: TSify */
      const url = `/api/v1/courses/${ENV.course.id}/enrollments/${en.id}/reactivate`
      /* @ts-expect-error -- TODO: TSify */
      en.enrollment_state = 'active'
      deferreds.push($.ajaxJSON(url, 'PUT'))
    }

    return $('.roster-tab').disableWhileLoading(
      $.when(...Array.from(deferreds || []))
        .done(() => {
          /* @ts-expect-error -- TODO: TSify */
          this.render()
          return $.flashMessage(I18n.t('User successfully re-activated'))
        })
        .fail(() =>
          $.flashError(
            I18n.t('Something went wrong re-activating the user. Please try again later.'),
          ),
        ),
    )
  }

  /* @ts-expect-error -- TODO: TSify */
  removeFromCourse(_e) {
    if (
      !window.confirm(
        /* @ts-expect-error -- TODO: TSify */
        I18n.t('Are you sure you want to remove %{name}?', {name: this.model.get('name')}),
      )
    ) {
      return
    }
    /* @ts-expect-error -- TODO: TSify */
    this.$el.hide()
    const success = () => {
      // TODO: change the count on the search roles drop down
      $.flashMessage(I18n.t('User successfully removed.'))
      /* @ts-expect-error -- TODO: TSify */
      const $previousRow = this.$el.prev(':visible')

      try {
        queryClient.invalidateQueries({
          queryKey: ['differentiationTagCategories'],
          exact: false,
        })
      } catch (error) {
        console.error('Error invalidating query, error:', error)
      }

      const $focusElement = $previousRow.length ? $previousRow.find('.al-trigger') : $('#addUsers')
      return $focusElement.focus()
    }

    const failure = () => {
      /* @ts-expect-error -- TODO: TSify */
      this.$el.show()
      return $.flashError(
        I18n.t('flash.removeError', 'Unable to remove the user. Please try again later.'),
      )
    }
    /* @ts-expect-error -- TODO: TSify */
    const deferreds = map(this.model.get('enrollments'), e =>
      /* @ts-expect-error -- TODO: TSify */
      $.ajaxJSON(`${ENV.COURSE_ROOT_URL}/unenroll/${e.id}`, 'DELETE'),
    )
    return $.when(...Array.from(deferreds || [])).then(success, failure)
  }

  /* @ts-expect-error -- TODO: TSify */
  handleMenuEvent(e) {
    this.blur()
    e.preventDefault()
    const method = $(e.currentTarget).data('event')
    /* @ts-expect-error -- TODO: TSify */
    return this[method].call(this, e)
  }

  // Helper for range selection
  /* @ts-expect-error -- TODO: TSify */
  handleRangeSelection(isChecked, currentIndex) {
    const {selectedUserIds, masterSelected, deselectedUserIds, lastCheckedIndex} =
      /* @ts-expect-error -- TODO: TSify */
      this.model.collection
    const $checkboxes = $(
      /* @ts-expect-error -- TODO: TSify */
      this.model.collection
        /* @ts-expect-error -- TODO: TSify */
        .map(model => model.view.$('.select-user-checkbox').get(0))
        .filter(Boolean),
    )
    const start = Math.min(lastCheckedIndex, currentIndex)
    const end = Math.max(lastCheckedIndex, currentIndex)

    if (start === end) {
      return
    }

    for (let i = start; i <= end; i++) {
      const checkbox = $checkboxes[i]
      /* @ts-expect-error -- TODO: TSify */
      const checkboxUserId = this.model.collection.models.filter(rosterUser =>
        rosterUser.hasEnrollmentType('StudentEnrollment'),
      )[i].id
      if (isChecked) {
        if (!selectedUserIds.includes(checkboxUserId)) {
          selectedUserIds.push(checkboxUserId)
        }
        /* @ts-expect-error -- TODO: TSify */
        this.model.collection.deselectedUserIds = deselectedUserIds.filter(
          /* @ts-expect-error -- TODO: TSify */
          id => id !== checkboxUserId,
        )
      } else {
        selectedUserIds.splice(
          0,
          selectedUserIds.length,
          /* @ts-expect-error -- TODO: TSify */
          ...selectedUserIds.filter(id => id !== checkboxUserId),
        )
        if (masterSelected && !deselectedUserIds.includes(checkboxUserId)) {
          /* @ts-expect-error -- TODO: TSify */
          this.model.collection.deselectedUserIds.push(checkboxUserId)
        }
      }
      $(checkbox).prop('checked', isChecked)
    }
    /* @ts-expect-error -- TODO: TSify */
    this.model.collection.lastCheckedIndex = currentIndex
    MessageBus.trigger('userSelectionChanged', {
      /* @ts-expect-error -- TODO: TSify */
      model: this.model,
      selected: isChecked,
      /* @ts-expect-error -- TODO: TSify */
      selectedUsers: this.model.collection.selectedUserIds,
      /* @ts-expect-error -- TODO: TSify */
      deselectedUserIds: this.model.collection.deselectedUserIds,
      /* @ts-expect-error -- TODO: TSify */
      masterSelected: this.model.collection.masterSelected,
    })
  }

  // If unchecking a user while master is on, add them to the "deselected" list
  /* @ts-expect-error -- TODO: TSify */
  handleCheckboxChange(e) {
    const isChecked = $(e.currentTarget).is(':checked')
    /* @ts-expect-error -- TODO: TSify */
    const userId = this.model.id
    const {selectedUserIds, masterSelected, deselectedUserIds, lastCheckedIndex} =
      /* @ts-expect-error -- TODO: TSify */
      this.model.collection
    const $checkboxes = $(
      /* @ts-expect-error -- TODO: TSify */
      this.model.collection
        /* @ts-expect-error -- TODO: TSify */
        .map(model => model.view.$('.select-user-checkbox').get(0))
        .filter(Boolean),
    )
    const currentIndex = $checkboxes.index($(e.currentTarget))
    /* @ts-expect-error -- TODO: TSify */
    if (this.isShiftPressed && lastCheckedIndex !== null) {
      this.handleRangeSelection(isChecked, currentIndex)
    } else {
      if (isChecked) {
        // Add user to selected list if not already
        if (!selectedUserIds.includes(userId)) {
          selectedUserIds.push(userId)
        }
        // Remove from deselected list if present
        /* @ts-expect-error -- TODO: TSify */
        this.model.collection.deselectedUserIds = deselectedUserIds.filter(id => id !== userId)
      } else {
        // Remove from selected list
        /* @ts-expect-error -- TODO: TSify */
        this.model.collection.selectedUserIds = selectedUserIds.filter(id => id !== userId)

        // If master is set, add to deselected list
        if (masterSelected && !deselectedUserIds.includes(userId)) {
          /* @ts-expect-error -- TODO: TSify */
          this.model.collection.deselectedUserIds.push(userId)
        }
      }

      /* @ts-expect-error -- TODO: TSify */
      this.model.collection.lastCheckedIndex = this.model.collection.selectedUserIds.length
        ? currentIndex
        : null

      MessageBus.trigger('userSelectionChanged', {
        /* @ts-expect-error -- TODO: TSify */
        model: this.model,
        selected: isChecked,
        /* @ts-expect-error -- TODO: TSify */
        selectedUsers: this.model.collection.selectedUserIds,
        /* @ts-expect-error -- TODO: TSify */
        deselectedUserIds: this.model.collection.deselectedUserIds,
        /* @ts-expect-error -- TODO: TSify */
        masterSelected: this.model.collection.masterSelected,
      })
    }
  }

  /* @ts-expect-error -- TODO: TSify */
  handleKeyDown(e) {
    // Only act if the focused element is a checkbox
    if (e.key === 'Shift') {
      e.preventDefault()
      const isChecked = !$(e.currentTarget).is(':checked')
      const $checkboxes = $(
        /* @ts-expect-error -- TODO: TSify */
        this.model.collection
          /* @ts-expect-error -- TODO: TSify */
          .map(model => model.view.$('.select-user-checkbox').get(0))
          .filter(Boolean),
      )
      const currentIndex = $checkboxes.index($(e.currentTarget))
      /* @ts-expect-error -- TODO: TSify */
      const {lastCheckedIndex} = this.model.collection
      if (lastCheckedIndex !== null) {
        this.handleRangeSelection(isChecked, currentIndex)
      }
    }
  }

  handleTagIconClick() {
    /* @ts-expect-error -- TODO: TSify */
    this.renderUserTagModal(true, this.model.id, this.model.get('name'))
  }

  /* @ts-expect-error -- TODO: TSify */
  renderUserTagModal(isOpen, userId, userName) {
    const el = document.getElementById('userTagsModalContainer')
    const returnFocusTo = document.getElementById(`tag-icon-id-${userId}`)
    /* @ts-expect-error -- TODO: TSify */
    const onModalClose = (userId, userName) => {
      this.renderUserTagModal(false, userId, userName)
      returnFocusTo?.focus()
      /* @ts-expect-error -- TODO: TSify */
      this.userTagModalContainer.unmount()
      /* @ts-expect-error -- TODO: TSify */
      this.userTagModalContainer = null
    }
    const component = (
      <UserTaggedModal
        isOpen={isOpen}
        /* @ts-expect-error -- TODO: TSify */
        courseId={ENV.course.id}
        userId={userId}
        userName={userName}
        onClose={onModalClose}
      />
    )
    /* @ts-expect-error -- TODO: TSify */
    if (!this.userTagModalContainer) {
      /* @ts-expect-error -- TODO: TSify */
      this.userTagModalContainer = render(component, el)
    } else {
      /* @ts-expect-error -- TODO: TSify */
      rerender(this.userTagModalContainer, component)
    }
  }

  focus() {
    /* @ts-expect-error -- TODO: TSify */
    return this.$el.addClass('al-hover-container-active table-hover-row')
  }

  blur() {
    /* @ts-expect-error -- TODO: TSify */
    return this.$el.removeClass('al-hover-container-active table-hover-row')
  }

  afterRender() {
    /* @ts-expect-error -- TODO: TSify */
    const model = this.model
    /* @ts-expect-error -- TODO: TSify */
    const $el = this.$el
    const container = $el.find(`#${model.attributes.avatarId}`)[0]
    if (container) {
      const root = render(
        <a href={`users/${model.id}`}>
          <Avatar
            name={model.attributes.name}
            src={model.attributes.avatar_url}
            size="small"
            alt={model.attributes.name}
          />
          <span className="screenreader-only">{model.attributes.name}</span>
        </a>,
        container,
      )
      /* @ts-expect-error -- TODO: TSify */
      this._reactRoot = root
    }
    /* @ts-expect-error -- TODO: TSify */
    this.userTagModalContainer = null
  }

  remove() {
    $(document).off('keydown')
    $(document).off('keyup')

    /* @ts-expect-error -- TODO: TSify */
    if (this._reactRoot) {
      /* @ts-expect-error -- TODO: TSify */
      this._reactRoot.unmount()
    }
    /* @ts-expect-error -- TODO: TSify */
    if (this.userTagModalContainer) {
      /* @ts-expect-error -- TODO: TSify */
      this.userTagModalContainer.unmount()
      /* @ts-expect-error -- TODO: TSify */
      this.userTagModalContainer = null
    }
    return super.remove(...arguments)
  }
}
RosterUserView.initClass()

/* @ts-expect-error -- TODO: TSify */
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null ? transform(value) : undefined
}

/*
 * Copyright (C) 2011 - present Instructure, Inc.
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

import {useScope as createI18nScope} from '@canvas/i18n'
import {render} from '@canvas/react'
import SuspendedIcon from '../react/SuspendedIcon'
import $ from 'jquery'
import '@canvas/jquery/jquery.instructure_forms' /* formSubmit, fillFormData, formErrors */
import '@canvas/jquery/jquery.instructure_misc_plugins' /* confirmDelete, showIf */
import '@canvas/util/templateData'
import AddEditPseudonym from '../react/AddEditPseudonym'
import {promptForMfaCode} from '@canvas/mfa'
import ready from '@instructure/ready'

const I18n = createI18nScope('user_logins')

ready(() => {
  const savedSSOIcons = {}

  function updateLoginList({isEdit, currentPseudonym, accountSelectOptions}) {
    let currentLoginElement

    if (isEdit) {
      currentLoginElement = $(
        `#login_information .login:has([data-pseudonym-id='${currentPseudonym.id}'])`,
      )
    } else {
      currentLoginElement = $('#login_information .login.blank').clone(true)
      currentLoginElement.removeClass('blank')
      currentLoginElement.show()
      const ssoIconElement = currentLoginElement.find('.sso-icon')
      ssoIconElement.attr('data-pseudonym-id', currentPseudonym.id)
      const overviewElement = currentLoginElement.find('.overview')
      overviewElement.append(
        $(
          // xsslint safeString.method t data
          `<div>${I18n.t('SIS ID')}: <span class="sis_user_id"></span></div>
         <div style="display:none" class="can_edit_sis_user_id">${$('.add_pseudonym_link').data('can-manage-sis')}</div>`,
        ),
      )
      overviewElement.append(
        // xsslint safeString.method t
        $(`<div>${I18n.t('Integration ID')}: <span class="integration_id"></span></div>`),
      )
      // xsslint jqueryObject.identifier currentLoginElement
      $('#login_information .add_holder').before(currentLoginElement)
      const accountName =
        accountSelectOptions.find(({value}) => `${value}` === currentPseudonym.account_id)?.label ??
        ''
      currentPseudonym.account_name = accountName
    }
    currentLoginElement.fillTemplateData({
      data: currentPseudonym,
      hrefValues: ['id', 'account_id'],
    })

    if (isEdit) {
      currentLoginElement
        .find('.must-reset-password-indicator')
        .toggle(currentPseudonym.must_reset_password === true)
    }

    const $logins = $('#login_information .login')
    $('.delete_pseudonym_link', $logins)[$logins.filter(':visible').length < 2 ? 'hide' : 'show']()
  }

  const renderAddEditPseudonym = ({
    nodeIdToMount,
    pseudonym,
    canManageSis,
    canChangePassword,
    isDelegatedAuth,
    canManagePasswordReset,
  }) => {
    const mountPoint = document.getElementById(nodeIdToMount)

    if (!mountPoint) {
      return
    }

    const accountSelectOptions = ENV.ACCOUNT_SELECT_OPTIONS ?? []
    const accountIdPasswordPolicyMap = ENV.PASSWORD_POLICIES
    const defaultPolicy = ENV.PASSWORD_POLICY
    const userId = ENV.USER_ID
    const isEdit = Boolean(pseudonym)

    const root = render(
      <AddEditPseudonym
        pseudonym={pseudonym}
        canManageSis={canManageSis}
        canChangePassword={canChangePassword}
        canManagePasswordReset={canManagePasswordReset}
        isDelegatedAuth={isDelegatedAuth}
        userId={userId}
        accountIdPasswordPolicyMap={accountIdPasswordPolicyMap}
        accountSelectOptions={accountSelectOptions}
        defaultPolicy={defaultPolicy}
        isEdit={isEdit}
        onSubmit={currentPseudonym => {
          root.unmount()

          updateLoginList({isEdit, currentPseudonym, accountSelectOptions})

          $.flashMessage(I18n.t('save_succeeded', 'Save successful.'))
        }}
        onClose={() => {
          root.unmount()
        }}
      />,
      mountPoint,
    )
  }

  $(function () {
    $('.login_details_link').on('click', function (event) {
      event.preventDefault()
      $(this).parents('td').find('.login_details').show()
      $(this).hide()
    })
    $('#login_information')
      .on('click', '.edit_pseudonym_link', function (event) {
        event.preventDefault()

        const loginElement = $(this).parents('.login')
        const {can_edit_sis_user_id, must_reset_password, ...restOfTemplateData} =
          loginElement.getTemplateData({
            textValues: [
              'unique_id',
              'sis_user_id',
              'integration_id',
              'can_edit_sis_user_id',
              'must_reset_password',
            ],
          })
        const ssoIconCell = loginElement.find('[data-pseudonym-id]')
        const pseudonym = {
          id: ssoIconCell.data('pseudonym-id'),
          ...restOfTemplateData,
          must_reset_password: must_reset_password === 'true',
        }
        const linksCell = $(this).parents('.links')
        const canManageSis = can_edit_sis_user_id === 'true'
        const canChangePassword = linksCell.hasClass('passwordable')
        const isDelegatedAuth = canChangePassword && linksCell.hasClass('delegated-auth')
        const canManagePasswordReset = linksCell.data('passwordable') === true

        renderAddEditPseudonym({
          nodeIdToMount: 'edit_pseudonym_mount_point',
          pseudonym,
          canManageSis,
          canChangePassword,
          isDelegatedAuth,
          canManagePasswordReset,
        })
      })
      .on('click', '.delete_pseudonym_link', function (event) {
        event.preventDefault()
        if ($('#login_information .login:visible').length < 2) {
          alert(
            I18n.t('notices.cant_delete_last_login', "You can't delete the last login for a user"),
          )
          return
        }
        const login = $(this).parents('.login').find('.unique_id').text()
        $(this)
          .parents('.login')
          .confirmDelete({
            message: I18n.t(
              'confirms.delete_login',
              'Are you sure you want to delete the login, "%{login}"?',
              {login},
            ),
            url: $(this).attr('rel'),
            success() {
              $(this).fadeOut(() => {
                // to get an accurate count, we must wait for this fade to complete
                const $logins = $('#login_information .login')
                if ($logins.filter(':visible').length < 2) {
                  $('.delete_pseudonym_link', $logins).hide()
                }
              })
            },
          })
      })
      .on('click', '.add_pseudonym_link', function (event) {
        event.preventDefault()

        const canManageSis = $(this).data('can-manage-sis')

        renderAddEditPseudonym({
          nodeIdToMount: 'add_pseudonym_mount_point',
          canManageSis,
          isDelegatedAuth: false,
          canChangePassword: true,
        })
      })

    $('.reset_mfa_link').on('click', async function (event) {
      event.preventDefault()
      const $disable_mfa_link = $(this)
      let verificationCode

      if (ENV.FEATURES?.require_mfa_verification_for_removal) {
        try {
          // Show dialog to prompt admin for their verification code
          verificationCode = await promptForMfaCode({
            label: I18n.t('titles.reset_mfa', 'Reset Multi-Factor Authentication'),
            confirmText: I18n.t('buttons.reset_mfa', 'Reset MFA'),
          })

          // If admin doesn't provide a code, show error
          if (!verificationCode || verificationCode === '') {
            $.flashError(
              I18n.t(
                'errors.verification_code_required',
                'Verification code is required to reset multi-factor authentication',
              ),
            )
            return
          }
        } catch (error) {
          // Admin cancelled the dialog - do nothing
          return
        }
      }

      // Send DELETE request with verification code (if required)
      const requestData = verificationCode ? {verification_code: verificationCode} : {}

      $.ajaxJSON(
        $disable_mfa_link.attr('href'),
        'DELETE',
        requestData,
        () => {
          $.flashMessage(I18n.t('notices.mfa_reset', 'Multi-factor authentication reset'))
          $disable_mfa_link.parent().remove()
        },
        data => {
          // Handle error response
          const errorMessage =
            data?.error ||
            I18n.t('errors.mfa_reset_failed', 'Failed to reset multi-factor authentication')
          $.flashError(errorMessage)
        },
      )
    })

    // TODO: the user's pseudonyms are listed in this bundle (user_logins) but the
    // control of suspending/reactivating them is unfortunately in another bundle
    // (user_name), and the two bundles have no way of directly communicating with
    // each other. So for now we will just use a CustomEvent and use window as the
    // communication bus. For the other end of this communication channel, see
    // ui/features/user_name/react/UserSuspendLink.js
    //
    // Eventually both bundles should be rewritten into one larger tree of React
    // components, and then this can be redone in more standard ways.

    const pseuds = ENV.user_suspend_status?.pseudonyms

    function setSuspend(id) {
      const icon = document.querySelector(`.sso-icon[data-pseudonym-id="${id}"]`)
      const login = pseuds.find(p => p.id === id)?.unique_id
      if (typeof login === 'undefined') return
      if (typeof savedSSOIcons[id] === 'undefined') savedSSOIcons[id] = icon.cloneNode(true)
      const innerDiv = document.createElement('div')
      icon.replaceChildren(innerDiv)

      render(<SuspendedIcon login={login} />, innerDiv)
    }

    function unsetSuspend(id) {
      const icon = document.querySelector(`.sso-icon[data-pseudonym-id="${id}"]`)
      if (typeof savedSSOIcons[id] === 'undefined') return
      icon.replaceWith(savedSSOIcons[id].cloneNode(true))
      delete savedSSOIcons[id]
    }

    if (pseuds) {
      // Replace the icon for any suspended pseudonym with the "suspended" component
      pseuds
        .filter(p => p.workflow_state === 'suspended')
        .map(p => p.id)
        .forEach(id => setSuspend(id))

      // I don't THINK this ever has to be removed in this configuration
      window.addEventListener('username:pseudonymstatuschange', function (event) {
        const icons = document.querySelectorAll('.sso-icon[data-pseudonym-id]')
        const iconIdOf = elt => elt.attributes.getNamedItem('data-pseudonym-id').value
        const action = event.detail.action === 'suspend' ? setSuspend : unsetSuspend
        for (const icon of icons) {
          action(iconIdOf(icon))
        }
      })
    }
  })
})

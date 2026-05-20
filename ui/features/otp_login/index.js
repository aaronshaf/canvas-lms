/*
 * Copyright (C) 2012 - present Instructure, Inc.
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

import {useEffect} from 'react'

const LOGIN_FORM_ID = 'login_form'
const SELECT_PHONE_FORM_ID = 'select_phone_form'
const NEW_PHONE_FORM_ID = 'new_phone_form'

export function debounceSubmitOnce(formId) {
  const form = document.getElementById(formId)
  if (!form) return
  form.addEventListener('submit', () => {
    const button = form.querySelector('button[type="submit"]')
    form.setAttribute('aria-busy', 'true')
    const pendingLabel = button.getAttribute('data-text-while-loading')
    if (pendingLabel) button.textContent = pendingLabel
    button.disabled = true
  })
}

export function autofocusVerificationCode() {
  const input = document.querySelector(`#${LOGIN_FORM_ID} input[type="text"]`)
  if (!input) return
  input.focus()
  input.select()
}

export function wirePhoneFormToggle() {
  const selectForm = document.getElementById(SELECT_PHONE_FORM_ID)
  const newForm = document.getElementById(NEW_PHONE_FORM_ID)
  if (!selectForm || !newForm) return
  const select = selectForm.querySelector('select')
  const backLink = document.getElementById('back_to_choose_number_link')

  select?.addEventListener('change', () => {
    if (select.value === '{{id}}') {
      selectForm.style.display = 'none'
      newForm.style.display = ''
    }
  })

  backLink?.addEventListener('click', event => {
    event.preventDefault()
    newForm.style.display = 'none'
    selectForm.style.display = ''
    if (select) select.selectedIndex = 0
  })
}

export function Component() {
  useEffect(() => {
    autofocusVerificationCode()
    wirePhoneFormToggle()
    debounceSubmitOnce(LOGIN_FORM_ID)
    debounceSubmitOnce(SELECT_PHONE_FORM_ID)
    debounceSubmitOnce(NEW_PHONE_FORM_ID)
  }, [])
  return null
}

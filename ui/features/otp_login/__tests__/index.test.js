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

import {autofocusVerificationCode, debounceSubmitOnce, wirePhoneFormToggle} from '../index'

function renderForm() {
  document.body.innerHTML = `
    <form id="login_form">
      <button type="submit" data-text-while-loading="Verifying...">Verify</button>
    </form>
  `
  const form = document.getElementById('login_form')
  return {form, button: form.querySelector('button[type="submit"]')}
}

function dispatchSubmit(form) {
  const event = new Event('submit', {bubbles: true, cancelable: true})
  form.dispatchEvent(event)
  return event
}

describe('otp_login bundle', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('debounceSubmitOnce', () => {
    it('disables the submit button, swaps its label, and marks the form busy on submit', () => {
      const {form, button} = renderForm()
      debounceSubmitOnce('login_form')

      dispatchSubmit(form)

      expect(button.disabled).toBe(true)
      expect(button.textContent).toBe('Verifying...')
      expect(form.getAttribute('aria-busy')).toBe('true')
    })

    it('does not set aria-busy before any submit happens', () => {
      const {form} = renderForm()
      debounceSubmitOnce('login_form')

      expect(form.hasAttribute('aria-busy')).toBe(false)
    })

    it('leaves the label unchanged when no data-text-while-loading is set', () => {
      document.body.innerHTML = `
        <form id="login_form">
          <button type="submit">Verify</button>
        </form>
      `
      const form = document.getElementById('login_form')
      const button = form.querySelector('button[type="submit"]')
      debounceSubmitOnce('login_form')

      dispatchSubmit(form)

      expect(button.disabled).toBe(true)
      expect(button.textContent).toBe('Verify')
    })

    it('is a no-op when the form is not in the DOM', () => {
      expect(() => debounceSubmitOnce('does_not_exist')).not.toThrow()
    })
  })

  describe('autofocusVerificationCode', () => {
    it('focuses and selects the verification code input', () => {
      document.body.innerHTML = `
        <form id="login_form">
          <input type="text" value="abc123" />
        </form>
      `
      autofocusVerificationCode()

      const input = document.querySelector('#login_form input[type="text"]')
      expect(document.activeElement).toBe(input)
    })

    it('is a no-op when no verification input is present', () => {
      document.body.innerHTML = ''
      expect(() => autofocusVerificationCode()).not.toThrow()
    })
  })

  describe('wirePhoneFormToggle', () => {
    function renderPhoneForms() {
      document.body.innerHTML = `
        <form id="select_phone_form">
          <select>
            <option value="1">555-0100</option>
            <option value="{{id}}">a new mobile number</option>
          </select>
        </form>
        <form id="new_phone_form" style="display: none"></form>
        <a href="#" id="back_to_choose_number_link">Choose an existing number</a>
      `
      return {
        selectForm: document.getElementById('select_phone_form'),
        newForm: document.getElementById('new_phone_form'),
        select: document.querySelector('#select_phone_form select'),
        backLink: document.getElementById('back_to_choose_number_link'),
      }
    }

    it('shows the new-phone form and hides the select form when the sentinel option is chosen', () => {
      const {selectForm, newForm, select} = renderPhoneForms()
      wirePhoneFormToggle()

      select.value = '{{id}}'
      select.dispatchEvent(new Event('change', {bubbles: true}))

      expect(selectForm.style.display).toBe('none')
      expect(newForm.style.display).toBe('')
    })

    it('returns to the select form and resets the dropdown when the back link is clicked', () => {
      const {selectForm, newForm, select, backLink} = renderPhoneForms()
      wirePhoneFormToggle()
      select.value = '{{id}}'
      select.dispatchEvent(new Event('change', {bubbles: true}))

      const clickEvent = new Event('click', {bubbles: true, cancelable: true})
      backLink.dispatchEvent(clickEvent)

      expect(clickEvent.defaultPrevented).toBe(true)
      expect(newForm.style.display).toBe('none')
      expect(selectForm.style.display).toBe('')
      expect(select.selectedIndex).toBe(0)
    })

    it('does nothing when the SMS section is not rendered', () => {
      document.body.innerHTML = '<form id="login_form"></form>'
      expect(() => wirePhoneFormToggle()).not.toThrow()
    })
  })
})

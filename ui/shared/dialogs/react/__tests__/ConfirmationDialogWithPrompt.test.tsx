/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import {render, screen, within, cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmationDialogWithPrompt, {
  showConfirmationDialogWithPrompt,
} from '../ConfirmationDialogWithPrompt'

describe('ConfirmationDialogWithPrompt', () => {
  const cleanupDialogs = () => {
    cleanup()
    // Clean up the dialog holder
    const holder = document.getElementById('confirmation_dialog_with_prompt_holder')
    if (holder) {
      holder.remove()
    }
    // Clean up any remaining modal elements that InstUI might have rendered
    document.querySelectorAll('[data-cid="Modal"]').forEach(modal => modal.remove())
  }

  beforeEach(() => {
    cleanupDialogs()
  })

  afterEach(() => {
    cleanupDialogs()
  })

  describe('Component', () => {
    const defaultProps = {
      open: true,
      label: 'Test Dialog',
      inputLabel: 'Enter value',
      onConfirm: vi.fn(),
      onReject: vi.fn(),
      body: <p>Dialog content</p>,
    }

    it('renders the dialog with content and input', () => {
      render(<ConfirmationDialogWithPrompt {...defaultProps} />)

      expect(screen.getByText('Dialog content')).toBeInTheDocument()
      expect(screen.getByLabelText('Enter value')).toBeInTheDocument()
    })

    it('calls onConfirm with input value when confirmed', async () => {
      const onConfirm = vi.fn()
      const user = userEvent.setup()

      render(<ConfirmationDialogWithPrompt {...defaultProps} onConfirm={onConfirm} />)

      const input = screen.getByTestId('prompt-input')
      await user.clear(input)
      await user.type(input, 'Test value')

      const confirmButton = screen.getByTestId('confirm-button')
      await user.click(confirmButton)

      expect(onConfirm).toHaveBeenCalledWith('Test value')
    })

    it('calls onReject when cancelled', async () => {
      const onReject = vi.fn()
      const user = userEvent.setup()

      render(<ConfirmationDialogWithPrompt {...defaultProps} onReject={onReject} />)

      const cancelButton = screen.getByTestId('cancel-button')
      await user.click(cancelButton)

      expect(onReject).toHaveBeenCalled()
    })

    it('uses initial value when provided', () => {
      render(<ConfirmationDialogWithPrompt {...defaultProps} initialValue="Initial text" />)

      const input = screen.getByTestId('prompt-input')
      expect(input).toHaveValue('Initial text')
    })
  })

  describe('showConfirmationDialogWithPrompt', () => {
    beforeEach(() => {
      const holder = document.getElementById('confirmation_dialog_with_prompt_holder')
      if (holder) {
        holder.remove()
      }
    })

    afterEach(() => {
      const holder = document.getElementById('confirmation_dialog_with_prompt_holder')
      if (holder) {
        holder.remove()
      }
    })

    it('resolves with input value when confirmed', async () => {
      const user = userEvent.setup()

      const resultPromise = showConfirmationDialogWithPrompt({
        label: 'Test Dialog',
        body: <p>Enter a value</p>,
        inputLabel: 'User Input',
      })

      const dialog = await screen.findByRole('dialog', {name: 'Test Dialog'})
      const input = within(dialog).getByLabelText('User Input')
      await user.clear(input)
      await user.type(input, 'My value')

      const confirmButton = within(dialog).getByRole('button', {name: /confirm/i})
      await user.click(confirmButton)

      const result = await resultPromise
      expect(result).toBe('My value')
    })

    it('rejects when cancelled', async () => {
      const user = userEvent.setup()

      let rejected = false
      const resultPromise = showConfirmationDialogWithPrompt({
        label: 'Cancel Test',
        body: <p>Cancel this dialog</p>,
        inputLabel: 'Cancel Input',
      }).catch(() => {
        rejected = true
      })

      const dialog = await screen.findByRole('dialog', {name: 'Cancel Test'})
      const cancelButton = within(dialog).getByRole('button', {name: /cancel/i})
      await user.click(cancelButton)

      await resultPromise
      expect(rejected).toBe(true)
    })

    it('resolves with initial value when provided and not modified', async () => {
      const user = userEvent.setup()

      const resultPromise = showConfirmationDialogWithPrompt({
        label: 'Initial Value Test',
        body: <p>Has initial value</p>,
        inputLabel: 'Initial Value Input',
        initialValue: 'Default value',
      })

      const dialog = await screen.findByRole('dialog', {name: 'Initial Value Test'})
      const confirmButton = within(dialog).getByRole('button', {name: /confirm/i})
      await user.click(confirmButton)

      const result = await resultPromise
      expect(result).toBe('Default value')
    })

    it('resolves with empty string when no input provided', async () => {
      const user = userEvent.setup()

      const resultPromise = showConfirmationDialogWithPrompt({
        label: 'Empty String Test',
        body: <p>No input test</p>,
        inputLabel: 'Empty Input',
      })

      const dialog = await screen.findByRole('dialog', {name: 'Empty String Test'})
      const confirmButton = within(dialog).getByRole('button', {name: /confirm/i})
      await user.click(confirmButton)

      const result = await resultPromise
      expect(result).toBe('')
    })

    it('creates dialog container in the DOM', async () => {
      let holder = document.getElementById('confirmation_dialog_with_prompt_holder')
      expect(holder).toBeNull()

      showConfirmationDialogWithPrompt({
        label: 'Container Test',
        body: <p>Container creation test</p>,
        inputLabel: 'Container Input',
      })

      await screen.findByText('Container creation test')

      holder = document.getElementById('confirmation_dialog_with_prompt_holder')
      expect(holder).not.toBeNull()
      expect(holder).toBeInstanceOf(HTMLElement)
    })

    it('uses custom confirm button text', async () => {
      showConfirmationDialogWithPrompt({
        label: 'Custom Button Test',
        body: <p>Custom button text</p>,
        inputLabel: 'Button Test Input',
        confirmText: 'Submit Now',
      })

      const confirmButton = await screen.findByRole('button', {name: /submit now/i})
      expect(confirmButton).toBeInTheDocument()
    })

    it('uses input placeholder when provided', async () => {
      showConfirmationDialogWithPrompt({
        label: 'Placeholder Test',
        body: <p>Placeholder test</p>,
        inputLabel: 'Placeholder Input',
        inputPlaceholder: 'Type here...',
      })

      const input = await screen.findByPlaceholderText('Type here...')
      expect(input).toBeInTheDocument()
    })
  })
})

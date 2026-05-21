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

import React from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
import KeyboardShortcutModal from '../KeyboardShortcutModal'

function renderModal(overrides = {}) {
  const onDismiss = vi.fn()
  render(<KeyboardShortcutModal open={true} onDismiss={onDismiss} {...overrides} />)
  return {onDismiss}
}

describe('KeyboardShortcutModal', () => {
  it('renders the modal heading', () => {
    renderModal()
    expect(screen.getByRole('heading', {name: 'Keyboard Shortcuts'})).toBeInTheDocument()
  })

  it('close button has descriptive screen reader label (regression: e56292acc75)', () => {
    // Before fix: screenReaderLabel was "Close" — too generic for a11y
    // Fix: changed to "Close Keyboard Shortcuts Modal"
    renderModal()
    expect(
      screen.getByRole('button', {name: /Close Keyboard Shortcuts Modal/i}),
    ).toBeInTheDocument()
  })

  it('calls onDismiss when close button is clicked', () => {
    const {onDismiss} = renderModal()
    fireEvent.click(screen.getByRole('button', {name: /Close Keyboard Shortcuts Modal/i}))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('TinyMCE link uses descriptive text not raw URL (regression: 6522153c90e)', () => {
    // Before fix: link text was the raw URL string
    // Fix: changed to "TinyMCE Keyboard Shortcuts" for a11y
    renderModal()
    const link = screen.getByRole('link', {name: 'TinyMCE Keyboard Shortcuts'})
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://www.tiny.cloud/docs/advanced/keyboard-shortcuts/')
  })
})

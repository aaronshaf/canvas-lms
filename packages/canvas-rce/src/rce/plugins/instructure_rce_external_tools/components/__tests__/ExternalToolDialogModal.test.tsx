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
import {act, fireEvent, render, screen} from '@testing-library/react'
import {ExternalToolDialogModal} from '../ExternalToolDialog/ExternalToolDialogModal'

function renderModal(onCloseButton = vi.fn()) {
  return render(
    <ExternalToolDialogModal
      label="External Tool"
      open={true}
      onCloseButton={onCloseButton}
      name="My Tool"
    >
      <div>tool content</div>
    </ExternalToolDialogModal>,
  )
}

describe('ExternalToolDialogModal', () => {
  it('renders the modal with tool name as heading', () => {
    renderModal()
    expect(screen.getByText('My Tool')).toBeInTheDocument()
    expect(screen.getByText('tool content')).toBeInTheDocument()
  })

  it('calls onCloseButton when close button is clicked', () => {
    const onCloseButton = vi.fn()
    renderModal(onCloseButton)
    fireEvent.click(screen.getByRole('button', {name: /close/i}))
    expect(onCloseButton).toHaveBeenCalledTimes(1)
  })

  it('does not close when clicking outside the modal (regression: 1fa7b0f1ce8)', async () => {
    // Before fix: shouldCloseOnDocumentClick defaulted to true, causing
    // FocusRegion to add a mousedown listener that called onDismiss on
    // any click outside the modal iframe. Fix: shouldCloseOnDocumentClick={false}
    const onCloseButton = vi.fn()
    renderModal(onCloseButton)
    // Let FocusRegion register its document listeners (activated via RAF in Dialog)
    await act(async () => {
      await new Promise(r => setTimeout(r, 0))
    })
    fireEvent.mouseDown(document.body)
    expect(onCloseButton).not.toHaveBeenCalled()
  })
})

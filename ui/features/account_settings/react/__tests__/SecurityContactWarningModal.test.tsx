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

import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SecurityContactWarningModal from '../components/SecurityContactWarningModal'

describe('SecurityContactWarningModal', () => {
  it('shows the warning text', () => {
    render(<SecurityContactWarningModal onConfirm={() => {}} onClose={() => {}} />)
    expect(screen.getByTestId('security-contact-warning-text')).toHaveTextContent(
      /looks like a personal address/,
    )
  })

  it('calls onConfirm when the admin chooses to submit anyway', async () => {
    const onConfirm = vi.fn()
    render(<SecurityContactWarningModal onConfirm={onConfirm} onClose={() => {}} />)
    await userEvent.click(screen.getByTestId('security-contact-confirm'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onClose when the admin goes back', async () => {
    const onClose = vi.fn()
    render(<SecurityContactWarningModal onConfirm={() => {}} onClose={onClose} />)
    await userEvent.click(screen.getByTestId('security-contact-cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})

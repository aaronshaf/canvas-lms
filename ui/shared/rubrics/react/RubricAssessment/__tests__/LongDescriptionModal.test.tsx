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
import {LongDescriptionModal} from '../LongDescriptionModal'

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  longDescription: 'This is a long description.',
}

const renderModal = (props = {}) => {
  return render(<LongDescriptionModal {...defaultProps} {...props} />)
}

describe('LongDescriptionModal', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the modal when open is true', () => {
    renderModal()
    expect(screen.getByText('Criterion Long Description')).toBeInTheDocument()
  })

  it('does not render the modal when open is false', () => {
    renderModal({open: false})
    expect(screen.queryByText('Criterion Long Description')).not.toBeInTheDocument()
  })

  it('renders the longDescription content', () => {
    renderModal()
    expect(screen.getByText('This is a long description.')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.click(screen.getByTestId('long-description-close-button').querySelector('button')!)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  describe('XSS protection for longDescription', () => {
    it('strips <script> tags', () => {
      const {container} = renderModal({longDescription: '<script>alert(1)</script>malicious'})
      expect(container.innerHTML).not.toContain('<script>')
      expect(container.innerHTML).not.toContain('alert(1)')
    })

    it('strips onerror event handlers', () => {
      const {container} = renderModal({longDescription: '<img src="x" onerror="alert(1)">'})
      expect(container.innerHTML).not.toContain('onerror')
    })

    it('strips onclick event handlers', () => {
      const {container} = renderModal({longDescription: '<div onclick="alert(1)">click me</div>'})
      expect(container.innerHTML).not.toContain('onclick')
    })

    it('strips javascript: protocol from href', () => {
      const {container} = renderModal({longDescription: '<a href="javascript:alert(1)">click</a>'})
      expect(container.innerHTML).not.toContain('javascript:')
    })

    it('strips object tags with event handlers', () => {
      const {container} = renderModal({longDescription: '<object onerror="alert(3)">x</object>'})
      expect(container.innerHTML).not.toContain('onerror')
    })

    it('strips svg onload handlers', () => {
      const {container} = renderModal({longDescription: '<svg onload="alert(1)"></svg>'})
      expect(container.innerHTML).not.toContain('onload')
    })
  })
})

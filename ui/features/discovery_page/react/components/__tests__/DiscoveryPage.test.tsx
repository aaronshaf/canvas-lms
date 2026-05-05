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
import {DiscoveryPage} from '../DiscoveryPage'
import type {DiscoveryPageProps} from '../../types'

describe('DiscoveryPage', () => {
  const renderComponent = (props: Partial<DiscoveryPageProps> = {}) =>
    render(<DiscoveryPage initialEnabled={false} onChange={() => {}} {...props} />)

  it('renders the Configure button and the toggle', () => {
    renderComponent()
    expect(screen.getByTestId('configure-button')).toBeInTheDocument()
    expect(screen.getByTestId('discovery-page-toggle')).toBeInTheDocument()
  })

  describe('when readOnly is false', () => {
    it('renders the Configure button as enabled', () => {
      renderComponent({readOnly: false})
      expect(screen.getByTestId('configure-button')).not.toBeDisabled()
    })

    it('renders the toggle as enabled', () => {
      renderComponent({readOnly: false})
      expect(screen.getByTestId('discovery-page-toggle')).not.toBeDisabled()
    })

    it('calls onChange when the toggle is clicked', async () => {
      const onChange = vi.fn()
      renderComponent({initialEnabled: false, onChange})
      await userEvent.click(screen.getByTestId('discovery-page-toggle'))
      expect(onChange).toHaveBeenCalledWith(true)
    })
  })

  describe('when readOnly is true', () => {
    it('renders the Configure button as disabled', () => {
      renderComponent({readOnly: true})
      expect(screen.getByTestId('configure-button')).toBeDisabled()
    })

    it('renders the toggle as disabled', () => {
      renderComponent({readOnly: true})
      expect(screen.getByTestId('discovery-page-toggle')).toBeDisabled()
    })
  })

  describe('when readOnly is omitted', () => {
    it('defaults to interactive (Configure enabled, toggle enabled)', () => {
      renderComponent()
      expect(screen.getByTestId('configure-button')).not.toBeDisabled()
      expect(screen.getByTestId('discovery-page-toggle')).not.toBeDisabled()
    })
  })
})

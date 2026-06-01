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

import {render, fireEvent, waitFor} from '@testing-library/react'
import React from 'react'
import {Restore} from '../Restore'

const setup = (props = {}) => {
  const defaultProps = {
    onClick: vi.fn().mockResolvedValue(undefined),
    loading: false,
  }

  return render(<Restore {...defaultProps} {...props} />)
}

describe('Restore', () => {
  it('renders the restore affordance for a deleted entry', () => {
    const {getByTestId, getByText} = setup()

    const restoreButton = getByTestId('threading-toolbar-restore')
    expect(restoreButton).toBeInTheDocument()
    expect(getByText('Restore')).toBeInTheDocument()
  })

  it('opens the restore confirmation modal when the affordance is clicked', () => {
    const {getByTestId, queryByTestId} = setup()

    // Modal is not mounted/open until the restore affordance is clicked.
    expect(queryByTestId('restore-entry-modal')).not.toBeInTheDocument()

    fireEvent.click(getByTestId('threading-toolbar-restore'))

    expect(getByTestId('restore-entry-modal')).toBeInTheDocument()
    expect(getByTestId('restore-entry-submit')).toBeInTheDocument()
  })

  it('restores the entry by invoking onClick when the modal is submitted', async () => {
    const onClick = vi.fn().mockResolvedValue(undefined)
    const {getByTestId} = setup({onClick})

    fireEvent.click(getByTestId('threading-toolbar-restore'))
    expect(onClick).not.toHaveBeenCalled()

    fireEvent.click(getByTestId('restore-entry-submit'))

    await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1))
  })

  it('disables the submit control while a restore is in flight', () => {
    const {getByTestId} = setup({loading: true})

    fireEvent.click(getByTestId('threading-toolbar-restore'))

    expect(getByTestId('restore-entry-submit')).toBeDisabled()
  })
})

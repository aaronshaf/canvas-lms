/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import '@instructure/canvas-theme'
import React from 'react'
import {cleanup, render, fireEvent, waitFor} from '@testing-library/react'
import ConfirmDeleteModal from '../ConfirmDeleteModal'

const defaultProps = () => ({
  pageTitles: ['page_1'],
  onConfirm: () => Promise.resolve({failures: []}),
})

test('renders cancel and delete button', async () => {
  const ref = React.createRef<any>()
  const {findByText} = render(<ConfirmDeleteModal {...defaultProps()} ref={ref} />)
  ref.current?.show()

  expect(await findByText('Cancel')).toBeInTheDocument()
  expect(await findByText('Delete')).toBeInTheDocument()
})

test('closes the ConfirmDeleteModal when cancel pressed', async () => {
  const ref = React.createRef<any>()
  const onHide = vi.fn()
  const {findByText} = render(<ConfirmDeleteModal {...defaultProps()} onHide={onHide} ref={ref} />)
  ref.current?.show()

  const cancelButton = await findByText('Cancel')
  fireEvent.click(cancelButton)

  await waitFor(() => {
    expect(onHide).toHaveBeenCalledWith(false, false)
  })
})

test('shows spinner on delete', async () => {
  const ref = React.createRef<any>()
  const {findByText, getByTitle} = render(<ConfirmDeleteModal {...defaultProps()} ref={ref} />)
  ref.current?.show()

  const deleteButton = await findByText('Delete')
  fireEvent.click(deleteButton)

  expect(getByTitle('Delete in progress')).toBeInTheDocument()
})

test('renders provided page titles', async () => {
  const ref = React.createRef<any>()
  const {findByText} = render(<ConfirmDeleteModal {...defaultProps()} ref={ref} />)
  ref.current?.show()

  expect(await findByText('page_1')).toBeInTheDocument()
  expect(await findByText('1 page selected for deletion')).toBeInTheDocument()
})

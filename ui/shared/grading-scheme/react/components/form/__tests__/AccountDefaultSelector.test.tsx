/*
 * Copyright (C) 2024 - present Instructure, Inc.
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
import {fireEvent, render, waitFor} from '@testing-library/react'
import {AccountDefaultSelector, type AccountDefaultSelectorProps} from '../AccountDefaultSelector'
import {AccountGradingSchemes} from '../../__tests__/fixtures'

describe('AccountDefaultSelector tests', () => {
  const renderAccountDefaultSelector = (props: Partial<AccountDefaultSelectorProps> = {}) => {
    return render(
      <AccountDefaultSelector
        defaultGradingSchemeId="0"
        gradingSchemes={AccountGradingSchemes}
        onChange={() => {}}
        {...props}
      />,
    )
  }

  it('apply/applied button is not shown initially', () => {
    const {queryByText} = renderAccountDefaultSelector()
    expect(queryByText('Apply')).not.toBeInTheDocument()
    expect(queryByText('Applied')).not.toBeInTheDocument()
  })

  it('apply button appears when you switch to an unselected grading scheme', async () => {
    const {findByText, getByTestId, findByTestId} = renderAccountDefaultSelector()
    const select = getByTestId('account-default-grading-scheme-select')
    fireEvent.click(select)
    const option = await findByTestId('grading-scheme-1-option')
    fireEvent.click(option)
    expect(await findByText('Apply')).toBeInTheDocument()
  })

  it('opens a confirmation modal when apply is clicked to change the default grading scheme', async () => {
    const {findByText, getByTestId, findByTestId} = renderAccountDefaultSelector()
    const select = getByTestId('account-default-grading-scheme-select')
    fireEvent.click(select)
    const option = await findByTestId('grading-scheme-1-option')
    fireEvent.click(option)
    const apply = await findByText('Apply')
    fireEvent.click(apply)
    expect(await findByText('Confirm Default Grading Scheme Change')).toBeInTheDocument()
  })

  it('apply button text changes to applied after default grading scheme changes', async () => {
    const {findByText, getByTestId, findByTestId} = renderAccountDefaultSelector()
    const select = getByTestId('account-default-grading-scheme-select')
    fireEvent.click(select)
    const option = await findByTestId('grading-scheme-1-option')
    fireEvent.click(option)
    const apply = await findByText('Apply')
    fireEvent.click(apply)
    const confirm = await findByText('Confirm')
    fireEvent.click(confirm)
    expect(await findByText('Applied')).toBeInTheDocument()
  })

  it('apply button does not change text if the confirmation modal is canceled or closed', async () => {
    const {findByText, getByTestId, findByTestId} = renderAccountDefaultSelector()
    const select = getByTestId('account-default-grading-scheme-select')
    fireEvent.click(select)
    const option = await findByTestId('grading-scheme-1-option')
    fireEvent.click(option)
    const apply = await findByText('Apply')
    fireEvent.click(apply)
    const cancel = await findByText('Cancel')
    fireEvent.click(cancel)
    await waitFor(() => expect(select).toBeInTheDocument()) // let state settle
    fireEvent.click(apply)
    const close = await findByTestId('confirm-default-grading-scheme-change-modal-close-button')
    fireEvent.click(close)
    expect(await findByText('Apply')).toBeInTheDocument()
  })

  it('reselecting the current default changes the apply text to applied', async () => {
    const {findByText, getByTestId, findByTestId} = renderAccountDefaultSelector()
    const select = getByTestId('account-default-grading-scheme-select')
    fireEvent.click(select)
    const option = await findByTestId('grading-scheme-1-option')
    fireEvent.click(option)
    expect(await findByText('Apply')).toBeInTheDocument()
    fireEvent.click(select)
    const current = await findByTestId('grading-scheme-0-option')
    fireEvent.click(current)
    expect(await findByText('Applied')).toBeInTheDocument()
  })
})

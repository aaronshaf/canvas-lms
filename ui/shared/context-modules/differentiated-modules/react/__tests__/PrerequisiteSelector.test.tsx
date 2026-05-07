/*
 * Copyright (C) 2023 - present Instructure, Inc.
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
import PrerequisiteSelector, {type PrerequisiteSelectorProps} from '../PrerequisiteSelector'

describe('PrerequisiteSelector', () => {
  const props: PrerequisiteSelectorProps = {
    selection: 'Module 1',
    options: [
      {id: '1', name: 'Module 1'},
      {id: '2', name: 'Module 2'},
    ],
    onDropPrerequisite: vi.fn(),
    onUpdatePrerequisite: vi.fn(),
    index: 0,
  }

  const renderComponent = (overrides = {}) =>
    render(<PrerequisiteSelector {...props} {...overrides} />)

  beforeEach(() => {
    document.body.innerHTML = `<div id="flash_screenreader_holder" role="alert"></div>`
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('renders', () => {
    const {getByText} = renderComponent()
    expect(getByText('Select Prerequisite')).toBeInTheDocument()
  })

  it('shows the selected value', () => {
    const {getByDisplayValue} = renderComponent()
    expect(getByDisplayValue('Module 1')).toBeInTheDocument()
  })

  it('shows the available options when expanded', async () => {
    const {getByText, findByText} = renderComponent()
    fireEvent.click(getByText('Select Prerequisite'))
    expect(await findByText('Module 1')).toBeInTheDocument()
    expect(await findByText('Module 2')).toBeInTheDocument()
  })

  it('calls onUpdatePrerequisite when a new option is selected', async () => {
    const {getByText, findByText} = renderComponent()
    fireEvent.click(getByText('Select Prerequisite'))
    const option = await findByText('Module 2')
    fireEvent.click(option)
    await waitFor(() =>
      expect(props.onUpdatePrerequisite).toHaveBeenCalledWith({id: '2', name: 'Module 2'}, 0),
    )
  })

  it('calls onDropPrerequisite when the remove button is clicked', () => {
    const {getByText} = renderComponent()
    fireEvent.click(getByText('Remove Module 1 Prerequisite'))
    expect(props.onDropPrerequisite).toHaveBeenCalledWith(0)
  })
})

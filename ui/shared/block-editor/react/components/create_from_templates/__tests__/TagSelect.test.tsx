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
import {TagSelect, AvailableTags} from '../TagSelect'

const renderComponent = (props = {}) => {
  return render(
    <TagSelect
      onChange={vi.fn()}
      selectedTags={Object.keys(AvailableTags)}
      interaction="enabled"
      {...props}
    />,
  )
}

const isMenuItemChecked = (li: HTMLLIElement): boolean => {
  return li.querySelector('svg[name="IconCheck"]') !== null
}

describe('TagSelect', () => {
  it('renders', () => {
    const {getByText} = renderComponent()
    expect(getByText('Apply Filters')).toBeInTheDocument()
  })

  it('shows the menu', async () => {
    const {getByText, findByText} = renderComponent()
    const trigger = getByText('Apply Filters').closest('button')

    fireEvent.click(trigger!)
    expect(await findByText('Home')).toBeInTheDocument()
    expect(await findByText('Resource')).toBeInTheDocument()
    expect(await findByText('Module Overview')).toBeInTheDocument()
    expect(await findByText('Introduction')).toBeInTheDocument()
    expect(await findByText('General Content')).toBeInTheDocument()
  })

  it('checks the selected tags', async () => {
    const selectedTags = ['home', 'resource', 'intro']
    const {getByText, findByText} = renderComponent({selectedTags})
    const trigger = getByText('Apply Filters').closest('button')
    fireEvent.click(trigger!)

    // Wait for the menu to appear
    await findByText(AvailableTags[Object.keys(AvailableTags)[0]])

    for (const tag of Object.keys(AvailableTags)) {
      const li = getByText(AvailableTags[tag]).parentElement
      const isChecked = selectedTags.includes(tag)
      expect(isMenuItemChecked(li as HTMLLIElement)).toBe(isChecked)
    }
  })

  it('calls onChange when a tag is selected', async () => {
    const onChange = vi.fn()
    const selectedTags = ['resource']
    const {getByText, findByText} = renderComponent({selectedTags, onChange})
    const trigger = getByText('Apply Filters').closest('button')
    fireEvent.click(trigger!)

    const li = await findByText('Home')
    fireEvent.click(li!)
    expect(onChange).toHaveBeenCalledWith(['resource', 'home'])
  })
})

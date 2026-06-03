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

import React from 'react'
import {render, screen} from '@testing-library/react'
import userEvent, {UserEvent} from '@testing-library/user-event'
import {MemoryRouter, Route, Routes} from 'react-router-dom'
import SearchBar from '../SearchBar'

type SearchBarProps = React.ComponentProps<typeof SearchBar>
const defaultProps: SearchBarProps = {
  initialValue: '',
  onSearch: vi.fn(),
}

const renderComponent = (props?: Partial<SearchBarProps>) => {
  return render(
    <MemoryRouter
      initialEntries={[`/?search_term=${props?.initialValue || defaultProps.initialValue}`]}
    >
      <Routes>
        <Route path="/" element={<SearchBar {...defaultProps} {...props} />} />
      </Routes>
    </MemoryRouter>,
  )
}

const getSearchButton = () => screen.getByRole('button', {name: 'Search'})
const getClearButton = () => screen.getByRole('button', {name: 'Clear search'})
const getInput = () => screen.getByPlaceholderText('Search files...')

describe('SearchBar', () => {
  const expectedSearchTerm = 'searchTerm'
  const onSearch = vi.fn<(searchTerm: string) => void>()
  let user: UserEvent

  beforeEach(() => {
    vi.clearAllMocks()
    user = userEvent.setup()
  })

  describe('input field', () => {
    beforeEach(() => {
      renderComponent({initialValue: expectedSearchTerm})
    })

    it('renders with initial value', () => {
      expect(getInput()).toHaveValue(expectedSearchTerm)
    })

    it('clears the search value', async () => {
      await user.click(getClearButton())
      expect(getInput()).toHaveValue('')
    })

    it('changes as the user types', async () => {
      const newText = 'new text'
      await user.type(getInput(), newText)
      expect(getInput()).toHaveValue(expectedSearchTerm + newText)
    })
  })

  describe('when input is empty', () => {
    beforeEach(() => {
      renderComponent({initialValue: '', onSearch})
    })

    it('searches on button click', async () => {
      await user.click(getSearchButton())
      expect(onSearch).toHaveBeenCalled()
    })

    it('searches on enter press', async () => {
      await user.click(getInput())
      await user.keyboard('{enter}')
      expect(onSearch).toHaveBeenCalled()
    })

    // covers spec/selenium/files_v2/files_spec.rb:70 (can search for file, folder and file inside folder)
    // The SearchBar's contribution to that scenario: typing 'example' and clicking search
    // invokes onSearch with exactly the typed term (the consumer then issues the search request).
    it('invokes onSearch with the exact typed term when searching by button', async () => {
      await user.type(getInput(), 'example')
      await user.click(getSearchButton())
      expect(onSearch).toHaveBeenCalledWith('example')
    })

    // covers spec/selenium/files_v2/files_spec.rb:718 (Can search for files)
    // Typing a specific filename and submitting passes that filename verbatim to onSearch.
    it('invokes onSearch with the exact typed filename when searching by enter', async () => {
      await user.type(getInput(), 'file1.pdf')
      await user.keyboard('{enter}')
      expect(onSearch).toHaveBeenCalledWith('file1.pdf')
    })
  })

  describe('when input is not empty', () => {
    beforeEach(() => {
      renderComponent({initialValue: expectedSearchTerm, onSearch})
    })

    it('searches on click', async () => {
      await user.click(getSearchButton())
      expect(onSearch).toHaveBeenCalledWith(expectedSearchTerm)
    })

    it('searches on enter press', async () => {
      await user.click(getInput())
      await user.keyboard('{enter}')
      expect(onSearch).toHaveBeenCalledWith(expectedSearchTerm)
    })
  })
})

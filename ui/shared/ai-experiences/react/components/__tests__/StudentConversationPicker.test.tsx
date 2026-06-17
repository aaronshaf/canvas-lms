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

import '@instructure/canvas-theme'
import React from 'react'
import {render, screen, waitFor, act} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StudentConversationPicker from '../StudentConversationPicker'
import type {StudentConversation} from '../../../types'

const conversations: StudentConversation[] = [
  {id: 'c1', user_id: '1', student: {id: '1', name: 'Aaron'}, has_conversation: true},
  {id: null, user_id: '2', student: {id: '2', name: 'Beth'}, has_conversation: false},
]

const baseProps = {
  conversations,
  selectedIdentifier: undefined,
  selectedLabel: '',
  isLoading: false,
  isLoadingMore: false,
  onSelect: () => {},
  onSearch: () => {},
}

describe('StudentConversationPicker', () => {
  it('renders each student as an option, disabling those without a conversation', async () => {
    const user = userEvent.setup()
    render(<StudentConversationPicker {...baseProps} />)

    await user.click(screen.getByLabelText('Filter by student'))

    const aaron = screen.getByText('Aaron ✓', {selector: '[role="option"]'})
    const beth = screen.getByText('Beth (no conversation)', {selector: '[role="option"]'})
    expect(aaron).not.toHaveAttribute('aria-disabled', 'true')
    expect(beth).toHaveAttribute('aria-disabled', 'true')
  })

  it('calls onSelect with the identifier when an option is chosen', async () => {
    const user = userEvent.setup()
    const onSelect = jest.fn()
    render(<StudentConversationPicker {...baseProps} onSelect={onSelect} />)

    await user.click(screen.getByLabelText('Filter by student'))
    await user.click(screen.getByText('Aaron ✓', {selector: '[role="option"]'}))

    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('shows the selected student label in the input', () => {
    render(
      <StudentConversationPicker {...baseProps} selectedIdentifier="c1" selectedLabel="Aaron" />,
    )
    expect(screen.getByLabelText('Filter by student')).toHaveValue('Aaron')
  })

  it('calls onSearch with the typed term after the debounce', async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime})
    const onSearch = jest.fn()
    render(<StudentConversationPicker {...baseProps} onSearch={onSearch} />)
    onSearch.mockClear() // ignore the initial empty-term call on mount

    await user.type(screen.getByLabelText('Filter by student'), 'Be')
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Be'))
    jest.useRealTimers()
  })
})

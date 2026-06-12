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

import '@instructure/canvas-theme'
import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import ConversationLanding from '../components/ConversationLanding'

describe('ConversationLanding', () => {
  it('renders student landing', () => {
    render(<ConversationLanding onStart={vi.fn()} />)
    expect(screen.getByText(/Knowledge check/)).toBeInTheDocument()
    expect(screen.getByText('Ready to chat?')).toBeInTheDocument()
    expect(
      screen.getByText('Hit required talking points that check your understanding.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('llm-conversation-start-button')).toHaveTextContent('Get started')
  })

  it('renders teacher preview landing', () => {
    render(<ConversationLanding onStart={vi.fn()} isTeacherPreview={true} />)
    expect(screen.getByText(/Knowledge check/)).toBeInTheDocument()
    expect(screen.getByText('Ready to chat?')).toBeInTheDocument()
    expect(screen.getByText('Preview the student experience.')).toBeInTheDocument()
    expect(screen.getByTestId('llm-conversation-start-button')).toHaveTextContent('Try it out')
  })

  it('calls onStart when the button is clicked', () => {
    const onStart = vi.fn()
    render(<ConversationLanding onStart={onStart} />)
    fireEvent.click(screen.getByTestId('llm-conversation-start-button'))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})

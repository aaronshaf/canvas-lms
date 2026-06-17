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
import {render, screen, fireEvent} from '@testing-library/react'
import AIExperienceError from '../AIExperienceError'

describe('AIExperienceError', () => {
  it('renders the friendly message plus the reference id and code', () => {
    render(
      <AIExperienceError
        error={{
          message: 'This conversation could not be found.',
          code: 'conversation_not_found',
          referenceId: 'abc-123',
        }}
      />,
    )
    expect(screen.getByTestId('ai-experience-error')).toBeInTheDocument()
    expect(screen.getByText('This conversation could not be found.')).toBeInTheDocument()
    expect(screen.getByTestId('ai-experience-error-reference')).toHaveTextContent('abc-123')
    expect(screen.getByTestId('ai-experience-error-code')).toHaveTextContent(
      'conversation_not_found',
    )
  })

  it('omits the meta row when there is no code or reference id', () => {
    render(<AIExperienceError error={{message: 'Generic failure.'}} />)
    expect(screen.getByText('Generic failure.')).toBeInTheDocument()
    expect(screen.queryByTestId('ai-experience-error-reference')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ai-experience-error-code')).not.toBeInTheDocument()
  })

  it('renders the reference id even when the code is absent', () => {
    render(<AIExperienceError error={{message: 'boom', referenceId: 'ref-only'}} />)
    expect(screen.getByTestId('ai-experience-error-reference')).toHaveTextContent('ref-only')
    expect(screen.queryByTestId('ai-experience-error-code')).not.toBeInTheDocument()
  })

  it('calls onDismiss when the close button is clicked', () => {
    const onDismiss = jest.fn()
    render(<AIExperienceError error={{message: 'boom', referenceId: 'r1'}} onDismiss={onDismiss} />)
    // InstUI Alert puts the "Close" label in a screen-reader span inside the button;
    // click the button ancestor (Canvas precedent), not the label node.
    fireEvent.click(screen.getByText('Close').closest('button') as HTMLElement)
    expect(onDismiss).toHaveBeenCalled()
  })

  it('shows a Try again button only when the error is retryable and onRetry is given', () => {
    const onRetry = jest.fn()
    render(<AIExperienceError error={{message: 'boom', retryable: true}} onRetry={onRetry} />)
    fireEvent.click(screen.getByTestId('ai-experience-error-retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('hides Try again for a non-retryable error even when onRetry is given', () => {
    render(
      <AIExperienceError error={{message: 'bad config', retryable: false}} onRetry={() => {}} />,
    )
    expect(screen.queryByTestId('ai-experience-error-retry')).not.toBeInTheDocument()
  })

  it('hides Try again when no onRetry is provided', () => {
    render(<AIExperienceError error={{message: 'boom', retryable: true}} />)
    expect(screen.queryByTestId('ai-experience-error-retry')).not.toBeInTheDocument()
  })
})

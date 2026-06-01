/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import {render, fireEvent} from '@testing-library/react'
import React from 'react'
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom'
import Session from '../session'

describe('canvas_quizzes/events/views/session', () => {
  it('renders', () => {
    render(
      <MemoryRouter>
        <Session />
      </MemoryRouter>,
    )
  })

  it('renders a link for every available attempt', () => {
    const {queryByTestId, getByTestId} = render(
      <MemoryRouter>
        <Session availableAttempts={[1, 2, 3]} attempt={2} />
      </MemoryRouter>,
    )

    expect(queryByTestId('attempt-1')).toBeTruthy()
    expect(getByTestId('attempt-1').nodeName).toBe('A')
    expect(queryByTestId('attempt-3')).toBeTruthy()
    expect(getByTestId('attempt-3').nodeName).toBe('A')
    expect(queryByTestId('current-attempt')).toBeTruthy()
    expect(getByTestId('current-attempt').nodeName).not.toBe('A')
  })

  it('displays the attempt number text for a single attempt', () => {
    const {getByTestId, container} = render(
      <MemoryRouter>
        <Session availableAttempts={[1]} attempt={1} />
      </MemoryRouter>,
    )

    expect(getByTestId('current-attempt')).toHaveTextContent('1')
    expect(container.querySelectorAll('.ic-AttemptController__Attempt')).toHaveLength(1)
  })

  it('displays the attempt number text for each attempt when multiple attempts exist', () => {
    const {getByTestId, container} = render(
      <MemoryRouter>
        <Session availableAttempts={[1, 2]} attempt={2} />
      </MemoryRouter>,
    )

    const attemptEls = container.querySelectorAll('.ic-AttemptController__Attempt')
    expect(attemptEls).toHaveLength(2)
    expect(getByTestId('attempt-1')).toHaveTextContent('1')
    expect(getByTestId('current-attempt')).toHaveTextContent('2')
  })

  it('updates the URL with the attempt query string when an attempt link is clicked', () => {
    const LocationDisplay = () => {
      const location = useLocation()
      return <div data-testid="location-search">{location.search}</div>
    }

    const {getByTestId} = render(
      <MemoryRouter initialEntries={['/?attempt=2']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Session availableAttempts={[1, 2]} attempt={2} />
                <LocationDisplay />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(getByTestId('attempt-1'))
    expect(getByTestId('location-search')).toHaveTextContent('?attempt=1')
  })
})

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

import React from 'react'
import {render, screen, fireEvent} from '@testing-library/react'
import NotebookFilters from '../NotebookFilters'

let lastUseReactionFilterArgs: {
  filter: string | null
  setFilter: (filter: string | null) => void
} | null = null

vi.mock('@instructure/platform-notebook', () => ({
  REACTION_TYPE: {IMPORTANT: 'Important', CONFUSING: 'Confusing'},
  useReactionFilter: (props: {
    filter: string | null
    setFilter: (filter: string | null) => void
  }) => {
    lastUseReactionFilterArgs = props
    return {
      filterElement: (
        <button
          data-testid="reaction-filter-button"
          type="button"
          onClick={() => props.setFilter('Important' as never)}
        >
          {props.filter ?? 'all'}
        </button>
      ),
      reactionFilterOptions: [],
      handleReactionFilterChange: vi.fn(),
    }
  },
}))

describe('NotebookFilters', () => {
  beforeEach(() => {
    lastUseReactionFilterArgs = null
  })

  it('passes filter and setFilter into useReactionFilter', () => {
    const setFilter = vi.fn()
    render(<NotebookFilters filter={null} setFilter={setFilter} />)
    expect(lastUseReactionFilterArgs?.filter).toBeNull()
    expect(lastUseReactionFilterArgs?.setFilter).toBe(setFilter)
  })

  it('renders the reaction filter element', () => {
    render(<NotebookFilters filter={null} setFilter={vi.fn()} />)
    expect(screen.getByTestId('reaction-filter-button')).toBeInTheDocument()
  })

  it('calls setFilter when the filter is changed', () => {
    const setFilter = vi.fn()
    render(<NotebookFilters filter={null} setFilter={setFilter} />)
    fireEvent.click(screen.getByTestId('reaction-filter-button'))
    expect(setFilter).toHaveBeenCalledWith('Important')
  })

  it('renders the total results count when totalCount is provided', () => {
    render(<NotebookFilters filter={null} setFilter={vi.fn()} totalCount={17} />)
    expect(screen.getByTestId('notebook-total-results')).toHaveTextContent('17 results')
  })

  it('omits the total results count when totalCount is undefined', () => {
    render(<NotebookFilters filter={null} setFilter={vi.fn()} />)
    expect(screen.queryByTestId('notebook-total-results')).not.toBeInTheDocument()
  })
})

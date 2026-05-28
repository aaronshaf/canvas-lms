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
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotebookIndexPage from '../NotebookIndexPage'

const mockUseNotesData = vi.fn()
const mockUseNotesColumnCount = vi.fn()

vi.mock('../../hooks/useNotesColumnCount', () => ({
  useNotesColumnCount: (...args: unknown[]) => mockUseNotesColumnCount(...args),
}))

vi.mock('@instructure/platform-notebook', () => ({
  NotebookProvider: ({children}: {children: React.ReactNode}) => (
    <div data-testid="notebook-provider">{children}</div>
  ),
  NotebookEmptyState: ({hasActiveFilter}: {hasActiveFilter?: boolean}) => (
    <div
      data-testid="notebook-empty-state"
      data-has-active-filter={hasActiveFilter ? 'true' : 'false'}
    />
  ),
  NotesListView: ({
    notes,
    isLoading,
    isError,
    columnCount,
    currentPage,
    totalPages,
    onPageChange,
    noteHref,
    renderNoteLink,
  }: {
    notes: {id: string; objectId: string; courseId: string}[]
    isLoading: boolean
    isError: boolean
    columnCount?: number
    currentPage?: number
    totalPages?: number
    onPageChange?: (page: number) => void
    noteHref?: (noteId: string, note: {id: string; objectId: string; courseId: string}) => string
    renderNoteLink?: (props: {href: string; children: React.ReactNode}) => React.ReactNode
  }) => {
    if (isLoading) return <div data-testid="notes-loading" />
    if (isError) return <div data-testid="notes-error" />
    if (notes.length === 0) return <div data-testid="notes-empty" />
    return (
      <div
        data-testid="notes-grid"
        data-column-count={columnCount}
        data-current-page={currentPage}
        data-total-pages={totalPages}
      >
        <button type="button" data-testid="notes-go-to-page-3" onClick={() => onPageChange?.(3)}>
          page 3
        </button>
        {notes.map(note => {
          const href = noteHref?.(note.id, note)
          return renderNoteLink ? (
            <span key={note.id}>{renderNoteLink({href: href ?? '', children: note.id})}</span>
          ) : (
            <span key={note.id}>{note.id}</span>
          )
        })}
      </div>
    )
  },
  useNotebook: () => ({
    api: {},
    courseId: '42',
  }),
  useNotesData: (...args: unknown[]) => mockUseNotesData(...args),
  useReactionFilter: () => ({
    filterElement: <div data-testid="reaction-filter" />,
    reactionFilterOptions: [],
    handleReactionFilterChange: vi.fn(),
  }),
  REACTION_TYPE: {IMPORTANT: 'Important', CONFUSING: 'Confusing'},
}))

vi.mock('@canvas/notebook', () => ({
  CanvasNotebookApi: vi.fn(),
  notebookTranslations: {},
  notebookTranslate: vi.fn((key: string) => key),
  HIGHLIGHT_THEME: {},
}))

const makeNote = (id: string) => ({
  id,
  rootAccountUuid: 'root',
  userId: 'user-1',
  courseId: '42',
  objectId: `page-${id}`,
  objectType: 'Page',
  reaction: [],
  highlightData: {
    selectedText: 'text',
    textPosition: null,
    range: null,
    pageLastModifiedAt: '2026-01-01T00:00:00Z',
  },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

const defaultNotesDataReturn = {
  notes: [] as ReturnType<typeof makeNote>[],
  pageInfo: undefined,
  isLoading: false,
  isError: false,
  filter: null,
  setFilter: vi.fn(),
  courseFilter: null,
  setCourseFilter: vi.fn(),
  currentPage: 1,
  setPage: vi.fn(),
  fetchNextPage: vi.fn(),
  fetchPreviousPage: vi.fn(),
}

describe('NotebookIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.ENV = {
      ...window.ENV,
      current_user_id: 'user-1',
      COURSE_ID: '42',
    } as typeof window.ENV
    mockUseNotesColumnCount.mockReturnValue(4)
    mockUseNotesData.mockReturnValue(defaultNotesDataReturn)
  })

  it('renders nothing when COURSE_ID is not set', () => {
    window.ENV.COURSE_ID = undefined
    const {container} = render(<NotebookIndexPage />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the notes grid when data is present', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1'), makeNote('2')],
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-grid')).toBeInTheDocument()
  })

  it('renders note links to the source page', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1')],
    })
    render(<NotebookIndexPage />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/courses/42/pages/page-1?note_id=1')
  })

  it('renders the loading state', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      isLoading: true,
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-loading')).toBeInTheDocument()
  })

  it('renders the error state', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      isError: true,
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-error')).toBeInTheDocument()
  })

  it('renders the empty state', () => {
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notebook-empty-state')).toHaveAttribute(
      'data-has-active-filter',
      'false',
    )
  })

  it('keeps filters visible and forwards hasActiveFilter when a filter is active with no results', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [],
      filter: 'Important',
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('reaction-filter')).toBeInTheDocument()
    expect(screen.getByTestId('notebook-empty-state')).toHaveAttribute(
      'data-has-active-filter',
      'true',
    )
  })

  it('renders the reaction filter above the grid', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1')],
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('reaction-filter')).toBeInTheDocument()
  })

  it('passes the default page size to useNotesData', () => {
    render(<NotebookIndexPage />)
    expect(mockUseNotesData).toHaveBeenCalledWith(expect.objectContaining({pageSize: 24}))
  })

  it('applies columnCount from useNotesColumnCount to NotesListView', () => {
    mockUseNotesColumnCount.mockReturnValue(1)
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1')],
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-grid')).toHaveAttribute('data-column-count', '1')
  })

  it('renders the total results count when pageInfo includes totalCount', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1')],
      pageInfo: {totalCount: 42},
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notebook-total-results')).toHaveTextContent('42 results')
  })

  it('omits the total results count when totalCount is unknown', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1')],
      pageInfo: {},
    })
    render(<NotebookIndexPage />)
    expect(screen.queryByTestId('notebook-total-results')).not.toBeInTheDocument()
  })

  it('passes currentPage and totalPages from useNotesData into NotesListView', () => {
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1')],
      currentPage: 2,
      pageInfo: {totalNrOfPages: 5},
    })
    render(<NotebookIndexPage />)
    const grid = screen.getByTestId('notes-grid')
    expect(grid).toHaveAttribute('data-current-page', '2')
    expect(grid).toHaveAttribute('data-total-pages', '5')
  })

  it('forwards page changes to setPage from useNotesData', async () => {
    const setPage = vi.fn()
    mockUseNotesData.mockReturnValue({
      ...defaultNotesDataReturn,
      notes: [makeNote('1')],
      setPage,
      currentPage: 1,
      pageInfo: {totalNrOfPages: 5},
    })
    render(<NotebookIndexPage />)
    const user = userEvent.setup()
    await user.click(screen.getByTestId('notes-go-to-page-3'))
    expect(setPage).toHaveBeenCalledWith(3)
  })
})

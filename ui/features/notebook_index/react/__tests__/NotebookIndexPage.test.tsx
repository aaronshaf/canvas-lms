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
import NotebookIndexPage from '../NotebookIndexPage'

const mockUseNotesData = vi.fn()

vi.mock('@instructure/platform-notebook', () => ({
  NotebookProvider: ({children}: {children: React.ReactNode}) => (
    <div data-testid="notebook-provider">{children}</div>
  ),
  NotesListView: ({
    notes,
    isLoading,
    isError,
    noteHref,
    renderNoteLink,
  }: {
    notes: {id: string; objectId: string; courseId: string}[]
    isLoading: boolean
    isError: boolean
    noteHref?: (noteId: string, note: {id: string; objectId: string; courseId: string}) => string
    renderNoteLink?: (props: {href: string; children: React.ReactNode}) => React.ReactNode
  }) => {
    if (isLoading) return <div data-testid="notes-loading" />
    if (isError) return <div data-testid="notes-error" />
    if (notes.length === 0) return <div data-testid="notes-empty" />
    return (
      <div data-testid="notes-grid">
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

describe('NotebookIndexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.ENV = {
      ...window.ENV,
      JOURNEY_URL: 'https://journey.test',
      current_user_id: 'user-1',
      COURSE_ID: '42',
    } as typeof window.ENV
    mockUseNotesData.mockReturnValue({
      notes: [],
      pageInfo: undefined,
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
  })

  it('renders nothing when JOURNEY_URL is not set', () => {
    window.ENV.JOURNEY_URL = undefined
    const {container} = render(<NotebookIndexPage />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the notes grid when data is present', () => {
    mockUseNotesData.mockReturnValue({
      notes: [makeNote('1'), makeNote('2')],
      pageInfo: undefined,
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-grid')).toBeInTheDocument()
  })

  it('renders note links to the source page', () => {
    mockUseNotesData.mockReturnValue({
      notes: [makeNote('1')],
      pageInfo: undefined,
      isLoading: false,
      isError: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    render(<NotebookIndexPage />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/courses/42/pages/page-1?noteId=1')
  })

  it('renders the loading state', () => {
    mockUseNotesData.mockReturnValue({
      notes: [],
      pageInfo: undefined,
      isLoading: true,
      isError: false,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-loading')).toBeInTheDocument()
  })

  it('renders the error state', () => {
    mockUseNotesData.mockReturnValue({
      notes: [],
      pageInfo: undefined,
      isLoading: false,
      isError: true,
      fetchNextPage: vi.fn(),
      fetchPreviousPage: vi.fn(),
    })
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-error')).toBeInTheDocument()
  })

  it('renders the empty state', () => {
    render(<NotebookIndexPage />)
    expect(screen.getByTestId('notes-empty')).toBeInTheDocument()
  })
})

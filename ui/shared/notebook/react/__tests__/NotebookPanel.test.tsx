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
import {NotebookPanel} from '../NotebookPanel'
import {showFlashAlert} from '@instructure/platform-alerts'

vi.mock('@instructure/platform-alerts', () => ({
  showFlashAlert: vi.fn(),
}))

const mockNotesListView = vi.fn((_props: object) => <div data-testid="notes-list-view" />)
const mockUseNotesData = vi.fn()
const mockUpdateNote = vi.fn()
const mockDeleteNote = vi.fn()
const mockCloseTray = vi.fn()
let mockSelectedNoteId: string | null = null

const NOTE_A = {
  id: 'note-1',
  userText: 'original text',
  reaction: ['Important'],
  highlightData: {text: 'some highlight'},
}

const defaultUseNotesDataReturn = {
  notes: [NOTE_A],
  pageInfo: {},
  isLoading: false,
  isError: false,
  filter: null,
  courseFilter: null,
  currentPage: 1,
  setFilter: vi.fn(),
  setCourseFilter: vi.fn(),
  setPage: vi.fn(),
  fetchNextPage: vi.fn(),
  fetchPreviousPage: vi.fn(),
}

vi.mock('@instructure/platform-notebook', () => ({
  useNotebook: () => ({
    api: {},
    objectId: 'page-1',
    objectType: 'Page',
    courseId: '42',
    selectedNoteId: mockSelectedNoteId,
    selectNote: vi.fn(),
    clearSelectedNote: vi.fn(),
    closeTray: mockCloseTray,
  }),
  useNotesData: (...args: unknown[]) => mockUseNotesData(...args),
  useUpdateNote: () => ({mutate: mockUpdateNote}),
  useDeleteNote: () => ({mutate: mockDeleteNote}),
  NotesListView: (props: object) => mockNotesListView(props),
  REACTION_TYPE: {IMPORTANT: 'Important', CONFUSING: 'Confusing'},
}))

type NotesListViewProps = {
  onNoteDelete: (id: string) => void
  onNoteSave: (id: string, text: string) => void
  onNoteTypeChange: (id: string, type: string) => void
  onPageChange?: (page: number) => void
  currentPage?: number
  totalPages?: number
}

function getNotesListProps(): NotesListViewProps {
  return mockNotesListView.mock.calls[0][0] as NotesListViewProps
}

function renderPanel() {
  const onDismiss = vi.fn()
  const closeButtonRef = {current: null}
  render(<NotebookPanel onDismiss={onDismiss} closeButtonRef={closeButtonRef} />)
  return {onDismiss}
}

describe('NotebookPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectedNoteId = null
    mockUseNotesData.mockReturnValue(defaultUseNotesDataReturn)
  })

  it('renders the heading', () => {
    renderPanel()
    expect(screen.getByText('Notebook')).toBeInTheDocument()
  })

  it('requests a page size of 10 and filters by learningObject from context', () => {
    renderPanel()
    expect(mockUseNotesData).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 10,
        learningObject: {type: 'Page', id: 'page-1'},
        courseId: '42',
      }),
    )
  })

  it('passes the selected note as focusNoteId so the tray jumps to its page', () => {
    mockSelectedNoteId = 'note-7'
    renderPanel()
    expect(mockUseNotesData).toHaveBeenCalledWith(expect.objectContaining({focusNoteId: 'note-7'}))
  })

  it('passes currentPage, totalPages, and onPageChange to NotesListView', () => {
    const setPage = vi.fn()
    mockUseNotesData.mockReturnValue({
      ...defaultUseNotesDataReturn,
      currentPage: 2,
      setPage,
      pageInfo: {totalNrOfPages: 5},
    })
    renderPanel()
    const props = getNotesListProps()
    expect(props.currentPage).toBe(2)
    expect(props.totalPages).toBe(5)
    expect(props.onPageChange).toBe(setPage)
  })

  it('calls onDismiss and closeTray when the close button is clicked', async () => {
    const user = userEvent.setup()
    const {onDismiss} = renderPanel()
    const closeEl = screen.getByTestId('notebook-close-button')
    const button = closeEl.tagName === 'BUTTON' ? closeEl : closeEl.querySelector('button')
    await user.click(button!)
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(mockCloseTray).toHaveBeenCalledTimes(1)
  })

  it('handleDelete calls deleteNote with the note id', () => {
    renderPanel()
    getNotesListProps().onNoteDelete('note-1')
    expect(mockDeleteNote).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({onError: expect.any(Function)}),
    )
  })

  it('handleSave calls updateNote preserving reaction and highlightData', () => {
    renderPanel()
    getNotesListProps().onNoteSave('note-1', 'new text')
    expect(mockUpdateNote).toHaveBeenCalledWith(
      {
        id: 'note-1',
        input: {
          id: 'note-1',
          userText: 'new text',
          reaction: NOTE_A.reaction,
          highlightData: NOTE_A.highlightData,
        },
      },
      expect.objectContaining({onError: expect.any(Function)}),
    )
  })

  it('handleSave does nothing when note id is not found', () => {
    renderPanel()
    getNotesListProps().onNoteSave('nonexistent', 'text')
    expect(mockUpdateNote).not.toHaveBeenCalled()
  })

  it('handleTypeChange calls updateNote with new reaction preserving other fields', () => {
    renderPanel()
    getNotesListProps().onNoteTypeChange('note-1', 'Confusing')
    expect(mockUpdateNote).toHaveBeenCalledWith(
      {
        id: 'note-1',
        input: {
          id: 'note-1',
          userText: NOTE_A.userText,
          reaction: ['Confusing'],
          highlightData: NOTE_A.highlightData,
        },
      },
      expect.objectContaining({onError: expect.any(Function)}),
    )
  })

  it('shows a flash error when deleteNote fails', () => {
    renderPanel()
    getNotesListProps().onNoteDelete('note-1')
    const {onError} = mockDeleteNote.mock.calls[0][1] as {onError: (e: Error) => void}
    onError(new Error('Note deletion failed'))
    expect(showFlashAlert).toHaveBeenCalledWith({
      message: 'Note deletion failed',
      type: 'error',
      err: expect.any(Error),
    })
  })

  it('shows a flash error when updateNote fails on save', () => {
    renderPanel()
    getNotesListProps().onNoteSave('note-1', 'new text')
    const {onError} = mockUpdateNote.mock.calls[0][1] as {onError: (e: Error) => void}
    onError(new Error('Error updating note'))
    expect(showFlashAlert).toHaveBeenCalledWith({
      message: 'Error updating note',
      type: 'error',
      err: expect.any(Error),
    })
  })

  it('shows a flash error when updateNote fails on type change', () => {
    renderPanel()
    getNotesListProps().onNoteTypeChange('note-1', 'Confusing')
    const {onError} = mockUpdateNote.mock.calls[0][1] as {onError: (e: Error) => void}
    onError(new Error('Error updating note'))
    expect(showFlashAlert).toHaveBeenCalledWith({
      message: 'Error updating note',
      type: 'error',
      err: expect.any(Error),
    })
  })

  it('handleTypeChange does nothing when note id is not found', () => {
    renderPanel()
    getNotesListProps().onNoteTypeChange('nonexistent', 'Confusing')
    expect(mockUpdateNote).not.toHaveBeenCalled()
  })
})

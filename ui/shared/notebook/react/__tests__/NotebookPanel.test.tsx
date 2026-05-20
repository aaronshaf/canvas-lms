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

const mockNotesListView = vi.fn((_props: object) => <div data-testid="notes-list-view" />)
const mockUpdateNote = vi.fn()
const mockDeleteNote = vi.fn()
const mockCloseTray = vi.fn()

const NOTE_A = {
  id: 'note-1',
  userText: 'original text',
  reaction: ['Important'],
  highlightData: {text: 'some highlight'},
}

vi.mock('@instructure/platform-notebook', () => ({
  useNotebook: () => ({
    api: {},
    objectId: 'page-1',
    objectType: 'Page',
    courseId: '42',
    selectedNoteId: null,
    selectNote: vi.fn(),
    clearSelectedNote: vi.fn(),
    closeTray: mockCloseTray,
  }),
  useGetNotes: () => ({
    data: {notes: [NOTE_A], pageInfo: {}},
    isLoading: false,
    isError: false,
  }),
  useUpdateNote: () => ({mutate: mockUpdateNote}),
  useDeleteNote: () => ({mutate: mockDeleteNote}),
  NotesListView: (props: object) => mockNotesListView(props),
  REACTION_TYPE: {IMPORTANT: 'Important', CONFUSING: 'Confusing'},
}))

type NotesListViewProps = {
  onNoteDelete: (id: string) => void
  onNoteSave: (id: string, text: string) => void
  onNoteTypeChange: (id: string, type: string) => void
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
  })

  it('renders the heading', () => {
    renderPanel()
    expect(screen.getByText('Notebook')).toBeInTheDocument()
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
    expect(mockDeleteNote).toHaveBeenCalledWith('note-1')
  })

  it('handleSave calls updateNote preserving reaction and highlightData', () => {
    renderPanel()
    getNotesListProps().onNoteSave('note-1', 'new text')
    expect(mockUpdateNote).toHaveBeenCalledWith({
      id: 'note-1',
      input: {
        id: 'note-1',
        userText: 'new text',
        reaction: NOTE_A.reaction,
        highlightData: NOTE_A.highlightData,
      },
    })
  })

  it('handleSave does nothing when note id is not found', () => {
    renderPanel()
    getNotesListProps().onNoteSave('nonexistent', 'text')
    expect(mockUpdateNote).not.toHaveBeenCalled()
  })

  it('handleTypeChange calls updateNote with new reaction preserving other fields', () => {
    renderPanel()
    getNotesListProps().onNoteTypeChange('note-1', 'Confusing')
    expect(mockUpdateNote).toHaveBeenCalledWith({
      id: 'note-1',
      input: {
        id: 'note-1',
        userText: NOTE_A.userText,
        reaction: ['Confusing'],
        highlightData: NOTE_A.highlightData,
      },
    })
  })

  it('handleTypeChange does nothing when note id is not found', () => {
    renderPanel()
    getNotesListProps().onNoteTypeChange('nonexistent', 'Confusing')
    expect(mockUpdateNote).not.toHaveBeenCalled()
  })
})

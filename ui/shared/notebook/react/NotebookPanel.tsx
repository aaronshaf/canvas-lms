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

import React, {useCallback, useEffect} from 'react'
import {
  NotesListView,
  useNotebook,
  useNotesData,
  useUpdateNote,
  useDeleteNote,
  REACTION_TYPE,
} from '@instructure/platform-notebook'
import {useScope as createI18nScope} from '@canvas/i18n'
import {showFlashAlert} from '@instructure/platform-alerts'
import {HIGHLIGHT_THEME} from '../themes'
import {CloseButton} from '@instructure/ui-buttons'
import {Flex} from '@instructure/ui-flex'
import {Heading} from '@instructure/ui-heading'
import {View} from '@instructure/ui-view'

const I18n = createI18nScope('notebook')

const TRAY_PAGE_SIZE = 10

type Props = {
  onDismiss: () => void
  closeButtonRef: React.MutableRefObject<Element | null>
}

type HeaderProps = {
  onDismiss: () => void
  closeButtonRef: React.MutableRefObject<Element | null>
}

function NotebookPanelHeader({onDismiss, closeButtonRef}: HeaderProps) {
  return (
    <View as="div" padding="medium" borderWidth="none none small none">
      <Flex justifyItems="space-between" alignItems="center">
        <Heading level="h3">{I18n.t('Notebook')}</Heading>
        <CloseButton
          elementRef={el => {
            closeButtonRef.current = el
          }}
          onClick={onDismiss}
          size="small"
          screenReaderLabel={I18n.t('Close')}
          data-testid="notebook-close-button"
        />
      </Flex>
    </View>
  )
}

export function NotebookPanel({onDismiss, closeButtonRef}: Props) {
  const {
    api,
    objectId,
    objectType,
    courseId,
    selectedNoteId,
    selectNote,
    clearSelectedNote,
    closeTray,
  } = useNotebook()

  const handleDismiss = useCallback(() => {
    closeTray()
    onDismiss()
  }, [closeTray, onDismiss])

  // Mount-only: focus the close button unless there is a pre-selected note
  useEffect(() => {
    if (!selectedNoteId) {
      ;(closeButtonRef.current as HTMLElement | null)?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset platform-notebook's open-gate on unmount (ESC, overlay click).
  useEffect(() => {
    return () => closeTray()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {notes, pageInfo, isLoading, isError, currentPage, setPage} = useNotesData({
    api,
    courseId,
    learningObject: {type: objectType, id: objectId},
    pageSize: TRAY_PAGE_SIZE,
  })

  const {mutate: updateNote} = useUpdateNote(api)
  const {mutate: deleteNote} = useDeleteNote(api)

  const totalPages = pageInfo?.totalNrOfPages ?? undefined

  const onMutationError = useCallback(
    (error: Error) => showFlashAlert({message: error.message, type: 'error', err: error}),
    [],
  )

  const handleDelete = useCallback(
    (noteId: string) => {
      deleteNote(noteId, {onError: onMutationError})
    },
    [deleteNote, onMutationError],
  )

  const handleSave = useCallback(
    (noteId: string, text: string) => {
      const note = notes.find(n => n.id === noteId)
      if (!note) return
      updateNote(
        {
          id: noteId,
          input: {
            id: noteId,
            userText: text,
            reaction: note.reaction,
            highlightData: note.highlightData,
          },
        },
        {onError: onMutationError},
      )
    },
    [notes, updateNote, onMutationError],
  )

  const handleTypeChange = useCallback(
    (noteId: string, type: REACTION_TYPE) => {
      const note = notes.find(n => n.id === noteId)
      if (!note) return
      updateNote(
        {
          id: noteId,
          input: {
            id: noteId,
            userText: note.userText,
            reaction: [type],
            highlightData: note.highlightData,
          },
        },
        {onError: onMutationError},
      )
    },
    [notes, updateNote, onMutationError],
  )

  return (
    <div
      data-testid="notebook-panel"
      style={{
        width: 'min(25rem, 100vw)',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <NotebookPanelHeader onDismiss={handleDismiss} closeButtonRef={closeButtonRef} />
      <View as="div" padding="small">
        <NotesListView
          notes={notes}
          isLoading={isLoading}
          isError={isError}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedNoteId={selectedNoteId ?? undefined}
          onNoteSelect={id => (id === selectedNoteId ? clearSelectedNote() : selectNote(id))}
          onNoteDelete={handleDelete}
          onNoteSave={handleSave}
          onNoteTypeChange={handleTypeChange}
          columnCount={1}
          highlightTheme={HIGHLIGHT_THEME}
        />
      </View>
    </div>
  )
}

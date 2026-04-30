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

import React, {useCallback, useMemo} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {
  NotebookProvider,
  NotesListView,
  useNotebook,
  useNotesData,
  type NoteType,
} from '@instructure/platform-notebook'
import {
  CanvasNotebookApi,
  notebookTranslations,
  notebookTranslate,
  HIGHLIGHT_THEME,
} from '@canvas/notebook'
const DEFAULT_PAGE_SIZE = 20

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

function NotesGrid() {
  const {api, courseId} = useNotebook()
  const {notes, pageInfo, isLoading, isError, fetchNextPage, fetchPreviousPage} = useNotesData({
    api,
    courseId,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const noteHref = useCallback(
    (noteId: string, note: NoteType) =>
      `/courses/${note.courseId}/pages/${note.objectId}?noteId=${noteId}`,
    [],
  )

  const renderNoteLink = useCallback(
    ({
      href,
      children,
      ariaLabel,
    }: {
      href: string
      children: React.ReactNode
      ariaLabel?: string
    }) => (
      <a href={href} aria-label={ariaLabel}>
        {children}
      </a>
    ),
    [],
  )

  return (
    <NotesListView
      notes={notes}
      isLoading={isLoading}
      isError={isError}
      pageInfo={pageInfo}
      onPreviousPage={fetchPreviousPage}
      onNextPage={fetchNextPage}
      highlightTheme={HIGHLIGHT_THEME}
      noteHref={noteHref}
      columnCount={4}
      renderNoteLink={renderNoteLink}
    />
  )
}

export default function NotebookIndexPage() {
  const journeyUrl = window.ENV.JOURNEY_URL
  const api = useMemo(() => (journeyUrl ? new CanvasNotebookApi(journeyUrl) : null), [journeyUrl])

  if (!api) return null

  return (
    <QueryClientProvider client={queryClient}>
      <NotebookProvider
        api={api}
        currentUserId={window.ENV.current_user_id ?? ''}
        objectId=""
        objectType=""
        courseId={String(window.ENV.COURSE_ID ?? '')}
        translations={notebookTranslations}
        translate={notebookTranslate}
      >
        <NotesGrid />
      </NotebookProvider>
    </QueryClientProvider>
  )
}

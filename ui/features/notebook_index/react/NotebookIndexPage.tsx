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
  NotebookEmptyState,
  NotebookProvider,
  NotesListView,
  useNotebook,
  useNotesData,
  type NoteType,
} from '@instructure/platform-notebook'
import {Flex} from '@instructure/ui-flex'
import {View} from '@instructure/ui-view'
import {
  CanvasNotebookApi,
  notebookTranslations,
  notebookTranslate,
  HIGHLIGHT_THEME,
} from '@canvas/notebook'
import sanitizeUrl from '@canvas/util/sanitizeUrl'
import NotebookFilters from './NotebookFilters'
import {useNotesColumnCount} from '../hooks/useNotesColumnCount'

const DEFAULT_PAGE_SIZE = 24
const EMPTY_STATE_MAX_WIDTH = '35rem'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

function NotebookIndexBody() {
  const {api, courseId} = useNotebook()
  const columnCount = useNotesColumnCount()
  const {notes, pageInfo, isLoading, isError, filter, setFilter, currentPage, setPage} =
    useNotesData({
      api,
      courseId,
      pageSize: DEFAULT_PAGE_SIZE,
    })

  const noteHref = useCallback(
    (noteId: string, note: NoteType) =>
      `/courses/${note.courseId}/pages/${note.objectId}?note_id=${noteId}`,
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
      <a href={sanitizeUrl(href)} aria-label={ariaLabel}>
        {children}
      </a>
    ),
    [],
  )

  const isEmpty = !isLoading && !isError && notes.length === 0
  const totalCount = pageInfo?.totalCount ?? undefined
  const totalPages = pageInfo?.totalNrOfPages ?? undefined

  return (
    <>
      <NotebookFilters filter={filter} setFilter={setFilter} totalCount={totalCount} />
      {isEmpty ? (
        <Flex height="100%" alignItems="center" justifyItems="center">
          <Flex.Item shouldGrow={false}>
            <View as="div" maxWidth={EMPTY_STATE_MAX_WIDTH} padding="large">
              <NotebookEmptyState hasActiveFilter={filter != null} />
            </View>
          </Flex.Item>
        </Flex>
      ) : (
        <NotesListView
          notes={notes}
          isLoading={isLoading}
          isError={isError}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          highlightTheme={HIGHLIGHT_THEME}
          noteHref={noteHref}
          columnCount={columnCount}
          renderNoteLink={renderNoteLink}
        />
      )}
    </>
  )
}

export default function NotebookIndexPage() {
  const courseId = String(window.ENV.COURSE_ID ?? '')
  const api = useMemo(() => (courseId ? new CanvasNotebookApi(courseId) : null), [courseId])

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
        <NotebookIndexBody />
      </NotebookProvider>
    </QueryClientProvider>
  )
}

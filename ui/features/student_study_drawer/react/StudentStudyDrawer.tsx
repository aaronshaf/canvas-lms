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

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {DrawerLayout} from '@instructure/ui-drawer-layout'
import {View} from '@instructure/ui-view'
import {PlatformUiProvider} from '@instructure/platform-provider'
import {platformExecuteQuery} from '@canvas/graphql'
import doFetchApi, {FetchApiError} from '@canvas/do-fetch-api-effect'
import {showFlashError} from '@instructure/platform-alerts'
import {useScope as createI18nScope} from '@canvas/i18n'
import {showFlashAlert} from '@instructure/platform-alerts'
import {ContentWithNoteWrapper, NotebookProvider} from '@instructure/platform-notebook'
import type {AssistRequest, AssistResponse} from '@instructure/platform-study-assist'
import {
  CanvasNotebookApi,
  notebookTranslations,
  notebookTranslate,
  HIGHLIGHT_THEME,
  NotebookPanel,
} from '@canvas/notebook'
import {StudyAssistPanel} from '@canvas/study-assist'

const I18n = createI18nScope('student_study_drawer')

const STUDY_ASSIST_OPEN_EVENT = 'study-assist:open'
const NOTEBOOK_OPEN_EVENT = 'notebook:open'

type ActivePanel = 'study-assist' | 'notebook' | null

async function fetchAssistResponse(request: AssistRequest): Promise<AssistResponse> {
  const courseId = window.ENV.COURSE_ID ?? request.state?.courseID
  if (!courseId) throw new Error('COURSE_ID is not configured')
  try {
    const {json} = await doFetchApi<AssistResponse>({
      path: `/api/v1/courses/${courseId}/study_assist`,
      method: 'POST',
      body: request,
    })
    return json ?? {}
  } catch (err) {
    let message = I18n.t('Study tools are temporarily unavailable')
    if (err instanceof FetchApiError) {
      try {
        const body = await err.response.json()
        if (body?.error) message = body.error
      } catch {}
    }
    showFlashError(message)()
    return {error: message}
  }
}

type StudentStudyDrawerInnerProps = {
  pageContent: HTMLElement
  showStudyAssist: boolean
  showNotebook: boolean
  notebookApi: CanvasNotebookApi | null
}

function StudentStudyDrawerInner({
  pageContent,
  showStudyAssist,
  showNotebook,
  notebookApi,
}: StudentStudyDrawerInnerProps) {
  const initialNoteId = useMemo(() => {
    if (!showNotebook) return undefined
    return new URLSearchParams(window.location.search).get('note_id') ?? undefined
  }, [showNotebook])
  const [activePanel, setActivePanel] = useState<ActivePanel>(initialNoteId ? 'notebook' : null)
  const [containerReady, setContainerReady] = useState(false)
  const containerRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<Element | null>(null)

  const handleDismiss = useCallback(() => setActivePanel(null), [])
  const handleOpenNotebook = useCallback(() => setActivePanel('notebook'), [])

  const handleCreateError = useCallback(
    (error: Error) => showFlashAlert({message: error.message, type: 'error', err: error}),
    [],
  )

  const handleUpdateError = useCallback(
    (error: Error) =>
      showFlashAlert({
        message: I18n.t('Your note could not be updated after the page changed.'),
        type: 'error',
        err: error,
      }),
    [],
  )

  const handleDeleteError = useCallback(
    (error: Error) =>
      showFlashAlert({
        message: I18n.t('An outdated note could not be removed after the page changed.'),
        type: 'error',
        err: error,
      }),
    [],
  )

  const handleHostRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && pageContent && !el.contains(pageContent)) {
        el.appendChild(pageContent)
      }
    },
    [pageContent],
  )

  useEffect(() => {
    const handlers: Array<[string, () => void]> = []
    if (showStudyAssist) {
      handlers.push([STUDY_ASSIST_OPEN_EVENT, () => setActivePanel('study-assist')])
    }
    if (showNotebook) {
      handlers.push([NOTEBOOK_OPEN_EVENT, () => setActivePanel('notebook')])
    }
    handlers.forEach(([event, fn]) => window.addEventListener(event, fn))
    return () => {
      handlers.forEach(([event, fn]) => window.removeEventListener(event, fn))
    }
  }, [showStudyAssist, showNotebook])

  // DrawerLayout.Tray's built-in ESC handling only fires in overlay mode
  // (`shouldCloseOnEscape && shouldOverlayTray`); on wide viewports the tray
  // sits side-by-side and never honors ESC. Add our own listener.
  useEffect(() => {
    if (activePanel === null) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePanel(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activePanel])

  // Notebook owns its own mount focus.
  useEffect(() => {
    if (activePanel === null || activePanel === 'notebook') return
    ;(closeButtonRef.current as HTMLElement | null)?.focus()
  }, [activePanel])

  // wiki_page_show renders .show-content.user_content via a separate async
  // bundle. If that bundle hasn't run yet when this effect fires, observe the
  // DOM until the element appears.
  useEffect(() => {
    if (!showNotebook) return

    const trySetContainer = (): boolean => {
      const el = document.querySelector<HTMLElement>('.show-content.user_content')
      if (el) {
        containerRef.current = el
        setContainerReady(true)
        return true
      }
      return false
    }

    if (trySetContainer()) return

    const root = document.getElementById('content') ?? document.body
    const observer = new MutationObserver(() => {
      if (trySetContainer()) observer.disconnect()
    })
    observer.observe(root, {subtree: true, childList: true})

    const timeoutId = window.setTimeout(() => {
      observer.disconnect()
    }, 10_000)

    return () => {
      observer.disconnect()
      window.clearTimeout(timeoutId)
    }
  }, [showNotebook])

  const content = (
    <View as="div" display="block" height="100vh" data-testid="student-study-drawer-layout">
      <DrawerLayout minWidth="40rem">
        <DrawerLayout.Content label={I18n.t('Page content')}>
          <div ref={handleHostRef} />
        </DrawerLayout.Content>
        <DrawerLayout.Tray
          label={activePanel === 'notebook' ? I18n.t('Notebook') : I18n.t('IgniteAI Study Tools')}
          placement="end"
          open={activePanel !== null}
          onDismiss={handleDismiss}
          defaultFocusElement={() => closeButtonRef.current}
        >
          {activePanel === 'study-assist' && showStudyAssist && (
            <StudyAssistPanel
              onDismiss={handleDismiss}
              closeButtonRef={closeButtonRef}
              fetchAssistResponse={fetchAssistResponse}
            />
          )}
          {activePanel === 'notebook' && showNotebook && (
            <NotebookPanel onDismiss={handleDismiss} closeButtonRef={closeButtonRef} />
          )}
        </DrawerLayout.Tray>
      </DrawerLayout>
      {showNotebook && containerReady && (
        <ContentWithNoteWrapper
          containerRef={containerRef}
          highlightTheme={HIGHLIGHT_THEME}
          onCreateError={handleCreateError}
          onUpdateError={handleUpdateError}
          onDeleteError={handleDeleteError}
        />
      )}
    </View>
  )

  if (showNotebook && notebookApi) {
    return (
      <NotebookProvider
        api={notebookApi}
        currentUserId={window.ENV.current_user_id ?? ''}
        objectId={String(window.ENV.NOTEBOOK_OBJECT_ID ?? '')}
        objectType="WikiPage"
        courseId={String(window.ENV.COURSE_ID ?? '')}
        pageLastModifiedAt={window.ENV.WIKI_PAGE_UPDATED_AT}
        translations={notebookTranslations}
        translate={notebookTranslate}
        onOpen={handleOpenNotebook}
        initialNoteId={initialNoteId}
      >
        {content}
      </NotebookProvider>
    )
  }

  return content
}

type Props = {
  pageContent: HTMLElement
  showStudyAssist?: boolean
  showNotebook?: boolean
}

export default function StudentStudyDrawer({
  pageContent,
  showStudyAssist = !!window.ENV.FEATURES?.study_assist,
  showNotebook = !!window.ENV.FEATURES?.notebook,
}: Props) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  const notebookApi = useMemo(() => {
    const courseId = String(window.ENV.COURSE_ID ?? '')
    return courseId ? new CanvasNotebookApi(courseId) : null
  }, [])

  return (
    <PlatformUiProvider
      executeQuery={platformExecuteQuery}
      locale={window.ENV.LOCALE ?? 'en'}
      timezone={window.ENV.TIMEZONE ?? 'UTC'}
      currentUserId={window.ENV.current_user_id ?? undefined}
    >
      <QueryClientProvider client={queryClient}>
        <StudentStudyDrawerInner
          pageContent={pageContent}
          showStudyAssist={showStudyAssist}
          showNotebook={showNotebook && notebookApi !== null}
          notebookApi={notebookApi}
        />
      </QueryClientProvider>
    </PlatformUiProvider>
  )
}

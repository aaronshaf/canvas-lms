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
import {act, render, screen, waitFor} from '@testing-library/react'

vi.mock('@instructure/platform-provider', () => ({
  PlatformUiProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}))

vi.mock('@instructure/platform-study-assist', () => ({
  AssistProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
  AssistContent: () => <div data-testid="assist-content" />,
  AssistFlashCardsInteraction: () => <div />,
  useAssistContext: () => ({showBackButton: false, resetChat: vi.fn()}),
}))

vi.mock('@instructure/platform-notebook', () => ({
  NotebookProvider: vi.fn(({children}: {children: React.ReactNode}) => (
    <div data-testid="notebook-provider">{children}</div>
  )),
  ContentWithNoteWrapper: () => <div data-testid="content-with-note-wrapper" />,
  NotesListView: () => <div data-testid="notes-list-view" />,
  useNotebook: () => ({
    api: {},
    objectId: 'page-1',
    objectType: 'Page',
    courseId: '42',
    selectedNoteId: null,
    selectNote: vi.fn(),
    clearSelectedNote: vi.fn(),
  }),
  useGetNotes: () => ({data: {notes: [], pageInfo: {}}, isLoading: false, isError: false}),
  useUpdateNote: () => ({mutate: vi.fn()}),
  useDeleteNote: () => ({mutate: vi.fn()}),
  REACTION_TYPE: {IMPORTANT: 'Important', CONFUSING: 'Confusing'},
}))

vi.mock('@canvas/notebook', () => ({
  CanvasNotebookApi: vi.fn(function MockCanvasNotebookApi() {
    return {}
  }),
  notebookTranslations: {},
  notebookTranslate: vi.fn((key: string) => key),
  HIGHLIGHT_THEME: {},
  NotebookPanel: ({
    closeButtonRef,
  }: {
    onDismiss: () => void
    closeButtonRef: React.MutableRefObject<Element | null>
  }) => {
    React.useEffect(() => {
      ;(closeButtonRef.current as HTMLElement | null)?.focus()
    }, [closeButtonRef])
    return (
      <div data-testid="notebook-panel">
        <button
          data-testid="notebook-close-button"
          ref={el => {
            closeButtonRef.current = el
          }}
        />
      </div>
    )
  },
}))

vi.mock('@canvas/study-assist', () => ({
  StudyAssistPanel: ({
    closeButtonRef,
  }: {
    onDismiss: () => void
    closeButtonRef: React.MutableRefObject<Element | null>
    fetchAssistResponse: unknown
  }) => (
    <div data-testid="study-assist-panel">
      <button
        data-testid="study-assist-close-button"
        ref={el => {
          closeButtonRef.current = el
        }}
      />
    </div>
  ),
}))

vi.mock('@canvas/ai-information', () => ({
  default: ({triggerButton}: {triggerButton: React.ReactNode}) => <div>{triggerButton}</div>,
}))

vi.mock('@canvas/pendo/react/hooks/usePendoTracking', () => ({
  usePendoTracking: () => ({trackEvent: vi.fn()}),
}))

import StudentStudyDrawer from '../StudentStudyDrawer'
import {_resetPageContentWrapper} from '@canvas/page-content-wrapper'
import {NotebookProvider} from '@instructure/platform-notebook'

function makePageContent() {
  const el = document.createElement('section')
  el.setAttribute('data-testid', 'fake-page-content')
  document.body.appendChild(el)
  return el
}

describe('StudentStudyDrawer', () => {
  beforeEach(() => {
    vi.mocked(NotebookProvider).mockClear()
    window.ENV = {
      ...window.ENV,
      LOCALE: 'en',
      TIMEZONE: 'UTC',
      current_user_id: 'user-1',
      NOTEBOOK_OBJECT_ID: 1,
      WIKI_PAGE_UPDATED_AT: '2026-01-01T00:00:00Z',
      COURSE_ID: '42',
      STUDY_ASSIST_TOOLS: ['Summarize'],
      FEATURES: {study_assist: true, notebook: true},
    } as any
  })

  afterEach(() => {
    _resetPageContentWrapper()
    document.body.innerHTML = ''
  })

  it('appends pageContent to its host div on mount', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    const drawerLayout = screen.getByTestId('student-study-drawer-layout')
    expect(drawerLayout.contains(pageContent)).toBe(true)
  })

  it('opens the study-assist panel when the study-assist:open event fires', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })

    expect(screen.getByTestId('study-assist-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('notebook-panel')).not.toBeInTheDocument()
  })

  it('opens the notebook panel when the notebook:open event fires', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('notebook:open'))
    })

    expect(screen.getByTestId('notebook-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('study-assist-panel')).not.toBeInTheDocument()
  })

  it('opens the notebook panel when NotebookProvider calls onOpen', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    const {onOpen} = vi.mocked(NotebookProvider).mock.calls[0][0] as {onOpen?: () => void}
    act(() => {
      onOpen?.()
    })

    expect(screen.getByTestId('notebook-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('study-assist-panel')).not.toBeInTheDocument()
  })

  it('switches from study-assist to notebook when notebook:open fires after', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })
    expect(screen.getByTestId('study-assist-panel')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new CustomEvent('notebook:open'))
    })
    expect(screen.getByTestId('notebook-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('study-assist-panel')).not.toBeInTheDocument()
  })

  it('moves focus to the new panel close button when switching panels', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })
    expect(document.activeElement).toBe(screen.getByTestId('study-assist-close-button'))

    act(() => {
      window.dispatchEvent(new CustomEvent('notebook:open'))
    })
    expect(document.activeElement).toBe(screen.getByTestId('notebook-close-button'))
  })

  it('closes the active panel when Escape is pressed', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })
    expect(screen.getByTestId('study-assist-panel')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
    })
    expect(screen.queryByTestId('study-assist-panel')).not.toBeInTheDocument()
  })

  it('ignores study-assist:open when showStudyAssist is false', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={false} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })
    expect(screen.queryByTestId('study-assist-panel')).not.toBeInTheDocument()
  })

  it('ignores notebook:open when showNotebook is false', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={false} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('notebook:open'))
    })
    expect(screen.queryByTestId('notebook-panel')).not.toBeInTheDocument()
  })

  it('renders ContentWithNoteWrapper when wiki content container exists and showNotebook is true', () => {
    const pageContent = makePageContent()
    const contentEl = document.createElement('div')
    contentEl.className = 'show-content user_content'
    document.body.appendChild(contentEl)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    expect(screen.getByTestId('content-with-note-wrapper')).toBeInTheDocument()
  })

  it('does not render ContentWithNoteWrapper when showNotebook is false', () => {
    const pageContent = makePageContent()
    const contentEl = document.createElement('div')
    contentEl.className = 'show-content user_content'
    document.body.appendChild(contentEl)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={false} />,
    )

    expect(screen.queryByTestId('content-with-note-wrapper')).not.toBeInTheDocument()
  })

  it('renders ContentWithNoteWrapper when wiki content container is added after mount', async () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={false} showNotebook={true} />,
    )

    expect(screen.queryByTestId('content-with-note-wrapper')).not.toBeInTheDocument()

    const contentEl = document.createElement('div')
    contentEl.className = 'show-content user_content'
    document.body.appendChild(contentEl)

    await waitFor(() => {
      expect(screen.getByTestId('content-with-note-wrapper')).toBeInTheDocument()
    })
  })

  it('skips NotebookProvider when showNotebook is false', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={false} />,
    )

    expect(screen.queryByTestId('notebook-provider')).not.toBeInTheDocument()
  })

  it('mounts NotebookProvider when showNotebook is true', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={false} showNotebook={true} />,
    )

    expect(screen.getByTestId('notebook-provider')).toBeInTheDocument()
  })
})

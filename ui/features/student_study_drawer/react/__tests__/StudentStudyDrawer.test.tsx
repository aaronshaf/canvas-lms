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
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import StudentStudyDrawer from '../StudentStudyDrawer'
import {_resetPageContentWrapper} from '@canvas/page-content-wrapper'
import {ContentWithNoteWrapper, NotebookProvider} from '@instructure/platform-notebook'
import {showFlashAlert, showFlashError} from '@instructure/platform-alerts'
import * as a11yUtils from '@instructure/ui-a11y-utils'

let capturedOnOverlayTrayChange: ((overlay: boolean) => void) | undefined

vi.mock('@instructure/ui-drawer-layout', () => {
  const MockTray = ({open, children, label, contentRef, id}: any) => {
    if (!open) return null
    return (
      <div ref={contentRef} aria-label={label} id={id}>
        {children}
      </div>
    )
  }
  const MockContent = ({children, contentRef, label}: any) => (
    <div ref={contentRef} aria-label={label}>
      {children}
    </div>
  )
  const MockDrawerLayout = ({children, onOverlayTrayChange}: any) => {
    capturedOnOverlayTrayChange = onOverlayTrayChange
    return <>{children}</>
  }
  MockDrawerLayout.Content = MockContent
  MockDrawerLayout.Tray = MockTray
  return {DrawerLayout: MockDrawerLayout}
})

vi.mock('@instructure/ui-a11y-utils', () => ({
  scopeTab: vi.fn(),
}))

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

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
  ContentWithNoteWrapper: vi.fn(() => <div data-testid="content-with-note-wrapper" />),
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

let capturedFetchAssistResponse: ((req: unknown) => Promise<unknown>) | undefined

vi.mock('@canvas/study-assist', () => ({
  StudyAssistPanel: ({
    closeButtonRef,
    fetchAssistResponse,
  }: {
    onDismiss: () => void
    closeButtonRef: React.MutableRefObject<Element | null>
    fetchAssistResponse: (req: unknown) => Promise<unknown>
  }) => {
    capturedFetchAssistResponse = fetchAssistResponse
    return (
      <div data-testid="study-assist-panel">
        <button
          data-testid="study-assist-close-button"
          ref={el => {
            closeButtonRef.current = el
          }}
        />
      </div>
    )
  },
}))

vi.mock('@instructure/platform-alerts', () => ({
  showFlashError: vi.fn(() => vi.fn()),
  showFlashAlert: vi.fn(),
}))

vi.mock('@canvas/ai-information', () => ({
  default: ({triggerButton}: {triggerButton: React.ReactNode}) => <div>{triggerButton}</div>,
}))

vi.mock('@canvas/pendo/react/hooks/usePendoTracking', () => ({
  usePendoTracking: () => ({trackEvent: vi.fn()}),
}))

function makePageContent() {
  const el = document.createElement('section')
  el.setAttribute('data-testid', 'fake-page-content')
  document.body.appendChild(el)
  return el
}

describe('StudentStudyDrawer', () => {
  beforeEach(() => {
    vi.mocked(NotebookProvider).mockClear()
    capturedFetchAssistResponse = undefined
    vi.mocked(ContentWithNoteWrapper).mockClear()
    vi.mocked(showFlashAlert).mockClear()
    window.ENV = {
      ...window.ENV,
      LOCALE: 'en',
      TIMEZONE: 'UTC',
      current_user_id: 'user-1',
      NOTEBOOK_OBJECT_ID: 1,
      WIKI_PAGE_UPDATED_AT: '2026-01-01T00:00:00Z',
      COURSE_ID: '42',
      STUDY_ASSIST_TOOLS: [{kind: 'summarize'}],
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

  it('labels the tray region "IgniteAI Study Tools"', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })

    expect(screen.getByLabelText('IgniteAI Study Tools')).toBeInTheDocument()
  })

  it('labels the tray region "Notebook" when the notebook panel is open', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('notebook:open'))
    })

    expect(screen.getByLabelText('Notebook')).toBeInTheDocument()
    expect(screen.queryByLabelText('IgniteAI Study Tools')).not.toBeInTheDocument()
  })

  it('gives the open tray the id its triggers reference via aria-controls', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })

    expect(document.getElementById('student-study-drawer-tray')).toBeInTheDocument()
  })

  it('broadcasts the active panel so triggers can sync aria-expanded', () => {
    const pageContent = makePageContent()
    const handler = vi.fn()
    window.addEventListener('student-study-drawer:state', handler)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })

    const lastDetail = handler.mock.calls.at(-1)?.[0].detail
    expect(lastDetail).toEqual({activePanel: 'study-assist'})

    handler.mockClear()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
    })

    expect(handler.mock.calls.at(-1)?.[0].detail).toEqual({activePanel: null})
    window.removeEventListener('student-study-drawer:state', handler)
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

  it('returns focus to the study-assist trigger element after closing', () => {
    const pageContent = makePageContent()
    const triggerButton = document.createElement('button')
    document.body.appendChild(triggerButton)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      triggerButton.focus()
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })
    expect(screen.getByTestId('study-assist-panel')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
    })

    expect(screen.queryByTestId('study-assist-panel')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(triggerButton)
  })

  it('returns focus to the notebook trigger element after closing', () => {
    const pageContent = makePageContent()
    const triggerButton = document.createElement('button')
    document.body.appendChild(triggerButton)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      triggerButton.focus()
      window.dispatchEvent(new CustomEvent('notebook:open'))
    })
    expect(screen.getByTestId('notebook-panel')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
    })

    expect(screen.queryByTestId('notebook-panel')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(triggerButton)
  })

  it('returns focus to the last-active trigger when switching tools before closing', () => {
    const pageContent = makePageContent()
    const notebookTrigger = document.createElement('button')
    const studyAssistTrigger = document.createElement('button')
    document.body.appendChild(notebookTrigger)
    document.body.appendChild(studyAssistTrigger)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      notebookTrigger.focus()
      window.dispatchEvent(new CustomEvent('notebook:open'))
    })
    expect(screen.getByTestId('notebook-panel')).toBeInTheDocument()

    act(() => {
      studyAssistTrigger.focus()
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })
    expect(screen.getByTestId('study-assist-panel')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
    })

    expect(screen.queryByTestId('study-assist-panel')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(studyAssistTrigger)
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

  it('keeps drawer open when Escape is pressed while the AI info popover is open', () => {
    const pageContent = makePageContent()

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })
    expect(screen.getByTestId('study-assist-panel')).toBeInTheDocument()

    const aiInfoButton = document.createElement('button')
    aiInfoButton.setAttribute('data-testid', 'study-assist-ai-info-button')
    aiInfoButton.setAttribute('aria-expanded', 'true')
    document.body.appendChild(aiInfoButton)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
    })

    expect(screen.getByTestId('study-assist-panel')).toBeInTheDocument()
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

  it('shows a flash error when note creation fails', () => {
    const pageContent = makePageContent()
    const contentEl = document.createElement('div')
    contentEl.className = 'show-content user_content'
    document.body.appendChild(contentEl)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={false} showNotebook={true} />,
    )

    const {onCreateError} = vi.mocked(ContentWithNoteWrapper).mock.calls[0][0] as {
      onCreateError?: (error: Error) => void
    }

    act(() => {
      onCreateError?.(new Error('Note limit of 1000 per course reached'))
    })

    expect(showFlashAlert).toHaveBeenCalledWith({
      message: 'Note limit of 1000 per course reached',
      type: 'error',
      err: expect.any(Error),
    })
  })

  it('shows a friendly flash error when note update fails after page change', () => {
    const pageContent = makePageContent()
    const contentEl = document.createElement('div')
    contentEl.className = 'show-content user_content'
    document.body.appendChild(contentEl)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={false} showNotebook={true} />,
    )

    const {onUpdateError} = vi.mocked(ContentWithNoteWrapper).mock.calls[0][0] as {
      onUpdateError?: (error: Error) => void
    }

    act(() => {
      onUpdateError?.(new Error('500 Internal Server Error'))
    })

    expect(showFlashAlert).toHaveBeenCalledWith({
      message: 'Your note could not be updated after the page changed.',
      type: 'error',
      err: expect.any(Error),
    })
  })

  it('shows a friendly flash error when an outdated note cannot be deleted after page change', () => {
    const pageContent = makePageContent()
    const contentEl = document.createElement('div')
    contentEl.className = 'show-content user_content'
    document.body.appendChild(contentEl)

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={false} showNotebook={true} />,
    )

    const {onDeleteError} = vi.mocked(ContentWithNoteWrapper).mock.calls[0][0] as {
      onDeleteError?: (error: Error) => void
    }

    act(() => {
      onDeleteError?.(new Error('500 Internal Server Error'))
    })

    expect(showFlashAlert).toHaveBeenCalledWith({
      message: 'An outdated note could not be removed after the page changed.',
      type: 'error',
      err: expect.any(Error),
    })
  })

  describe('focus trap in overlay mode', () => {
    beforeEach(() => {
      capturedOnOverlayTrayChange = undefined
      vi.mocked(a11yUtils.scopeTab).mockClear()
    })

    it('traps Tab focus in the tray when overlay mode is active and panel is open', () => {
      const pageContent = makePageContent()

      render(
        <StudentStudyDrawer
          pageContent={pageContent}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )

      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
      })
      act(() => {
        capturedOnOverlayTrayChange?.(true)
      })

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}))
      })

      expect(a11yUtils.scopeTab).toHaveBeenCalled()
    })

    it('does not trap Tab when overlay mode is inactive', () => {
      const pageContent = makePageContent()

      render(
        <StudentStudyDrawer
          pageContent={pageContent}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )

      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
      })

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}))
      })

      expect(a11yUtils.scopeTab).not.toHaveBeenCalled()
    })

    it('does not trap Tab when panel is closed even in overlay mode', () => {
      const pageContent = makePageContent()

      render(
        <StudentStudyDrawer
          pageContent={pageContent}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )

      act(() => {
        capturedOnOverlayTrayChange?.(true)
      })

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}))
      })

      expect(a11yUtils.scopeTab).not.toHaveBeenCalled()
    })

    it('does not call scopeTab when focus is outside the tray in overlay mode', () => {
      const pageContent = makePageContent()

      render(
        <StudentStudyDrawer
          pageContent={pageContent}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )

      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
      })
      act(() => {
        capturedOnOverlayTrayChange?.(true)
      })

      // Move focus to an element outside the tray to prove the contains-guard fires
      const outsideButton = document.createElement('button')
      document.body.appendChild(outsideButton)
      outsideButton.focus()

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}))
      })

      expect(a11yUtils.scopeTab).not.toHaveBeenCalled()
      outsideButton.remove()
    })

    it('removes the focus trap when the panel is closed', () => {
      const pageContent = makePageContent()

      render(
        <StudentStudyDrawer
          pageContent={pageContent}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )

      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
        capturedOnOverlayTrayChange?.(true)
      })

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
      })

      vi.mocked(a11yUtils.scopeTab).mockClear()

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Tab', bubbles: true}))
      })

      expect(a11yUtils.scopeTab).not.toHaveBeenCalled()
    })

    it('sets inert on page content when overlay mode is active and panel is open', () => {
      const pageContent = makePageContent()

      render(
        <StudentStudyDrawer
          pageContent={pageContent}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )

      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
        capturedOnOverlayTrayChange?.(true)
      })

      const contentEl = document.querySelector('[aria-label="Page content"]')
      expect(contentEl).toHaveAttribute('inert')
    })

    it('removes inert from page content when the panel is closed', () => {
      const pageContent = makePageContent()

      render(
        <StudentStudyDrawer
          pageContent={pageContent}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )

      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
        capturedOnOverlayTrayChange?.(true)
      })

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}))
      })

      const contentEl = document.querySelector('[aria-label="Page content"]')
      expect(contentEl).not.toHaveAttribute('inert')
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

  it('opens the notebook panel on mount when ?note_id= is in the URL', () => {
    const pageContent = makePageContent()
    window.history.replaceState(null, '', '/courses/42/pages/p?note_id=note-abc')

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    expect(screen.getByTestId('notebook-panel')).toBeInTheDocument()
  })

  it('does not open the notebook panel when ?note_id= is absent', () => {
    const pageContent = makePageContent()
    window.history.replaceState(null, '', '/courses/42/pages/p')

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={true} />,
    )

    expect(screen.queryByTestId('notebook-panel')).not.toBeInTheDocument()
  })

  it('ignores ?note_id= when showNotebook is false', () => {
    const pageContent = makePageContent()
    window.history.replaceState(null, '', '/courses/42/pages/p?note_id=note-abc')

    render(
      <StudentStudyDrawer pageContent={pageContent} showStudyAssist={true} showNotebook={false} />,
    )

    expect(screen.queryByTestId('notebook-panel')).not.toBeInTheDocument()
  })

  it('shows a flash error with the backend message when the request fails', async () => {
    server.use(
      http.post(
        '*/api/v1/courses/42/study_assist',
        () =>
          new HttpResponse(JSON.stringify({error: 'Study tools are temporarily unavailable.'}), {
            status: 503,
            headers: {'Content-Type': 'application/json'},
          }),
      ),
    )

    render(
      <StudentStudyDrawer
        pageContent={makePageContent()}
        showStudyAssist={true}
        showNotebook={false}
      />,
    )
    act(() => {
      window.dispatchEvent(new CustomEvent('study-assist:open'))
    })

    const result = await capturedFetchAssistResponse!({
      prompt: 'Generate flashcards',
      state: {pageID: 'test-page', courseID: '42'},
    })
    expect(showFlashError).toHaveBeenCalledWith('Study tools are temporarily unavailable.')
    expect(result).toMatchObject({error: 'Study tools are temporarily unavailable.'})
  })

  describe('502 retry behavior', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('retries on 502 and returns questions when the retry succeeds', async () => {
      let callCount = 0
      server.use(
        http.post('*/api/v1/courses/42/study_assist', () => {
          callCount++
          if (callCount === 1) return new HttpResponse(null, {status: 502})
          return HttpResponse.json({questions: [{id: '1', question: 'What is 1+1?', answer: '2'}]})
        }),
      )

      render(
        <StudentStudyDrawer
          pageContent={makePageContent()}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )
      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
      })

      const resultPromise = capturedFetchAssistResponse!({
        prompt: 'Generate quiz',
        state: {pageID: 'test-page', courseID: '42'},
      })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(showFlashError).not.toHaveBeenCalled()
      expect(result).toMatchObject({questions: [{id: '1', question: 'What is 1+1?', answer: '2'}]})
    })

    it('falls back to a generic message when 502 persists after all retries', async () => {
      server.use(
        http.post('*/api/v1/courses/42/study_assist', () => new HttpResponse(null, {status: 502})),
      )

      render(
        <StudentStudyDrawer
          pageContent={makePageContent()}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )
      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
      })

      const resultPromise = capturedFetchAssistResponse!({
        prompt: 'Generate flashcards',
        state: {pageID: 'test-page', courseID: '42'},
      })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(showFlashError).toHaveBeenCalledWith('Study tools are temporarily unavailable')
      expect(result).toMatchObject({error: 'Study tools are temporarily unavailable'})
    })

    it('stops retrying and shows the backend error when a non-502 follows a 502', async () => {
      let callCount = 0
      server.use(
        http.post('*/api/v1/courses/42/study_assist', () => {
          callCount++
          if (callCount === 1) return new HttpResponse(null, {status: 502})
          return new HttpResponse(JSON.stringify({error: 'Service unavailable'}), {
            status: 503,
            headers: {'Content-Type': 'application/json'},
          })
        }),
      )

      render(
        <StudentStudyDrawer
          pageContent={makePageContent()}
          showStudyAssist={true}
          showNotebook={false}
        />,
      )
      act(() => {
        window.dispatchEvent(new CustomEvent('study-assist:open'))
      })

      const resultPromise = capturedFetchAssistResponse!({
        prompt: 'Generate quiz',
        state: {pageID: 'test-page', courseID: '42'},
      })
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(showFlashError).toHaveBeenCalledWith('Service unavailable')
      expect(result).toMatchObject({error: 'Service unavailable'})
      expect(callCount).toBe(2)
    })
  })
})

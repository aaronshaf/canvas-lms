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
import {StudyAssistPanel} from '../StudyAssistPanel'
import * as PendoModule from '@canvas/pendo'

const mockAssistContent = vi.fn((_props: object) => <div data-testid="assist-content" />)
const mockAssistFlashCardsInteraction = vi.fn((_props: object) => <div />)
const mockAssistProvider = vi.fn((_props: object) => null)
const mockAiInformation = vi.fn(({triggerButton}: {triggerButton: React.ReactNode}) => (
  <div data-testid="ai-information">{triggerButton}</div>
))
const mockResetChat = vi.fn()
const mockUseAssistContext = vi.fn(() => ({
  showBackButton: false,
  resetChat: mockResetChat,
  currentTool: null as 'summarize' | 'quiz' | 'flashcards' | null,
}))
const mockTrack = vi.fn()
const mockShowFlashAlert = vi.fn()

vi.mock('@canvas/ai-information', () => ({
  default: (props: object) => mockAiInformation(props as {triggerButton: React.ReactNode}),
}))

vi.mock('@instructure/platform-alerts', () => ({
  showFlashAlert: (props: object) => mockShowFlashAlert(props),
}))

vi.mock('@instructure/platform-study-assist', () => ({
  AssistProvider: ({
    children,
    pageId,
    fileId,
    featureSlug,
    translations,
    announceForScreenReader,
  }: {
    children: React.ReactNode
    pageId?: string
    fileId?: string
    featureSlug?: string
    translations?: Record<string, (key?: string, opts?: Record<string, unknown>) => string>
    announceForScreenReader?: (message: string) => void
  }) => {
    mockAssistProvider({translations, announceForScreenReader})
    return (
      <div
        data-testid="assist-provider"
        data-page-id={pageId}
        data-file-id={fileId}
        data-feature-slug={featureSlug}
      >
        {/* Mirror how the real package calls a bridge fn, so tests can assert
            the provider-boundary invocation (arg shape + localized output). */}
        <span data-testid="assist-provider-quiz-generated">
          {translations?.quizGenerated?.(undefined, {count: 5})}
        </span>
        {children}
      </div>
    )
  },
  AssistContent: (props: object) => mockAssistContent(props),
  AssistFlashCardsInteraction: (props: object) => mockAssistFlashCardsInteraction(props),
  useAssistContext: () => mockUseAssistContext(),
}))

describe('StudyAssistPanel', () => {
  const onDismiss = vi.fn()
  const fetchAssistResponse = vi.fn()
  const closeButtonRef = {current: null as Element | null}

  beforeEach(() => {
    window.ENV = {
      ...window.ENV,
      COURSE_ID: '123',
      WIKI_PAGE_ID: 'test-page',
      STUDY_ASSIST_TOOLS: [{kind: 'summarize'}, {kind: 'quiz'}, {kind: 'flashcards'}],
    } as any
    vi.spyOn(PendoModule, 'initializePendo').mockResolvedValue({track: mockTrack})
    onDismiss.mockReset()
    mockAssistContent.mockClear()
    mockAssistFlashCardsInteraction.mockClear()
    mockAssistProvider.mockClear()
    mockAiInformation.mockClear()
    mockTrack.mockClear()
    mockShowFlashAlert.mockClear()
    mockResetChat.mockReset()
    mockUseAssistContext.mockReturnValue({
      showBackButton: false,
      resetChat: mockResetChat,
      currentTool: null,
    })
    closeButtonRef.current = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes Global as regionsSupported to AI information', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(mockAiInformation).toHaveBeenCalledWith(
      expect.objectContaining({regionsSupported: 'Global'}),
    )
  })

  it('renders the AI information button', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(screen.getByTestId('study-assist-ai-info-button')).toBeInTheDocument()
  })

  it('renders the heading', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(screen.getByText('Study tools')).toBeInTheDocument()
  })

  it('orders the DOM as close button, study tools heading, AI info button, then body', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    const closeButton = screen.getByTestId('study-assist-close-button')
    const heading = screen.getByText('Study tools')
    const studyTools = screen.getByTestId('assist-content')
    const aiInfoButton = screen.getByTestId('study-assist-ai-info-button')

    expect(closeButton.compareDocumentPosition(heading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(heading.compareDocumentPosition(aiInfoButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(aiInfoButton.compareDocumentPosition(studyTools)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('keeps the AI info button before the study tools body even with no tools available', () => {
    window.ENV = {
      ...window.ENV,
      STUDY_ASSIST_TOOLS: [],
    } as any
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    const emptyState = screen.getByTestId('study-assist-no-tools')
    const aiInfoButton = screen.getByTestId('study-assist-ai-info-button')

    expect(aiInfoButton.compareDocumentPosition(emptyState)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('keeps the back button after the close button and before the AI info button', () => {
    mockUseAssistContext.mockReturnValue({
      showBackButton: true,
      resetChat: mockResetChat,
      currentTool: null,
    })
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    const closeButton = screen.getByTestId('study-assist-close-button')
    const backButton = screen.getByTestId('study-assist-back-button')
    const aiInfoButton = screen.getByTestId('study-assist-ai-info-button')

    expect(closeButton.compareDocumentPosition(backButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(backButton.compareDocumentPosition(aiInfoButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('exposes the IgniteAI logo to screen readers with an accessible name', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(screen.getByRole('img', {name: 'IgniteAI'})).toBeInTheDocument()
  })

  it('calls onDismiss when close button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    const closeEl = screen.getByTestId('study-assist-close-button')
    await user.click(closeEl.querySelector('button')!)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('passes WIKI_PAGE_ID as pageId to AssistProvider', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(screen.getByTestId('assist-provider')).toHaveAttribute('data-page-id', 'test-page')
  })

  it('passes featureSlug="canvas-lms:study-assist" to AssistProvider', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(screen.getByTestId('assist-provider')).toHaveAttribute(
      'data-feature-slug',
      'canvas-lms:study-assist',
    )
  })

  it('configures AssistContent for prompts-only mode with filtered prompts', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(mockAssistContent).toHaveBeenCalledWith(
      expect.objectContaining({
        showLargePrompts: true,
        allowedPrompts: [{kind: 'summarize'}, {kind: 'quiz'}, {kind: 'flashcards'}],
      }),
    )
  })

  it('passes only enabled tools from STUDY_ASSIST_TOOLS', () => {
    window.ENV = {
      ...window.ENV,
      STUDY_ASSIST_TOOLS: [{kind: 'summarize'}, {kind: 'flashcards'}],
    } as any
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(mockAssistContent).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedPrompts: [{kind: 'summarize'}, {kind: 'flashcards'}],
      }),
    )
  })

  it('shows empty state when no tools are enabled', () => {
    window.ENV = {
      ...window.ENV,
      STUDY_ASSIST_TOOLS: [],
    } as any
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(screen.getByTestId('study-assist-no-tools')).toBeInTheDocument()
    expect(screen.getByText('No study tools are currently available.')).toBeInTheDocument()
    expect(mockAssistContent).not.toHaveBeenCalled()
  })

  it('shows empty state when STUDY_ASSIST_TOOLS is undefined', () => {
    window.ENV = {
      ...window.ENV,
      STUDY_ASSIST_TOOLS: undefined,
    } as any
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    expect(screen.getByTestId('study-assist-no-tools')).toBeInTheDocument()
    expect(mockAssistContent).not.toHaveBeenCalled()
  })

  it('renderFlashCards renders AssistFlashCardsInteraction with cardHeight', () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    const {renderFlashCards} = mockAssistContent.mock.calls[0][0] as {
      renderFlashCards: (
        cards: object[],
        isFetching: boolean,
        isError: boolean,
        getFlashCards: () => void,
      ) => React.ReactNode
    }
    const mockCards = [{question: 'Q', answer: 'A'}]
    render(<>{renderFlashCards(mockCards, false, false, vi.fn())}</>)

    expect(mockAssistFlashCardsInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        cardData: mockCards,
        isFetching: false,
        isError: false,
        cardHeight: '60vh',
      }),
    )
  })

  it('renderFlashCards forwards onAnalyticsEvent so flashcard thumbs fire Pendo events', async () => {
    render(
      <StudyAssistPanel
        onDismiss={onDismiss}
        closeButtonRef={closeButtonRef}
        fetchAssistResponse={fetchAssistResponse}
      />,
    )
    const {renderFlashCards} = mockAssistContent.mock.calls[0][0] as {
      renderFlashCards: (
        cards: object[],
        isFetching: boolean,
        isError: boolean,
        getFlashCards: () => void,
      ) => React.ReactNode
    }
    render(<>{renderFlashCards([{question: 'Q', answer: 'A'}], false, false, vi.fn())}</>)

    const flashCardsProps = mockAssistFlashCardsInteraction.mock.calls[0][0] as {
      onAnalyticsEvent?: (event: string) => void
    }
    expect(typeof flashCardsProps.onAnalyticsEvent).toBe('function')

    flashCardsProps.onAnalyticsEvent?.('chat-good-response')
    await vi.waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith('study_assist_chat-good-response', {type: 'track'})
    })
  })

  describe('localization', () => {
    const renderPanel = () =>
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )

    const getTranslations = () =>
      (
        mockAssistProvider.mock.calls[0][0] as {
          translations: Record<string, (key?: string, opts?: Record<string, unknown>) => string>
        }
      ).translations

    it('passes a translations bridge to AssistProvider', () => {
      renderPanel()
      const translations = getTranslations()
      expect(typeof translations.correctAnswer).toBe('function')
      expect(translations.correctAnswer()).toBe('Correct answer')
    })

    it('interpolates the correct-answer label', () => {
      renderPanel()
      const {incorrectAnswer} = getTranslations()
      expect(incorrectAnswer(undefined, {correctLabel: 'B'})).toBe(
        'Incorrect answer. The correct answer is B',
      )
    })

    it('uses the singular form when the count is 1', () => {
      renderPanel()
      const {flashcardsGenerated} = getTranslations()
      expect(flashcardsGenerated(undefined, {count: 1})).toBe('1 flashcard generated')
    })

    it('uses the plural form with interpolated count when count is not 1', () => {
      renderPanel()
      const {flashcardsGenerated} = getTranslations()
      expect(flashcardsGenerated(undefined, {count: 3})).toBe('3 flashcards generated')
    })

    it('uses the plural form for a count of 0', () => {
      renderPanel()
      const {flashcardsGenerated} = getTranslations()
      expect(flashcardsGenerated(undefined, {count: 0})).toBe('0 flashcards generated')
    })

    it('splits flashcardsRegenerated on singular vs plural count', () => {
      renderPanel()
      const {flashcardsRegenerated} = getTranslations()
      expect(flashcardsRegenerated(undefined, {count: 1})).toBe('1 flashcard regenerated')
      expect(flashcardsRegenerated(undefined, {count: 2})).toBe('2 flashcards regenerated')
    })

    it('splits quizGenerated on singular vs plural count', () => {
      renderPanel()
      const {quizGenerated} = getTranslations()
      expect(quizGenerated(undefined, {count: 1})).toBe('Quiz generated with 1 question')
      expect(quizGenerated(undefined, {count: 5})).toBe('Quiz generated with 5 questions')
    })

    it('interpolates the flashcard position', () => {
      renderPanel()
      const {flashcardChanged} = getTranslations()
      expect(flashcardChanged(undefined, {current: 2, total: 5})).toBe('Card 2 of 5')
    })

    it('falls back to an empty label when correctLabel is missing', () => {
      renderPanel()
      const {incorrectAnswer} = getTranslations()
      // trailing space is intentional: the {{label}} interpolation resolves to ''
      expect(incorrectAnswer(undefined, {})).toMatch(/^Incorrect answer\. The correct answer is $/)
    })

    it('produces a localized string when the provider invokes a bridge fn', () => {
      renderPanel()
      expect(screen.getByTestId('assist-provider-quiz-generated')).toHaveTextContent(
        'Quiz generated with 5 questions',
      )
    })
  })

  describe('dynamic heading', () => {
    const renderPanel = () =>
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )

    it('shows the default heading when no tool is active', () => {
      renderPanel()
      expect(screen.getByText('Study tools')).toBeInTheDocument()
    })

    it.each([
      ['summarize', 'Summary'],
      ['quiz', 'Quiz Me'],
      ['flashcards', 'Flashcards'],
    ] as const)('shows %s heading when currentTool is %s', (tool, expected) => {
      mockUseAssistContext.mockReturnValue({
        showBackButton: false,
        resetChat: mockResetChat,
        currentTool: tool,
      })
      renderPanel()
      expect(screen.getByText(expected)).toBeInTheDocument()
    })
  })

  describe('screen reader announcements', () => {
    it('routes announcements through the Canvas flash SR region', () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      const {announceForScreenReader} = mockAssistProvider.mock.calls[0][0] as {
        announceForScreenReader: (message: string) => void
      }
      expect(typeof announceForScreenReader).toBe('function')
      announceForScreenReader('Card 1 of 3')
      expect(mockShowFlashAlert).toHaveBeenCalledWith({
        message: 'Card 1 of 3',
        srOnly: true,
        type: 'info',
      })
    })
  })

  describe('feedback', () => {
    it.each(['liked', 'disliked'] as const)(
      'tracks a %s chat feedback vote to Pendo via onFeedback',
      async vote => {
        render(
          <StudyAssistPanel
            onDismiss={onDismiss}
            closeButtonRef={closeButtonRef}
            fetchAssistResponse={fetchAssistResponse}
          />,
        )
        const {onFeedback} = mockAssistContent.mock.calls[0][0] as {
          onFeedback: (vote: 'liked' | 'disliked') => void
        }
        onFeedback(vote)
        await vi.waitFor(() => {
          expect(mockTrack).toHaveBeenCalledWith('study_assist_feedback', {
            type: 'track',
            vote,
          })
        })
      },
    )

    it('forwards the package onFeedback to flashcards so flashcard votes are captured', () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      const {renderFlashCards} = mockAssistContent.mock.calls[0][0] as {
        renderFlashCards: (
          cards: object[],
          isFetching: boolean,
          isError: boolean,
          getFlashCards: () => void,
          onFeedback?: (vote: 'liked' | 'disliked') => void,
        ) => React.ReactNode
      }
      const packageFeedback = vi.fn()
      render(
        <>
          {renderFlashCards([{question: 'Q', answer: 'A'}], false, false, vi.fn(), packageFeedback)}
        </>,
      )
      const flashCardsProps = mockAssistFlashCardsInteraction.mock.calls[0][0] as {
        onFeedback?: (vote: 'liked' | 'disliked') => void
      }
      expect(flashCardsProps.onFeedback).toBe(packageFeedback)
    })
  })

  describe('analytics events', () => {
    it('passes handleAnalyticsEvent to AssistContent', () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      const {onAnalyticsEvent} = mockAssistContent.mock.calls[0][0] as {
        onAnalyticsEvent: (event: string) => void
      }
      expect(typeof onAnalyticsEvent).toBe('function')
    })

    it('tracks thumbs up event with correct Pendo event name', async () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      const {onAnalyticsEvent} = mockAssistContent.mock.calls[0][0] as {
        onAnalyticsEvent: (event: string) => void
      }
      onAnalyticsEvent('chat-good-response')
      await vi.waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith('study_assist_chat-good-response', {type: 'track'})
      })
    })

    it('tracks thumbs down event with correct Pendo event name', async () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      const {onAnalyticsEvent} = mockAssistContent.mock.calls[0][0] as {
        onAnalyticsEvent: (event: string) => void
      }
      onAnalyticsEvent('chat-bad-response')
      await vi.waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith('study_assist_chat-bad-response', {type: 'track'})
      })
    })

    it('tracks prompt click events with correct Pendo event name', async () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      const {onAnalyticsEvent} = mockAssistContent.mock.calls[0][0] as {
        onAnalyticsEvent: (event: string) => void
      }
      onAnalyticsEvent('prompt-summarize')
      await vi.waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith('study_assist_prompt-summarize', {type: 'track'})
      })
    })

    it('tracks citation link click events with correct Pendo event name', async () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      const {onAnalyticsEvent} = mockAssistContent.mock.calls[0][0] as {
        onAnalyticsEvent: (event: string) => void
      }
      onAnalyticsEvent('citation-link-page')
      await vi.waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith('study_assist_citation-link-page', {type: 'track'})
      })
    })
  })

  describe('back button', () => {
    it('is not visible when showBackButton is false', () => {
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      expect(screen.queryByTestId('study-assist-back-button')).not.toBeInTheDocument()
    })

    it('is visible when showBackButton is true', () => {
      mockUseAssistContext.mockReturnValue({
        showBackButton: true,
        resetChat: mockResetChat,
        currentTool: null,
      })
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      expect(screen.getByTestId('study-assist-back-button')).toBeInTheDocument()
    })

    it('calls resetChat when clicked', async () => {
      const user = userEvent.setup()
      mockUseAssistContext.mockReturnValue({
        showBackButton: true,
        resetChat: mockResetChat,
        currentTool: null,
      })
      render(
        <StudyAssistPanel
          onDismiss={onDismiss}
          closeButtonRef={closeButtonRef}
          fetchAssistResponse={fetchAssistResponse}
        />,
      )
      await user.click(screen.getByTestId('study-assist-back-button'))
      expect(mockResetChat).toHaveBeenCalledTimes(1)
    })
  })
})

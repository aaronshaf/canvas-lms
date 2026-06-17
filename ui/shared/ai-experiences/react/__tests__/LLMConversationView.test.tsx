/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import '@instructure/canvas-theme'
import React from 'react'
import {act, render, screen, fireEvent, waitFor} from '@testing-library/react'
import {http, HttpResponse, delay} from 'msw'
import {setupServer} from 'msw/node'
import LLMConversationView from '../components/LLMConversationView'

const server = setupServer()

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  courseId: 123,
  aiExperienceId: '1',
  aiExperienceTitle: 'Test Experience',
  facts: 'Test facts',
  learningObjectives: ['Test objectives'],
  scenario: 'Test scenario',
}

describe('LLMConversationView', () => {
  beforeAll(() => {
    server.listen({onUnhandledRequest: 'error'})
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    // Mock scrollIntoView which is not available in JSDOM
    Element.prototype.scrollIntoView = vi.fn()
    // Mock focus which is used for accessibility
    Object.defineProperty(HTMLElement.prototype, 'focus', {configurable: true, value: vi.fn()})

    // Default mocks for most tests - can be overridden in individual tests
    server.use(
      // Mock get active conversation (returns empty - no active conversation)
      http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({})
      }),
      // Mock create new conversation
      http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({id: '1', messages: []})
      }),
    )
  })

  afterEach(async () => {
    vi.clearAllMocks()
    await act(async () => {})
    server.resetHandlers()
  })

  it('does not render when closed', () => {
    const {container} = render(<LLMConversationView {...defaultProps} isOpen={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders chat interface when open', () => {
    render(<LLMConversationView {...defaultProps} />)
    expect(screen.getByText(/Knowledge check/)).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('initializes conversation on mount', async () => {
    const mockMessages = [
      {role: 'User', text: 'Starting prompt', timestamp: new Date()},
      {role: 'Assistant', text: 'Hello! How can I help you?', timestamp: new Date()},
    ]

    // Override default mocks with custom messages
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({id: '1', messages: mockMessages})
      }),
    )

    render(<LLMConversationView {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getAllByText(/Hello!.*How can I help you\?/i)[0]).toBeInTheDocument()
    })
  })

  it('displays messages with correct roles', async () => {
    const mockMessages = [
      {role: 'User', text: 'Starting prompt', timestamp: new Date()},
      {role: 'Assistant', text: 'Hello!', timestamp: new Date()},
      {role: 'User', text: 'Hi there', timestamp: new Date()},
      {role: 'Assistant', text: 'How can I help?', timestamp: new Date()},
    ]

    // Override default mocks with custom messages
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({id: '1', messages: mockMessages})
      }),
    )

    render(<LLMConversationView {...defaultProps} />)

    await waitFor(() => {
      // First message is hidden (starting prompt)
      expect(screen.queryByText('Starting prompt')).not.toBeInTheDocument()
      // Others are visible
      expect(screen.getAllByText(/Hello!/i)[0]).toBeInTheDocument()
      expect(screen.getAllByText(/Hi there/i)[0]).toBeInTheDocument()
      expect(screen.getAllByText(/How can I help\?/i)[0]).toBeInTheDocument()
    })
  })

  it('renders text input and send button', () => {
    render(<LLMConversationView {...defaultProps} />)

    expect(screen.getByPlaceholderText('Your answer...')).toBeInTheDocument()
    expect(screen.getByText('Send')).toBeInTheDocument()
  })

  describe('user message length cap (M-8, mirrors llma AddMessageDto.text @MaxLength(4000))', () => {
    // Mirror of AiConversation::USER_MESSAGE_MAX_LENGTH. ENV.AI_EXPERIENCES_MESSAGE_MAX_LENGTH
    // isn't populated in vitest, so the component's fallback (4000) is exercised here.
    const MAX = 4_000

    it('does not render a length-validation error under the cap', () => {
      render(<LLMConversationView {...defaultProps} />)
      expect(
        screen.queryByText(`Message must be ${MAX.toLocaleString()} characters or fewer`),
      ).not.toBeInTheDocument()
    })

    it('shows a length-validation error when the message exceeds the cap', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]
      server.use(
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'a'.repeat(MAX + 1)}})

      await waitFor(() => {
        expect(
          screen.getByText(`Message must be ${MAX.toLocaleString()} characters or fewer`),
        ).toBeInTheDocument()
      })
    })

    it('disables the send button when the message exceeds the cap', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]
      server.use(
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'a'.repeat(MAX + 1)}})

      const sendButton = screen.getByTestId('llm-conversation-send-message-button')
      await waitFor(() => {
        expect(sendButton).toBeDisabled()
      })
    })

    it('does not POST when sending is attempted with an over-cap message', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]
      const postSpy = vi.fn(() => HttpResponse.json({id: '1', messages: []}))
      server.use(
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', postSpy),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'a'.repeat(MAX + 1)}})

      // Simulate Enter — bypasses the visual disabled state to confirm handleSendMessage
      // also gates the over-cap path.
      fireEvent.keyDown(input, {key: 'Enter'})

      // Give any in-flight handler a tick to (not) fire.
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      expect(postSpy).not.toHaveBeenCalled()
    })

    it('sends successfully when the message is exactly at the cap', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]
      const postSpy = vi.fn(() =>
        HttpResponse.json({
          id: '1',
          messages: [...initialMessages, {role: 'User', text: 'A', timestamp: new Date()}],
        }),
      )
      server.use(
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', postSpy),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'a'.repeat(MAX)}})

      const sendButton = screen.getByTestId('llm-conversation-send-message-button')
      expect(sendButton).not.toHaveAttribute('aria-disabled', 'true')

      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(postSpy).toHaveBeenCalled()
      })
    })
  })

  it('sends message when send button is clicked', async () => {
    const initialMessages = [
      {role: 'User', text: 'Start', timestamp: new Date()},
      {role: 'Assistant', text: 'Hello', timestamp: new Date()},
    ]

    // Override default mocks with custom messages
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({id: '1', messages: initialMessages})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', () => {
        return HttpResponse.json({
          id: '1',
          messages: [
            ...initialMessages,
            {role: 'User', text: 'Test message', timestamp: new Date()},
            {role: 'Assistant', text: 'Response', timestamp: new Date()},
          ],
        })
      }),
    )

    render(<LLMConversationView {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Your answer...')
    fireEvent.change(input, {target: {value: 'Test message'}})

    const sendButton = screen.getByText('Send')
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument()
      expect(screen.getByText('Response')).toBeInTheDocument()
    })
  })

  it('clears input after sending message', async () => {
    render(<LLMConversationView {...defaultProps} />)

    const input = screen.getByPlaceholderText('Your answer...') as HTMLTextAreaElement
    fireEvent.change(input, {target: {value: 'Test message'}})

    const sendButton = screen.getByText('Send')
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  // Note: Button disable behavior during async operations is tested in integration tests

  it('optimistically adds user message before API response', async () => {
    const initialMessages = [
      {role: 'User', text: 'Start', timestamp: new Date()},
      {role: 'Assistant', text: 'Hello', timestamp: new Date()},
    ]

    // Override default mocks with custom messages
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({id: '1', messages: initialMessages})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', async () => {
        await delay(100)
        return HttpResponse.json({
          id: '1',
          messages: [
            ...initialMessages,
            {role: 'User', text: 'New message', timestamp: new Date()},
          ],
        })
      }),
    )

    render(<LLMConversationView {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Your answer...')
    fireEvent.change(input, {target: {value: 'New message'}})

    const sendButton = screen.getByText('Send')
    fireEvent.click(sendButton)

    // Message should appear immediately (optimistic)
    expect(screen.getByText('New message')).toBeInTheDocument()
  })

  // Note: Optimistic message rollback on error is tested in integration tests

  it('restarts conversation when restart button is clicked', async () => {
    const mockMessages = [
      {role: 'User', text: 'Start', timestamp: new Date()},
      {role: 'Assistant', text: 'Hello', timestamp: new Date()},
    ]

    let localApiCallCount = 0

    // Override default mocks with custom messages
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        localApiCallCount++
        return HttpResponse.json({id: '1', messages: mockMessages})
      }),
    )

    render(<LLMConversationView {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
    })

    const restartButton = screen.getByText('Reset')
    fireEvent.click(restartButton)

    // Should re-initialize conversation
    await waitFor(() => {
      expect(localApiCallCount).toBeGreaterThan(1)
    })
  })

  it('does not display sender labels in messages', async () => {
    const mockMessages = [
      {role: 'User', text: 'Start', timestamp: new Date()},
      {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      {role: 'User', text: 'User message', timestamp: new Date()},
    ]

    // Override default mocks with custom messages
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({})
      }),
      http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
        return HttpResponse.json({id: '1', messages: mockMessages})
      }),
    )

    render(<LLMConversationView {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('User message')).toBeInTheDocument()
    })

    // Verify no sender labels are present
    expect(screen.queryByText('You')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument()
  })

  describe('accessibility features', () => {
    it('renders ARIA live region for screen reader announcements', () => {
      render(<LLMConversationView {...defaultProps} />)

      const liveRegion = document.querySelector('[aria-live="polite"]')
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('renders labeled messages container', () => {
      render(<LLMConversationView {...defaultProps} />)

      // role="log" was removed — it caused VoiceOver to anchor at the last
      // live-announced message, making earlier messages unreachable in FocusMode.
      // The container is identified by aria-label only.
      const messagesContainer = screen.getByLabelText('Conversation messages')
      expect(messagesContainer).toBeInTheDocument()
    })

    it('adds role="article" to messages', async () => {
      const mockMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
        {role: 'User', text: 'Test message', timestamp: new Date()},
      ]

      // Override default mocks with custom messages
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: mockMessages})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        const articles = document.querySelectorAll('[role="article"]')
        expect(articles.length).toBeGreaterThan(0)
      })
    })

    it('adds appropriate aria-labels to user and assistant messages', async () => {
      const mockMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Assistant response', timestamp: new Date()},
        {role: 'User', text: 'User message', timestamp: new Date()},
      ]

      // Override default mocks with custom messages
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: mockMessages})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByLabelText('Message from Assistant')).toBeInTheDocument()
        expect(screen.getAllByLabelText('Your message').length).toBeGreaterThan(0)
      })
    })

    it('announces "Initializing conversation..." when initializing', () => {
      // Override with delayed response
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', async () => {
          await delay(100)
          return HttpResponse.json({id: '1', messages: []})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      const liveRegion = document.querySelector('[aria-live="polite"]')
      expect(liveRegion?.textContent).toContain('Initializing conversation...')
    })

    it('announces "Assistant is thinking..." when loading', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]

      // Override default mocks with custom messages
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', async () => {
          await delay(100)
          return HttpResponse.json({
            id: '1',
            messages: [
              ...initialMessages,
              {role: 'User', text: 'Test', timestamp: new Date()},
              {role: 'Assistant', text: 'Response', timestamp: new Date()},
            ],
          })
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'Test'}})

      const sendButton = screen.getByText('Send')
      fireEvent.click(sendButton)

      // Check that the announcement is made
      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live="polite"]')
        expect(liveRegion?.textContent).toContain('Assistant is thinking...')
      })
    })
  })

  describe('error handling', () => {
    it('displays error alert when conversation initialization fails', async () => {
      // Override with error response
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json(
            {
              error: 'The AI service is temporarily unavailable.',
              code: 'evaluation_parse_failed',
              reference_id: 'ref-abc',
              retryable: true,
            },
            {status: 503},
          )
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      // Surfaces the localized, code-specific message (from the frontend map) plus
      // the support reference id + code — not the server's generic fallback.
      await waitFor(() => {
        expect(screen.getByText("The evaluation couldn't be completed.")).toBeInTheDocument()
      })
      expect(screen.getByTestId('ai-experience-error-reference')).toHaveTextContent('ref-abc')
      expect(screen.getByTestId('ai-experience-error-code')).toHaveTextContent(
        'evaluation_parse_failed',
      )
      // retryable error -> a Try again affordance is offered
      expect(screen.getByTestId('ai-experience-error-retry')).toBeInTheDocument()
    })

    it('displays error alert when sending message fails', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]

      // Override default mocks with custom messages
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', () => {
          return HttpResponse.json({error: 'Failed to send'}, {status: 503})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'Test message'}})

      const sendButton = screen.getByText('Send')
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to send')).toBeInTheDocument()
      })

      // Optimistically added message should be removed
      expect(screen.queryByText('Test message')).not.toBeInTheDocument()
    })

    it('displays error alert when restart fails', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]

      server.resetHandlers()
      server.use(
        // Return an existing conversation so no init POST is needed
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
        // Restart POST always fails
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({error: 'Failed to restart'}, {status: 503})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      const restartButton = screen.getByTestId('llm-conversation-restart-button')
      fireEvent.click(restartButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to restart')).toBeInTheDocument()
      })
    })

    it('allows dismissing error alerts', async () => {
      // Override with error response
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({error: 'Service unavailable'}, {status: 503})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Service unavailable')).toBeInTheDocument()
      })

      const closeButton = screen.getByText('Close').closest('button')
      fireEvent.click(closeButton!)

      await waitFor(() => {
        expect(screen.queryByText('Service unavailable')).not.toBeInTheDocument()
      })
    })

    it('clears error when retrying after failure', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]

      let shouldSucceed = false

      server.resetHandlers()
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          if (!shouldSucceed) {
            return HttpResponse.json({error: 'Failed'}, {status: 503})
          }
          return HttpResponse.json({
            id: '1',
            messages: initialMessages,
          })
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument()
      })

      shouldSucceed = true

      const restartButton = screen.getByText('Reset')
      fireEvent.click(restartButton)

      await waitFor(() => {
        expect(screen.queryByText('Failed')).not.toBeInTheDocument()
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })
    })
  })

  describe('input focus behavior', () => {
    it('focuses text input after AI response arrives', async () => {
      const mockMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]

      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: mockMessages})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', () => {
          return HttpResponse.json({
            id: '1',
            messages: [
              ...mockMessages,
              {role: 'User', text: 'Test', timestamp: new Date()},
              {role: 'Assistant', text: 'Response', timestamp: new Date()},
            ],
          })
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      vi.clearAllMocks()

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'Test'}})
      fireEvent.click(screen.getByText('Send'))

      await waitFor(() => {
        expect(screen.getByText('Response')).toBeInTheDocument()
      })

      expect(HTMLElement.prototype.focus).toHaveBeenCalled()
    })

    it('focuses text input after errors', async () => {
      const initialMessages = [
        {role: 'User', text: 'Start', timestamp: new Date()},
        {role: 'Assistant', text: 'Hello', timestamp: new Date()},
      ]

      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations', () => {
          return HttpResponse.json({id: '1', messages: initialMessages})
        }),
        http.post('/api/v1/courses/123/ai_experiences/1/conversations/1/messages', () => {
          return HttpResponse.json({error: 'Failed'}, {status: 503})
        }),
      )

      render(<LLMConversationView {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getAllByText(/Hello/i)[0]).toBeInTheDocument()
      })

      vi.clearAllMocks()

      const input = screen.getByPlaceholderText('Your answer...')
      fireEvent.change(input, {target: {value: 'Test'}})
      fireEvent.click(screen.getByText('Send'))

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument()
      })

      expect(HTMLElement.prototype.focus).toHaveBeenCalled()
    })
  })
})

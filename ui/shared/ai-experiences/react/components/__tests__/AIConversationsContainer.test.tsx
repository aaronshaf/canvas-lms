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

import '@instructure/canvas-theme'
import React from 'react'
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import AIConversationsContainer from '../AIConversationsContainer'
import type {AIExperience} from '../../../types'

const server = setupServer()

const mockAiExperience: AIExperience = {
  id: '1',
  title: 'Test Experience',
  description: 'Test description',
  course_id: '123',
  facts: 'Test facts',
  learning_objectives: ['Test objectives'],
  pedagogical_guidance: 'Test guidance',
  can_manage: true,
}

const mockConversations = [
  {
    id: 'conv1',
    user_id: 'student1',
    llm_conversation_id: 'llm1',
    workflow_state: 'active',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T01:00:00Z',
    has_conversation: true,
    student: {id: 'student1', name: 'Student One', avatar_url: 'https://example.com/avatar1.jpg'},
  },
  {
    id: 'conv2',
    user_id: 'student2',
    llm_conversation_id: 'llm2',
    workflow_state: 'active',
    created_at: '2025-01-02T00:00:00Z',
    updated_at: '2025-01-02T01:00:00Z',
    has_conversation: true,
    student: {id: 'student2', name: 'Student Two', avatar_url: 'https://example.com/avatar2.jpg'},
  },
  {
    id: null,
    user_id: 'student3',
    has_conversation: false,
    student: {id: 'student3', name: 'Student Three', avatar_url: 'https://example.com/avatar3.jpg'},
  },
]

const mockConversationDetail = {
  id: 'conv1',
  user_id: 'student1',
  llm_conversation_id: 'llm1',
  workflow_state: 'active',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T01:00:00Z',
  messages: [
    {role: 'User', text: 'Hello', timestamp: '2025-01-01T00:00:00Z'},
    {role: 'Assistant', text: 'Hi there!', timestamp: '2025-01-01T00:01:00Z'},
    {role: 'User', text: 'How are you?', timestamp: '2025-01-01T00:02:00Z'},
    {role: 'Assistant', text: 'I am doing well!', timestamp: '2025-01-01T00:03:00Z'},
  ],
  progress: {current: 2, total: 4, percentage: 50, objectives: []},
}

describe('AIConversationsContainer', () => {
  beforeAll(() => {
    server.listen({onUnhandledRequest: 'error'})
  })

  afterAll(() => {
    server.close()
  })

  const mockSnapshot = {
    total_objectives: 2,
    completed: 1,
    in_progress: 1,
    not_started: 1,
    evaluation_metrics: [],
  }

  beforeEach(() => {
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', () => {
        return HttpResponse.json({conversations: mockConversations, snapshot: mockSnapshot})
      }),
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations/conv1', () => {
        return HttpResponse.json(mockConversationDetail)
      }),
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
  })

  it('renders filter by student dropdown', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByLabelText('Filter by student')).toBeInTheDocument()
    })
  })

  it('renders OverallSnapshot when snapshot is returned by the API', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByTestId('overall-snapshot')).toBeInTheDocument()
    })
  })

  it('auto-selects first student with a conversation on load', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByText('Student One')).toBeInTheDocument()
    })
  })

  it('surfaces an error in the conversation panel when the detail fetch fails', async () => {
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations/conv1', () => {
        return HttpResponse.json(
          {
            error: 'Could not load this conversation.',
            code: 'internal_error',
            reference_id: 'ref-7',
          },
          {status: 503},
        )
      }),
    )
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByTestId('ai-experience-error')).toBeInTheDocument()
    })
    expect(screen.getByText('Could not load this conversation.')).toBeInTheDocument()
    expect(screen.getByTestId('ai-experience-error-reference')).toHaveTextContent('ref-7')
  })

  it('displays all students in dropdown including those without conversations', async () => {
    const user = userEvent.setup()
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

    // Wait for data to load so the select is no longer disabled (pointer-events: none)
    await waitFor(() => {
      expect(screen.getByLabelText('Filter by student')).not.toBeDisabled()
    })

    await user.click(screen.getByLabelText('Filter by student'))

    await waitFor(() => expect(screen.getByText('✓ Student One')).toBeInTheDocument())
    expect(screen.getByText('✓ Student Two')).toBeInTheDocument()
    expect(screen.getByText('Student Three (No conversation)')).toBeInTheDocument()
  })

  it('disables dropdown options for students without conversations', async () => {
    const user = userEvent.setup()
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

    // Wait for data to load so the select is no longer disabled (pointer-events: none)
    await waitFor(() => {
      expect(screen.getByLabelText('Filter by student')).not.toBeDisabled()
    })

    await user.click(screen.getByLabelText('Filter by student'))

    await waitFor(() => {
      expect(screen.getByText('Student Three (No conversation)')).toBeInTheDocument()
    })

    const studentThreeOption = screen
      .getByText('Student Three (No conversation)')
      .closest('span[role="option"]')
    expect(studentThreeOption).toHaveAttribute('aria-disabled', 'true')

    const studentOneOption = screen.getByText('✓ Student One').closest('span[role="option"]')
    expect(studentOneOption).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('shows student name heading when a student with a conversation is selected', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByTestId('ai-conversations-student-heading')).toBeInTheDocument()
    })
  })

  it('loads conversation messages into Knowledge check card', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => expect(screen.getByText('Hi there!')).toBeInTheDocument())
    expect(screen.getByText('I am doing well!')).toBeInTheDocument()
  })

  it('shows Knowledge check card header', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByText('Knowledge check')).toBeInTheDocument()
    })
  })

  it('renders Expand button inside the Knowledge check card', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByTestId('ai-conversations-expand-button')).toBeInTheDocument()
    })
  })

  it('shows in-progress pill when all_objectives_met is false', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByText('In progress')).toBeInTheDocument()
    })
  })

  it('shows completed pill when all_objectives_met is true', async () => {
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations/conv1', () => {
        return HttpResponse.json({...mockConversationDetail, all_objectives_met: true})
      }),
    )
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByText(/Completed/)).toBeInTheDocument()
    })
  })

  it('shows the talking points count pill', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => expect(screen.getByText('2/4 talking points')).toBeInTheDocument())
  })

  it('shows helpful message when navigating to a student without a conversation', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations/conv2', () => {
        return HttpResponse.json({
          ...mockConversationDetail,
          id: 'conv2',
          user_id: 'student2',
          messages: [],
          progress: null,
        })
      }),
    )

    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

    // Auto-selects Student One; click Next twice to reach Student Three (no conversation)
    await waitFor(() => {
      expect(screen.getByText('Student One')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-conversations-next-button'))
    await waitFor(() => {
      expect(screen.getByTestId('ai-conversations-student-heading')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-conversations-next-button'))
    await waitFor(() => {
      expect(
        screen.getByText('This student has not started a conversation yet'),
      ).toBeInTheDocument()
    })
  })

  it('shows empty state message when no student is selected', async () => {
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', () => {
        return HttpResponse.json({conversations: []})
      }),
    )

    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

    await waitFor(() => {
      expect(screen.getByText('Select a student to view their conversation')).toBeInTheDocument()
    })
  })

  it('disables dropdown while conversations are loading', () => {
    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return HttpResponse.json({conversations: mockConversations})
      }),
    )

    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

    expect(screen.getByLabelText('Filter by student')).toBeDisabled()
  })

  it('renders Previous and Next navigation buttons', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() =>
      expect(screen.getByTestId('ai-conversations-previous-button')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('ai-conversations-next-button')).toBeInTheDocument()
  })

  it('Previous button is disabled when first student is selected', async () => {
    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
    await waitFor(() => {
      expect(screen.getByText('Student One')).toBeInTheDocument()
    })
    const prevButton = screen.getByTestId('ai-conversations-previous-button')
    expect(prevButton).toHaveAttribute('disabled')
  })

  it('Next button navigates to next student', async () => {
    const user = userEvent.setup()

    server.use(
      http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations/conv2', () => {
        return HttpResponse.json({
          ...mockConversationDetail,
          id: 'conv2',
          user_id: 'student2',
          messages: [],
          progress: null,
        })
      }),
    )

    render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

    await waitFor(() => {
      expect(screen.getByText('Student One')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('ai-conversations-next-button'))

    await waitFor(() => {
      expect(screen.getByTestId('ai-conversations-student-heading')).toBeInTheDocument()
    })
  })

  describe('OverallSnapshot', () => {
    const mockSnapshot = {total_objectives: 3, completed: 6, in_progress: 4, not_started: 5}

    it('renders snapshot cards when response includes snapshot', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', () => {
          return HttpResponse.json({conversations: mockConversations, snapshot: mockSnapshot})
        }),
      )

      render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

      await waitFor(() => {
        expect(screen.getByTestId('overall-snapshot')).toBeInTheDocument()
      })
      expect(screen.getByTestId('snapshot-learning-targets')).toBeInTheDocument()
      expect(screen.getByTestId('snapshot-completed')).toBeInTheDocument()
      expect(screen.getByTestId('snapshot-in-progress')).toBeInTheDocument()
      expect(screen.getByTestId('snapshot-not-started')).toBeInTheDocument()
    })

    it('does not render snapshot when response excludes it', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', () => {
          return HttpResponse.json({conversations: mockConversations})
        }),
      )

      render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

      await waitFor(() => {
        expect(screen.getByLabelText('Filter by student')).not.toBeDisabled()
      })

      expect(screen.queryByTestId('overall-snapshot')).not.toBeInTheDocument()
    })

    it('shows loading spinner while conversations are loading', () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return HttpResponse.json({conversations: mockConversations, snapshot: mockSnapshot})
        }),
      )

      render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

      expect(screen.getByTestId('overall-snapshot-loading')).toBeInTheDocument()
    })
  })

  describe('pre-selection logic', () => {
    it('pre-selects first student with conversation when list loads', async () => {
      render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)
      await waitFor(() => {
        expect(screen.getByTestId('ai-conversations-student-heading')).toBeInTheDocument()
      })
    })

    it('pre-selects first student when none have conversations', async () => {
      const conversationsWithoutAny = [
        {
          id: null,
          user_id: 'student1',
          has_conversation: false,
          student: {id: 'student1', name: 'Student One'},
        },
        {
          id: null,
          user_id: 'student2',
          has_conversation: false,
          student: {id: 'student2', name: 'Student Two'},
        },
      ]

      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', () => {
          return HttpResponse.json({conversations: conversationsWithoutAny})
        }),
      )

      render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

      await waitFor(() => {
        expect(
          screen.getByText('This student has not started a conversation yet'),
        ).toBeInTheDocument()
      })
    })

    it('pre-selects student with conversation even if not first in list', async () => {
      const conversationsReordered = [
        {
          id: null,
          user_id: 'student3',
          has_conversation: false,
          student: {id: 'student3', name: 'Student Three'},
        },
        {
          id: 'conv2',
          user_id: 'student2',
          llm_conversation_id: 'llm2',
          workflow_state: 'active',
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T01:00:00Z',
          has_conversation: true,
          student: {id: 'student2', name: 'Student Two'},
        },
      ]

      server.use(
        http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations', () => {
          return HttpResponse.json({conversations: conversationsReordered})
        }),
        http.get('/api/v1/courses/123/ai_experiences/1/ai_conversations/conv2', () => {
          return HttpResponse.json({
            ...mockConversationDetail,
            id: 'conv2',
            user_id: 'student2',
            messages: [],
            progress: null,
          })
        }),
      )

      render(<AIConversationsContainer aiExperience={mockAiExperience} courseId="123" />)

      await waitFor(() => {
        expect(screen.getByTestId('ai-conversations-student-heading')).toBeInTheDocument()
      })
    })
  })
})

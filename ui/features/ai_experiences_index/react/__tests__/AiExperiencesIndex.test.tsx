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
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import fakeEnv from '@canvas/test-utils/fakeENV'
import AiExperiencesIndex from '../AiExperiencesIndex'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())

beforeEach(() => {
  vi.clearAllMocks()
  fakeEnv.setup({COURSE_ID: 123})
})

afterEach(() => {
  server.resetHandlers()
  fakeEnv.teardown()
})

const mockExperiences = [
  {
    id: 1,
    title: 'Customer Service Training',
    workflow_state: 'published',
    created_at: '2025-01-15T10:30:00Z',
    can_unpublish: true,
    context_ready: true,
  },
  {
    id: 2,
    title: 'Sales Pitch Practice',
    workflow_state: 'unpublished',
    created_at: '2025-01-16T14:20:00Z',
    can_unpublish: true,
    context_ready: true,
  },
]

const baseResponse = {
  experiences: mockExperiences,
  can_manage: true,
  total_students: 15,
  total_pages: 1,
  current_page: 1,
}

describe('AiExperiencesIndex', () => {
  describe('empty state', () => {
    it('shows teacher empty state when no experiences exist', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () =>
          HttpResponse.json({...baseResponse, experiences: [], total_pages: 0}),
        ),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() =>
        expect(screen.getByText('No Knowledge Chats created yet.')).toBeInTheDocument(),
      )
      expect(screen.getByText('Create new')).toBeInTheDocument()
    })
  })

  describe('subtitle text', () => {
    it('shows manager subtitle when can_manage is true', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () =>
          HttpResponse.json({...baseResponse, experiences: []}),
        ),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() =>
        expect(
          screen.getByText(
            "Evaluate your students' comprehension of a topic with a configurable LLM chat (learning language model).",
          ),
        ).toBeInTheDocument(),
      )
    })

    it('shows student subtitle when can_manage is false', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () =>
          HttpResponse.json({
            ...baseResponse,
            can_manage: false,
            experiences: [],
            total_students: null,
          }),
        ),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() =>
        expect(
          screen.getByText(
            'Check your understanding of a topic with an educator-configured Knowledge Chat.',
          ),
        ).toBeInTheDocument(),
      )
    })
  })

  describe('teacher view', () => {
    it('shows the Create new button when experiences exist', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () => HttpResponse.json(baseResponse)),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() => expect(screen.getByText('Customer Service Training')).toBeInTheDocument())
      expect(screen.getByTestId('ai-expriences-index-create-new-button')).toBeInTheDocument()
    })

    it('links experience titles to their show page', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () => HttpResponse.json(baseResponse)),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() => expect(screen.getByText('Customer Service Training')).toBeInTheDocument())
      expect(screen.getByText('Customer Service Training')).toHaveAttribute(
        'href',
        '/courses/123/ai_experiences/1',
      )
    })

    it('navigates to edit page when Edit is clicked from the options menu', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () => HttpResponse.json(baseResponse)),
      )
      const user = userEvent.setup()
      render(<AiExperiencesIndex />)

      await waitFor(() => expect(screen.getByText('Customer Service Training')).toBeInTheDocument())

      const originalLocation = window.location
      delete (window as any).location
      ;(window as any).location = {href: ''}

      await user.click(screen.getAllByTestId('ai-experience-menu')[0])
      await user.click(screen.getByText('Edit'))

      expect(window.location.href).toBe('/courses/123/ai_experiences/1/edit')
      ;(window as any).location = originalLocation
    })

    it('does not show a Test Conversation option in the options menu', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () => HttpResponse.json(baseResponse)),
      )
      const user = userEvent.setup()
      render(<AiExperiencesIndex />)

      await waitFor(() => expect(screen.getByText('Customer Service Training')).toBeInTheDocument())
      await user.click(screen.getAllByTestId('ai-experience-menu')[0])

      expect(screen.queryByText('Test Conversation')).not.toBeInTheDocument()
    })

    it('removes experience from list after delete is confirmed', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () => HttpResponse.json(baseResponse)),
        http.delete('/api/v1/courses/123/ai_experiences/:id', () =>
          HttpResponse.json({success: true}),
        ),
      )
      const user = userEvent.setup()
      render(<AiExperiencesIndex />)

      await waitFor(() => expect(screen.getByText('Customer Service Training')).toBeInTheDocument())
      await user.click(screen.getAllByTestId('ai-experience-menu')[0])
      await user.click(screen.getByText('Delete'))

      await waitFor(() =>
        expect(screen.getByTestId('ai-experience-index-delete-confirm-button')).toBeInTheDocument(),
      )
      await user.click(screen.getByTestId('ai-experience-index-delete-confirm-button'))

      await waitFor(() =>
        expect(screen.queryByText('Customer Service Training')).not.toBeInTheDocument(),
      )
    })

    it('lists both published and unpublished experiences', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () => HttpResponse.json(baseResponse)),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() => expect(screen.getByText('Customer Service Training')).toBeInTheDocument())
      expect(screen.getByText('Sales Pitch Practice')).toBeInTheDocument()
    })
  })

  describe('pagination', () => {
    it('renders pagination when total_pages is greater than 1', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () =>
          HttpResponse.json({...baseResponse, total_pages: 3, current_page: 1}),
        ),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() =>
        expect(screen.getByTestId('ai-experiences-pagination')).toBeInTheDocument(),
      )
    })

    it('does not render pagination when total_pages is 1', async () => {
      server.use(
        http.get('/api/v1/courses/123/ai_experiences', () =>
          HttpResponse.json({...baseResponse, total_pages: 1}),
        ),
      )

      render(<AiExperiencesIndex />)

      await waitFor(() => expect(screen.getByText('Customer Service Training')).toBeInTheDocument())
      expect(screen.queryByTestId('ai-experiences-pagination')).not.toBeInTheDocument()
    })

    it('fetches the next page when a page number is clicked', async () => {
      const requests: string[] = []

      server.use(
        http.get('/api/v1/courses/123/ai_experiences', ({request}) => {
          requests.push(new URL(request.url).search)
          return HttpResponse.json({...baseResponse, total_pages: 2, current_page: 1})
        }),
      )

      const user = userEvent.setup({pointerEventsCheck: 0})
      render(<AiExperiencesIndex />)

      await waitFor(() =>
        expect(screen.getByTestId('ai-experiences-pagination')).toBeInTheDocument(),
      )

      await user.click(screen.getByText('2'))

      await waitFor(() => expect(requests.length).toBeGreaterThan(1))
      expect(requests.at(-1)).toContain('page=2')
    })
  })
})

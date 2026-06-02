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

import React from 'react'
import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {setupServer} from 'msw/node'
import TodoListWidget from '../TodoListWidget'
import type {BaseWidgetProps, Widget} from '../../../../types'
import {
  plannerItemsHandlers,
  plannerNoteHandlers,
  emptyPlannerItemsHandler,
  widgetConfigHandlers,
} from './mocks/handlers'
import {WidgetLayoutProvider} from '../../../../hooks/useWidgetLayout'
import {WidgetDashboardEditProvider} from '../../../../hooks/useWidgetDashboardEdit'
import {WidgetDashboardProvider} from '../../../../hooks/useWidgetDashboardContext'
import {clearWidgetDashboardCache, PlatformTestWrapper} from '../../../../__tests__/testHelpers'
import fakeENV from '@canvas/test-utils/fakeENV'

const mockWidget: Widget = {
  id: 'todo-list-widget',
  type: 'todo_list',
  position: {col: 1, row: 1, relative: 1},
  title: 'To-do list',
}

const buildDefaultProps = (overrides: Partial<BaseWidgetProps> = {}): BaseWidgetProps => {
  return {
    widget: mockWidget,
    ...overrides,
  }
}

const server = setupServer(...plannerItemsHandlers, ...plannerNoteHandlers, ...widgetConfigHandlers)

const mockSharedCourseData = [
  {
    courseId: '1',
    courseCode: 'TC1',
    courseName: 'Test Course 1',
    currentGrade: null,
    gradingScheme: 'percentage' as const,
    lastUpdated: new Date().toISOString(),
  },
  {
    courseId: '2',
    courseCode: 'TC2',
    courseName: 'Test Course 2',
    currentGrade: null,
    gradingScheme: 'percentage' as const,
    lastUpdated: new Date().toISOString(),
  },
]

beforeAll(() => {
  server.listen()
})
beforeEach(() => {
  fakeENV.setup({
    LOCALE: 'en',
    TIMEZONE: 'America/Denver',
  })
  clearWidgetDashboardCache()
})
afterEach(() => {
  server.resetHandlers()
  fakeENV.teardown()
})
afterAll(() => server.close())

const renderWithClient = (
  ui: React.ReactElement,
  {observedUserId = null}: {observedUserId?: string | null} = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return render(
    <PlatformTestWrapper>
      <QueryClientProvider client={queryClient}>
        <WidgetDashboardProvider
          sharedCourseData={mockSharedCourseData}
          observedUserId={observedUserId}
        >
          <WidgetDashboardEditProvider>
            <WidgetLayoutProvider>{ui}</WidgetLayoutProvider>
          </WidgetDashboardEditProvider>
        </WidgetDashboardProvider>
      </QueryClientProvider>
    </PlatformTestWrapper>,
  )
}

describe('TodoListWidget', () => {
  describe('successful data fetch', () => {
    it('renders loading state initially', () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)
      expect(screen.getByText('Loading to-do items...')).toBeInTheDocument()
    })

    it('displays items after successful fetch', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await screen.findByText('Lab Report: Cell Structure')
      expect(screen.getByText('Chapter 5 Quiz')).toBeInTheDocument()
    })

    it('shows correct widget title', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await waitFor(() => {
        expect(screen.queryByText('Loading to-do items...')).not.toBeInTheDocument()
      })

      expect(screen.getByText('To-do list')).toBeInTheDocument()
    })

    it('renders "+ New To-do" button as enabled', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await waitFor(() => {
        expect(screen.queryByText('Loading to-do items...')).not.toBeInTheDocument()
      })

      const newButton = screen.getByTestId('new-todo-button')
      expect(newButton).toBeEnabled()
      expect(newButton).toHaveTextContent('+ New To-do')
    })
  })

  describe('different item types', () => {
    it('renders assignment item', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Lab Report: Cell Structure')).toBeInTheDocument()
      })

      expect(screen.getByText('Assignment')).toBeInTheDocument()
    })

    it('renders quiz item', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Chapter 5 Quiz')).toBeInTheDocument()
      })

      expect(screen.getByText('Quiz')).toBeInTheDocument()
    })

    it('renders discussion topic item', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Discuss: Shakespeare Analysis')).toBeInTheDocument()
      })

      expect(screen.getByText('Discussion')).toBeInTheDocument()
    })

    it('renders announcement item', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Important: Exam Schedule')).toBeInTheDocument()
      })

      expect(screen.getByText('Announcement')).toBeInTheDocument()
    })

    it('renders wiki page item', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      await waitFor(() => {
        expect(screen.getByText('Read: World War II Overview')).toBeInTheDocument()
      })

      expect(screen.getByText('Page')).toBeInTheDocument()
    })
  })

  describe('observer mode', () => {
    it('passes observed_user_id to planner API when observing a student', async () => {
      const observedUserId = 'student-123'
      let capturedUrl: string | null = null

      server.use(
        http.get('/api/v1/planner/items', ({request}) => {
          capturedUrl = request.url
          return HttpResponse.json([], {
            headers: {Link: '</api/v1/planner/items?per_page=5>; rel="first"'},
          })
        }),
      )

      renderWithClient(<TodoListWidget {...buildDefaultProps()} />, {observedUserId})

      await waitFor(() => {
        expect(screen.queryByText('Loading to-do items...')).not.toBeInTheDocument()
      })

      expect(capturedUrl).not.toBeNull()
      const url = new URL(capturedUrl!)
      expect(url.searchParams.get('observed_user_id')).toBe(observedUserId)
      expect(url.searchParams.getAll('include[]')).toContain('all_courses')
    })

    it('hides the New To-do button when observing a student', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />, {observedUserId: 'student-123'})

      await waitFor(() => {
        expect(screen.queryByText('Loading to-do items...')).not.toBeInTheDocument()
      })

      expect(screen.queryByTestId('new-todo-button')).not.toBeInTheDocument()
    })

    it('disables the complete checkbox when observing a student', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />, {observedUserId: 'student-123'})

      const checkbox = await screen.findByTestId('todo-checkbox-1')
      expect(checkbox).toBeDisabled()
    })
  })

  describe('checkboxes', () => {
    it('renders checkboxes as enabled', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      const checkbox = await screen.findByTestId('todo-checkbox-1')
      expect(checkbox).toBeEnabled()
    })
  })

  describe('accessibility', () => {
    it('renders each todo item with role=group for screen readers', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      const todoItem = await screen.findByTestId('todo-item-1')
      expect(todoItem).toHaveAttribute('role', 'group')
    })

    it('provides accessible labels for each todo item group', async () => {
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      const labReportGroup = await screen.findByTestId('todo-item-1')
      expect(labReportGroup).toHaveAttribute('aria-label', 'Lab Report: Cell Structure')

      const quizGroup = await screen.findByTestId('todo-item-2')
      expect(quizGroup).toHaveAttribute('aria-label', 'Chapter 5 Quiz')
    })
  })

  describe('empty state across filters', () => {
    it('shows empty state for all todo filter options when no items exist', async () => {
      global.event = undefined // workaround bug in SimpleSelect that accesses the global event
      server.use(emptyPlannerItemsHandler)
      const user = userEvent.setup()
      renderWithClient(<TodoListWidget {...buildDefaultProps()} />)

      // Default (Incomplete) filter: empty state is shown
      await screen.findByTestId('no-todos-message')
      expect(screen.getByText('No upcoming items')).toBeInTheDocument()
      expect(screen.getByTestId('todo-filter-select')).toHaveValue('Incomplete')

      // Switch to Complete: empty state remains shown
      const filterSelect = screen.getByTestId('todo-filter-select')
      await user.click(filterSelect)
      await user.click(await screen.findByText('Complete'))

      await waitFor(() => {
        expect(screen.getByTestId('todo-filter-select')).toHaveValue('Complete')
      })
      expect(screen.getByTestId('no-todos-message')).toBeInTheDocument()
      expect(screen.getByText('No upcoming items')).toBeInTheDocument()

      // Switch to All: empty state remains shown
      await user.click(screen.getByTestId('todo-filter-select'))
      await user.click(await screen.findByText('All'))

      await waitFor(() => {
        expect(screen.getByTestId('todo-filter-select')).toHaveValue('All')
      })
      expect(screen.getByTestId('no-todos-message')).toBeInTheDocument()
      expect(screen.getByText('No upcoming items')).toBeInTheDocument()
    })
  })
})

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
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {vi} from 'vitest'

vi.mock('../hooks/usePlannerItems', () => ({
  PLANNER_ITEMS_QUERY_KEY: 'planner-items',
}))
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import TodoItem from '../TodoItem'
import {mockPlannerItems} from './mocks/data'
import {WidgetDashboardProvider} from '../../../../hooks/useWidgetDashboardContext'
import {WidgetThemeProvider} from '../../../../theme/WidgetThemeContext'

const mockSharedCourseData = [
  {
    courseId: '1',
    courseCode: 'BIO101',
    courseName: 'Biology 101',
    currentGrade: 85,
    gradingScheme: 'percentage' as const,
    lastUpdated: '2025-01-15T00:00:00Z',
  },
]

const mockPreferences = {
  dashboard_view: 'cards',
  hide_dashcard_color_overlays: false,
  custom_colors: {},
}

const renderWithProvider = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WidgetDashboardProvider
        sharedCourseData={mockSharedCourseData}
        preferences={mockPreferences}
      >
        {ui}
      </WidgetDashboardProvider>
    </QueryClientProvider>,
  )
}

const renderWithDarkTheme = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WidgetDashboardProvider
        sharedCourseData={mockSharedCourseData}
        preferences={mockPreferences}
      >
        <WidgetThemeProvider isDark={true} setIsDark={() => {}}>
          {ui}
        </WidgetThemeProvider>
      </WidgetDashboardProvider>
    </QueryClientProvider>,
  )
}

describe('TodoItem', () => {
  it('renders item title as link', () => {
    const item = mockPlannerItems[0]
    renderWithProvider(<TodoItem item={item} />)

    const link = screen.getByTestId(`todo-link-${item.plannable_id}`)
    expect(link).toHaveTextContent('Lab Report: Cell Structure')
    expect(link).toHaveAttribute('href', '/courses/1/assignments/1')
  })

  it('renders enabled checkbox button', () => {
    const item = mockPlannerItems[0]
    renderWithProvider(<TodoItem item={item} />)

    const button = screen.getByTestId(`todo-checkbox-${item.plannable_id}`)
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('displays course link when available', () => {
    const item = mockPlannerItems[0]
    renderWithProvider(<TodoItem item={item} />)

    expect(screen.getByText('Biology 101')).toBeInTheDocument()
  })

  it('displays points possible when available', () => {
    const item = mockPlannerItems[0]
    renderWithProvider(<TodoItem item={item} />)

    expect(screen.getByText(/100 points/)).toBeInTheDocument()
  })

  it('does not display points for items without points_possible', () => {
    const item = mockPlannerItems[3]
    renderWithProvider(<TodoItem item={item} />)

    expect(screen.queryByText('points')).not.toBeInTheDocument()
  })

  it('displays item type label', () => {
    const assignmentItem = mockPlannerItems[0]
    renderWithProvider(<TodoItem item={assignmentItem} />)

    expect(screen.getByText('Assignment')).toBeInTheDocument()
  })

  it('displays course link when course_id is present', () => {
    const item = mockPlannerItems[0]
    renderWithProvider(<TodoItem item={item} />)

    expect(screen.getByText('Biology 101')).toBeInTheDocument()
  })

  it('displays description when available', () => {
    const itemWithDetails = {
      ...mockPlannerItems[0],
      plannable: {
        ...mockPlannerItems[0].plannable,
        details: 'This is a test description',
      },
    }
    renderWithProvider(<TodoItem item={itemWithDetails} />)

    expect(screen.getByText('This is a test description')).toBeInTheDocument()
  })

  it('does not display description when not available', () => {
    const itemWithoutDetails = {
      ...mockPlannerItems[0],
      plannable: {
        ...mockPlannerItems[0].plannable,
        details: undefined,
      },
    }
    renderWithProvider(<TodoItem item={itemWithoutDetails} />)

    expect(screen.queryByText(/description/i)).not.toBeInTheDocument()
  })

  it('displays course name link when course_id is present', () => {
    const item = mockPlannerItems[0]
    renderWithProvider(<TodoItem item={item} />)

    const courseLink = screen.getByTestId(`todo-item-course-link-${item.plannable_id}`)
    expect(courseLink).toBeInTheDocument()
    expect(courseLink).toHaveAttribute('href', '/courses/1')
    expect(courseLink).toHaveTextContent('Biology 101')
  })

  it('does not display course name link when course_id is not present', () => {
    const itemWithoutCourse = {
      ...mockPlannerItems[0],
      course_id: undefined,
      context_name: undefined,
    }
    renderWithProvider(<TodoItem item={itemWithoutCourse} />)

    expect(
      screen.queryByTestId(`todo-item-course-link-${mockPlannerItems[0].plannable_id}`),
    ).not.toBeInTheDocument()
  })

  describe('mark as done button', () => {
    it('shows "Mark as done" text when item is not complete', () => {
      const item = mockPlannerItems[0]
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Mark as done')).toBeInTheDocument()
    })

    it('shows "Done" text when item is marked complete', () => {
      const completedItem = {
        ...mockPlannerItems[0],
        planner_override: {
          id: 1,
          plannable_type: 'assignment',
          plannable_id: '1',
          user_id: 1,
          workflow_state: 'active',
          marked_complete: true,
          dismissed: false,
          deleted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      }
      renderWithProvider(<TodoItem item={completedItem} />)

      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    it('button is disabled when readOnly is true', () => {
      const item = mockPlannerItems[0]
      renderWithProvider(<TodoItem item={item} readOnly={true} />)

      const button = screen.getByTestId(`todo-checkbox-${item.plannable_id}`)
      expect(button).toBeDisabled()
    })

    it('button appears after item content in the DOM', () => {
      const item = mockPlannerItems[0]
      renderWithProvider(<TodoItem item={item} />)

      const title = screen.getByTestId(`todo-link-${item.plannable_id}`)
      const button = screen.getByTestId(`todo-checkbox-${item.plannable_id}`)

      expect(title.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })

  describe('dark mode', () => {
    it('renders "Mark as done" button correctly in dark mode', () => {
      const item = mockPlannerItems[0]
      renderWithDarkTheme(<TodoItem item={item} />)

      expect(screen.getByText('Mark as done')).toBeInTheDocument()
      expect(screen.getByTestId(`todo-checkbox-${item.plannable_id}`)).toBeEnabled()
    })

    it('renders "Done" button correctly in dark mode when complete', () => {
      const completedItem = {
        ...mockPlannerItems[0],
        planner_override: {
          id: 1,
          plannable_type: 'assignment',
          plannable_id: '1',
          user_id: 1,
          workflow_state: 'active',
          marked_complete: true,
          dismissed: false,
          deleted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      }
      renderWithDarkTheme(<TodoItem item={completedItem} />)

      expect(screen.getByText('Done')).toBeInTheDocument()
    })
  })

  describe('checkbox display', () => {
    it('shows unchecked icon when item is not marked complete', () => {
      const item = mockPlannerItems[0]
      renderWithProvider(<TodoItem item={item} />)

      const button = screen.getByTestId(`todo-checkbox-${item.plannable_id}`)
      expect(button).toBeInTheDocument()
      expect(button.querySelector('svg')).toBeInTheDocument()
    })

    it('shows checked icon when item is marked complete', () => {
      const completedItem = {
        ...mockPlannerItems[0],
        planner_override: {
          id: 1,
          plannable_type: 'assignment',
          plannable_id: '1',
          user_id: 1,
          workflow_state: 'active',
          marked_complete: true,
          dismissed: false,
          deleted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      }
      renderWithProvider(<TodoItem item={completedItem} />)

      const button = screen.getByTestId(`todo-checkbox-${completedItem.plannable_id}`)
      expect(button).toBeInTheDocument()
    })

    it('applies secondary text color to completed items', () => {
      const completedItem = {
        ...mockPlannerItems[0],
        planner_override: {
          id: 1,
          plannable_type: 'assignment',
          plannable_id: '1',
          user_id: 1,
          workflow_state: 'active',
          marked_complete: true,
          dismissed: false,
          deleted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      }
      renderWithProvider(<TodoItem item={completedItem} />)

      const link = screen.getByTestId(`todo-link-${completedItem.plannable_id}`)
      const titleText = link.querySelector('span')
      expect(titleText).toHaveAttribute('color', 'secondary')
    })

    it('updates screen reader label based on completion state', () => {
      const item = mockPlannerItems[0]
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Mark Lab Report: Cell Structure as complete')).toBeInTheDocument()
    })

    it('updates screen reader label for completed items', () => {
      const completedItem = {
        ...mockPlannerItems[0],
        planner_override: {
          id: 1,
          plannable_type: 'assignment',
          plannable_id: '1',
          user_id: 1,
          workflow_state: 'active',
          marked_complete: true,
          dismissed: false,
          deleted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      }
      renderWithProvider(<TodoItem item={completedItem} />)

      expect(screen.getByText('Mark Lab Report: Cell Structure as incomplete')).toBeInTheDocument()
    })

    it('shows assignment as complete when submitted', () => {
      const submittedItem = {
        ...mockPlannerItems[0],
        submissions: {
          submitted: true,
          excused: false,
          graded: false,
          late: false,
          missing: false,
          needs_grading: false,
          has_feedback: false,
          redo_request: false,
        },
        planner_override: null,
      }
      renderWithProvider(<TodoItem item={submittedItem} />)

      const button = screen.getByTestId(`todo-checkbox-${submittedItem.plannable_id}`)
      expect(button).toBeInTheDocument()
      expect(screen.getByText('Mark Lab Report: Cell Structure as incomplete')).toBeInTheDocument()

      const link = screen.getByTestId(`todo-link-${submittedItem.plannable_id}`)
      const titleText = link.querySelector('span')
      expect(titleText).toHaveAttribute('color', 'secondary')
    })

    it('shows assignment as incomplete when redo requested', () => {
      const redoItem = {
        ...mockPlannerItems[0],
        submissions: {
          submitted: true,
          excused: false,
          graded: false,
          late: false,
          missing: false,
          needs_grading: false,
          has_feedback: false,
          redo_request: true,
        },
        planner_override: null,
      }
      renderWithProvider(<TodoItem item={redoItem} />)

      const button = screen.getByTestId(`todo-checkbox-${redoItem.plannable_id}`)
      expect(button).toBeInTheDocument()
      expect(screen.getByText('Mark Lab Report: Cell Structure as complete')).toBeInTheDocument()
    })

    it('shows as incomplete when planner override has marked_complete false, even if submitted', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: {
          submitted: true,
          excused: false,
          graded: false,
          late: false,
          missing: false,
          needs_grading: false,
          has_feedback: false,
          redo_request: false,
        },
        planner_override: {
          id: 1,
          plannable_type: 'assignment',
          plannable_id: '1',
          user_id: 1,
          workflow_state: 'active',
          marked_complete: false,
          dismissed: false,
          deleted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Mark Lab Report: Cell Structure as complete')).toBeInTheDocument()
      const link = screen.getByTestId(`todo-link-${item.plannable_id}`)
      const titleText = link.querySelector('span')
      expect(titleText).not.toHaveAttribute('color', 'secondary')
    })

    it('shows as complete when planner override has marked_complete true, even without submission', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: {
          submitted: false,
          excused: false,
          graded: false,
          late: false,
          missing: false,
          needs_grading: false,
          has_feedback: false,
          redo_request: false,
        },
        planner_override: {
          id: 1,
          plannable_type: 'assignment',
          plannable_id: '1',
          user_id: 1,
          workflow_state: 'active',
          marked_complete: true,
          dismissed: false,
          deleted_at: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Mark Lab Report: Cell Structure as incomplete')).toBeInTheDocument()
      const link = screen.getByTestId(`todo-link-${item.plannable_id}`)
      const titleText = link.querySelector('span')
      expect(titleText).toHaveAttribute('color', 'secondary')
    })
  })

  describe('excused item display', () => {
    const excusedSubmission = {
      submitted: false,
      excused: true,
      graded: false,
      late: false,
      missing: false,
      needs_grading: false,
      has_feedback: false,
      redo_request: false,
    }

    const excusedOptedBackOverride = {
      id: 1,
      plannable_type: 'assignment',
      plannable_id: '1',
      user_id: 1,
      workflow_state: 'active',
      marked_complete: false,
      dismissed: false,
      deleted_at: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('shows Excused badge when submission is excused and no planner_override', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: null,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Excused')).toBeInTheDocument()
    })

    it('still shows Excused badge when excused and planner_override marked_complete is false', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: excusedOptedBackOverride,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Excused')).toBeInTheDocument()
    })

    it('shows Done and dims title when excused with no override (effectively complete)', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: null,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Done')).toBeInTheDocument()
      const link = screen.getByTestId(`todo-link-${item.plannable_id}`)
      expect(link.querySelector('span')).toHaveAttribute('color', 'secondary')
    })

    it('button is enabled for excused items with no override', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: null,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByTestId(`todo-checkbox-${item.plannable_id}`)).toBeEnabled()
    })

    it('screen reader label says "Mark as incomplete" for excused with no override', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: null,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Mark Lab Report: Cell Structure as incomplete')).toBeInTheDocument()
    })

    it('shows Mark as done and unset title color when opted back in (marked_complete: false)', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: excusedOptedBackOverride,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Mark as done')).toBeInTheDocument()
      const link = screen.getByTestId(`todo-link-${item.plannable_id}`)
      expect(link.querySelector('span')).not.toHaveAttribute('color', 'secondary')
    })

    it('button is enabled for excused items with marked_complete: false override', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: excusedOptedBackOverride,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByTestId(`todo-checkbox-${item.plannable_id}`)).toBeEnabled()
    })

    it('screen reader label says "Mark as complete" when opted back in', () => {
      const item = {
        ...mockPlannerItems[0],
        submissions: excusedSubmission,
        planner_override: excusedOptedBackOverride,
      }
      renderWithProvider(<TodoItem item={item} />)

      expect(screen.getByText('Mark Lab Report: Cell Structure as complete')).toBeInTheDocument()
    })
  })

  describe('closed item display', () => {
    it('shows "Closed" when lock_at is in the past', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      const closedItem = {
        ...mockPlannerItems[0],
        plannable_date: pastDate.toISOString(),
        plannable: {
          ...mockPlannerItems[0].plannable,
          lock_at: pastDate.toISOString(),
        },
      }
      renderWithProvider(<TodoItem item={closedItem} />)

      expect(screen.getByText('Closed')).toBeInTheDocument()
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    })

    it('shows "Overdue" when overdue but lock_at is not set', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      const overdueItem = {
        ...mockPlannerItems[0],
        plannable_date: pastDate.toISOString(),
        plannable: {
          ...mockPlannerItems[0].plannable,
          lock_at: undefined,
        },
      }
      renderWithProvider(<TodoItem item={overdueItem} />)

      expect(screen.getByText('Overdue')).toBeInTheDocument()
      expect(screen.queryByText('Closed')).not.toBeInTheDocument()
    })

    it('shows "Overdue" when overdue but lock_at is in the future', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)
      const overdueItem = {
        ...mockPlannerItems[0],
        plannable_date: pastDate.toISOString(),
        plannable: {
          ...mockPlannerItems[0].plannable,
          lock_at: futureDate.toISOString(),
        },
      }
      renderWithProvider(<TodoItem item={overdueItem} />)

      expect(screen.getByText('Overdue')).toBeInTheDocument()
      expect(screen.queryByText('Closed')).not.toBeInTheDocument()
    })

    it('shows points alongside "Closed" label', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)
      const closedItem = {
        ...mockPlannerItems[0],
        plannable_date: pastDate.toISOString(),
        plannable: {
          ...mockPlannerItems[0].plannable,
          lock_at: pastDate.toISOString(),
          points_possible: 50,
        },
      }
      renderWithProvider(<TodoItem item={closedItem} />)

      expect(screen.getByText('Closed')).toBeInTheDocument()
      expect(screen.getByText(/50 points/)).toBeInTheDocument()
    })
  })

  describe('announcement display', () => {
    it('shows "Posted" date for announcements without overdue styling', () => {
      const announcementItem = {
        ...mockPlannerItems[0],
        plannable_type: 'announcement' as const,
        plannable_date: '2026-01-22T18:00:00Z',
        plannable: {
          ...mockPlannerItems[0].plannable,
          title: 'Important Announcement',
        },
      }
      renderWithProvider(<TodoItem item={announcementItem} />)

      expect(screen.getByText(/Posted/)).toBeInTheDocument()
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    })

    it('does not apply danger color to announcement date', () => {
      const announcementItem = {
        ...mockPlannerItems[0],
        plannable_type: 'announcement' as const,
        plannable_date: '2020-01-01T00:00:00Z',
        plannable: {
          ...mockPlannerItems[0].plannable,
          title: 'Old Announcement',
        },
      }
      renderWithProvider(<TodoItem item={announcementItem} />)

      const postedText = screen.getByText(/Posted/)
      expect(postedText).toHaveAttribute('color', 'secondary')
    })
  })

  describe('edit button', () => {
    const plannerNoteItem = mockPlannerItems.find(item => item.plannable_type === 'planner_note')!

    it('renders an edit button for planner note items', () => {
      renderWithProvider(<TodoItem item={plannerNoteItem} onEdit={vi.fn()} />)
      expect(screen.getByTestId(`todo-edit-${plannerNoteItem.plannable_id}`)).toBeInTheDocument()
    })

    it('does not render an edit button for non-planner-note items', () => {
      const assignmentItem = mockPlannerItems[0]
      renderWithProvider(<TodoItem item={assignmentItem} onEdit={vi.fn()} />)
      expect(
        screen.queryByTestId(`todo-edit-${assignmentItem.plannable_id}`),
      ).not.toBeInTheDocument()
    })

    it('does not render an edit button when readOnly', () => {
      renderWithProvider(<TodoItem item={plannerNoteItem} onEdit={vi.fn()} readOnly={true} />)
      expect(
        screen.queryByTestId(`todo-edit-${plannerNoteItem.plannable_id}`),
      ).not.toBeInTheDocument()
    })

    it('calls onEdit with the item when the edit button is clicked', async () => {
      const user = userEvent.setup()
      const onEdit = vi.fn()
      renderWithProvider(<TodoItem item={plannerNoteItem} onEdit={onEdit} />)

      await user.click(screen.getByTestId(`todo-edit-${plannerNoteItem.plannable_id}`))

      expect(onEdit).toHaveBeenCalledWith(plannerNoteItem)
    })
  })
})

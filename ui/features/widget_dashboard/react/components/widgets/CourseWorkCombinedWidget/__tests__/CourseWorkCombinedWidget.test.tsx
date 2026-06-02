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
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {setupServer} from 'msw/node'
import {http, HttpResponse, graphql} from 'msw'
import CourseWorkCombinedWidget from '../CourseWorkCombinedWidget'
import type {BaseWidgetProps, Widget} from '../../../../types'
import {
  defaultGraphQLHandlers,
  clearWidgetDashboardCache,
  PlatformTestWrapper,
} from '../../../../__tests__/testHelpers'
import {WidgetLayoutProvider} from '../../../../hooks/useWidgetLayout'
import {WidgetDashboardEditProvider} from '../../../../hooks/useWidgetDashboardEdit'
import {WidgetDashboardProvider} from '../../../../hooks/useWidgetDashboardContext'

const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
const dayAfterTomorrow = new Date()
dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
const threeDaysFromNow = new Date()
threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

const mockStatisticsData = {
  submissionsDueCount: 5,
  missingSubmissionsCount: 2,
  submissionsSubmittedCount: 8,
}

const mockWidget: Widget = {
  id: 'course-work-combined-widget',
  type: 'course_work_combined',
  position: {col: 1, row: 1, relative: 1},
  title: 'Course Work',
}

const buildDefaultProps = (overrides: Partial<BaseWidgetProps> = {}): BaseWidgetProps => {
  return {
    widget: mockWidget,
    ...overrides,
  }
}

const server = setupServer(
  ...defaultGraphQLHandlers,
  graphql.query('GetUserCourseStatistics', () => {
    return HttpResponse.json({
      data: {
        legacyNode: {
          _id: '123',
          enrollments: [
            {
              course: {
                _id: '123',
                name: 'Test Course',
                submissionStatistics: mockStatisticsData,
              },
            },
          ],
        },
      },
    })
  }),
  http.post('/api/graphql', async ({request}) => {
    const body = (await request.json()) as {query: string; variables: any}
    if (body.query.includes('GetUserCourseWork')) {
      return HttpResponse.json({
        data: {
          legacyNode: {
            _id: '1',
            courseWorkSubmissionsConnection: {
              nodes: [
                {
                  _id: 'sub1',
                  cachedDueDate: threeDaysFromNow.toISOString(),
                  submittedAt: null,
                  late: false,
                  missing: false,
                  excused: false,
                  state: 'unsubmitted',
                  assignment: {
                    _id: '1',
                    name: 'Essay on Climate Change',
                    dueAt: threeDaysFromNow.toISOString(),
                    pointsPossible: 50,
                    htmlUrl: '/courses/101/assignments/1',
                    submissionTypes: ['online_text_entry'],
                    state: 'published',
                    published: true,
                    quiz: null,
                    discussion: null,
                    course: {
                      _id: '101',
                      name: 'Environmental Science',
                    },
                  },
                },
                {
                  _id: 'sub2',
                  cachedDueDate: tomorrow.toISOString(),
                  submittedAt: null,
                  late: false,
                  missing: false,
                  excused: false,
                  state: 'unsubmitted',
                  assignment: {
                    _id: '2',
                    name: 'Chapter Quiz Assignment',
                    dueAt: tomorrow.toISOString(),
                    pointsPossible: 25,
                    htmlUrl: '/courses/102/assignments/2',
                    submissionTypes: ['online_quiz'],
                    state: 'published',
                    published: true,
                    quiz: {_id: '2', title: 'Chapter 5 Quiz'},
                    discussion: null,
                    course: {
                      _id: '102',
                      name: 'Biology',
                    },
                  },
                },
                {
                  _id: 'sub3',
                  cachedDueDate: dayAfterTomorrow.toISOString(),
                  submittedAt: null,
                  late: false,
                  missing: false,
                  excused: false,
                  state: 'unsubmitted',
                  assignment: {
                    _id: '3',
                    name: 'Discussion Assignment',
                    dueAt: dayAfterTomorrow.toISOString(),
                    pointsPossible: 15,
                    htmlUrl: '/courses/103/assignments/3',
                    submissionTypes: ['discussion_topic'],
                    state: 'published',
                    published: true,
                    quiz: null,
                    discussion: {_id: '3', title: 'Discussion: Modern Art'},
                    course: {
                      _id: '103',
                      name: 'Art History',
                    },
                  },
                },
                {
                  _id: 'sub4',
                  cachedDueDate: null,
                  submittedAt: null,
                  late: false,
                  missing: false,
                  excused: false,
                  state: 'unsubmitted',
                  assignment: {
                    _id: '4',
                    name: 'Lab Report: Chemical Reactions',
                    dueAt: null,
                    pointsPossible: 40,
                    htmlUrl: '/courses/104/assignments/4',
                    submissionTypes: ['online_upload'],
                    state: 'published',
                    published: true,
                    quiz: null,
                    discussion: null,
                    course: {
                      _id: '104',
                      name: 'Chemistry',
                    },
                  },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                hasPreviousPage: false,
                endCursor: null,
                startCursor: null,
              },
            },
          },
        },
      })
    }
    // Let other handlers from defaultGraphQLHandlers handle other queries
    return new Response('Query not handled', {status: 404})
  }),
)

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })

  return render(
    <PlatformTestWrapper>
      <QueryClientProvider client={queryClient}>
        <WidgetDashboardEditProvider>
          <WidgetLayoutProvider>{component}</WidgetLayoutProvider>
        </WidgetDashboardEditProvider>
      </QueryClientProvider>
    </PlatformTestWrapper>,
  )
}

beforeAll(() => {
  server.listen()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  clearWidgetDashboardCache()
  window.ENV = {current_user_id: '1'} as any
})

describe('CourseWorkCombinedWidget', () => {
  it('renders widget with mock course work items', async () => {
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    expect(screen.getByText('Course Work')).toBeInTheDocument()

    // Wait for data to load first, then check for filters
    await screen.findByText('Essay on Climate Change')
    expect(screen.getByText('Course filter:')).toBeInTheDocument()
    expect(screen.getByText('Chapter 5 Quiz')).toBeInTheDocument()
    expect(screen.getByText('Discussion: Modern Art')).toBeInTheDocument()
    expect(screen.getByText('Lab Report: Chemical Reactions')).toBeInTheDocument()
  })

  it('displays course work items with correct information', async () => {
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    // Wait for data to load
    await screen.findByText('Environmental Science')

    // Check that course names are displayed
    expect(screen.getByText('Biology')).toBeInTheDocument()
    expect(screen.getByText('Art History')).toBeInTheDocument()
    expect(screen.getByText('Chemistry')).toBeInTheDocument()

    // Check that assignment type icons are displayed with correct data-testids
    expect(screen.getAllByTestId('assignment-icon')).toHaveLength(2) // Two assignments in mock data
    expect(screen.getByTestId('quiz-icon')).toBeInTheDocument()
    expect(screen.getByTestId('discussion-icon')).toBeInTheDocument()

    // Check that points are displayed (they're combined with due date text)
    expect(screen.getByText(/50 pts/)).toBeInTheDocument()
    expect(screen.getByText(/25 pts/)).toBeInTheDocument()
    expect(screen.getByText(/15 pts/)).toBeInTheDocument()
    expect(screen.getByText(/40 pts/)).toBeInTheDocument()
  })

  it('sorts items by due date with soonest first', async () => {
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    // Wait for data to load
    await screen.findByText('Chapter 5 Quiz')

    // Check the order by verifying the earliest due date appears first
    const quizText = screen.getByText('Chapter 5 Quiz')
    const labText = screen.getByText('Lab Report: Chemical Reactions')

    // Get all text content and check ordering
    const allText = screen.getByTestId('widget-course-work-combined-widget').textContent
    const quizIndex = allText?.indexOf('Chapter 5 Quiz') ?? -1
    const labIndex = allText?.indexOf('Lab Report: Chemical Reactions') ?? -1

    // Quiz (earliest due date) should appear before Lab (no due date)
    expect(quizIndex).toBeLessThan(labIndex)
    expect(quizText).toBeInTheDocument()
    expect(labText).toBeInTheDocument()
  })

  it('handles course filtering', async () => {
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    // Wait for data to load
    await screen.findByText('Essay on Climate Change')

    // Initial state should show all items
    expect(screen.getByText('Chapter 5 Quiz')).toBeInTheDocument()

    // The select should be present with "All Courses" selected by default
    expect(screen.getByDisplayValue('All Courses')).toBeInTheDocument()
  })

  it('displays empty state when no items are found', async () => {
    server.use(
      graphql.query('GetUserCourseStatistics', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              _id: '123',
              enrollments: [
                {
                  course: {
                    _id: '123',
                    name: 'Test Course',
                    submissionStatistics: {
                      submissionsDueCount: 0,
                      missingSubmissionsCount: 0,
                      submissionsSubmittedCount: 0,
                    },
                  },
                },
              ],
            },
          },
        })
      }),
      http.post('/api/graphql', async ({request}) => {
        const body = (await request.json()) as {query: string; variables: any}
        if (body.query.includes('GetUserCourseWork')) {
          return HttpResponse.json({
            data: {
              legacyNode: {
                _id: '1',
                courseWorkSubmissionsConnection: {
                  nodes: [],
                  pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                    endCursor: null,
                    startCursor: null,
                  },
                },
              },
            },
          })
        }
        return new Response('Query not handled', {status: 404})
      }),
    )

    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    await screen.findByText('No upcoming course work')
    expect(screen.getByDisplayValue('All Courses')).toBeInTheDocument()
  })

  it('handles loading state', () => {
    // Mock with a delayed response to test loading state
    server.use(
      graphql.query('GetUserCourseStatistics', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              _id: '123',
              enrollments: [
                {
                  course: {
                    _id: '123',
                    name: 'Test Course',
                    submissionStatistics: {
                      submissionsDueCount: 0,
                      missingSubmissionsCount: 0,
                      submissionsSubmittedCount: 0,
                    },
                  },
                },
              ],
            },
          },
        })
      }),
      http.post('/api/graphql', async ({request}) => {
        const body = (await request.json()) as {query: string; variables: any}
        if (body.query.includes('GetUserCourseWork')) {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(
                HttpResponse.json({
                  data: {
                    legacyNode: {
                      _id: '1',
                      courseWorkSubmissionsConnection: {
                        nodes: [],
                        pageInfo: {
                          hasNextPage: false,
                          hasPreviousPage: false,
                          endCursor: null,
                          startCursor: null,
                        },
                      },
                    },
                  },
                }),
              )
            }, 100)
          })
        }
        return new Response('Query not handled', {status: 404})
      }),
    )

    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    expect(screen.getByLabelText('Loading widget data...')).toBeInTheDocument()
  })

  it('handles error state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    server.use(
      graphql.query('GetUserCourseStatistics', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              _id: '123',
              enrollments: [
                {
                  course: {
                    _id: '123',
                    name: 'Test Course',
                    submissionStatistics: {
                      submissionsDueCount: 0,
                      missingSubmissionsCount: 0,
                      submissionsSubmittedCount: 0,
                    },
                  },
                },
              ],
            },
          },
        })
      }),
      http.post('/api/graphql', async ({request}) => {
        const body = (await request.json()) as {query: string; variables: any}
        if (body.query.includes('GetUserCourseWork')) {
          return HttpResponse.json({errors: [{message: 'Internal Server Error'}]}, {status: 200})
        }
        return new Response('Query not handled', {status: 404})
      }),
    )

    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    await screen.findByText('Failed to load course work. Please try again.')
    expect(screen.getByTestId('course-work-combined-widget-retry-button')).toBeInTheDocument()
  })

  it('creates clickable links to course work items', async () => {
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    // Wait for data to load
    const essayLink = await screen.findByTestId('course-work-item-link-1')
    expect(essayLink).toHaveAttribute('href', '/courses/101/assignments/1')

    const quizLink = screen.getByTestId('course-work-item-link-2')
    expect(quizLink).toHaveAttribute('href', '/courses/102/assignments/2')

    const discussionLink = screen.getByTestId('course-work-item-link-3')
    expect(discussionLink).toHaveAttribute('href', '/courses/103/assignments/3')

    const labLink = screen.getByTestId('course-work-item-link-4')
    expect(labLink).toHaveAttribute('href', '/courses/104/assignments/4')
  })

  it('displays correct submission statuses based on submission data', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    server.use(
      graphql.query('GetUserCourseStatistics', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              _id: '123',
              enrollments: [
                {
                  course: {
                    _id: '123',
                    name: 'Test Course',
                    submissionStatistics: {
                      submissionsDueCount: 3,
                      missingSubmissionsCount: 1,
                      submissionsSubmittedCount: 0,
                    },
                  },
                },
              ],
            },
          },
        })
      }),
      http.post('/api/graphql', async ({request}) => {
        const body = (await request.json()) as {query: string; variables: any}
        if (body.query.includes('GetUserCourseWork')) {
          return HttpResponse.json({
            data: {
              legacyNode: {
                _id: '1',
                courseWorkSubmissionsConnection: {
                  nodes: [
                    {
                      _id: 'sub1',
                      cachedDueDate: tomorrow.toISOString(),
                      submittedAt: new Date().toISOString(),
                      late: false,
                      missing: false,
                      excused: false,
                      state: 'submitted',
                      assignment: {
                        _id: '1',
                        name: 'Submitted Assignment',
                        dueAt: tomorrow.toISOString(),
                        pointsPossible: 50,
                        htmlUrl: '/courses/101/assignments/1',
                        submissionTypes: ['online_text_entry'],
                        state: 'published',
                        published: true,
                        quiz: null,
                        discussion: null,
                        course: {_id: '101', name: 'Course 1'},
                      },
                    },
                    {
                      _id: 'sub2',
                      cachedDueDate: yesterday.toISOString(),
                      submittedAt: null,
                      late: true,
                      missing: false,
                      excused: false,
                      state: 'unsubmitted',
                      assignment: {
                        _id: '2',
                        name: 'Late Assignment',
                        dueAt: yesterday.toISOString(),
                        pointsPossible: 25,
                        htmlUrl: '/courses/102/assignments/2',
                        submissionTypes: ['online_upload'],
                        state: 'published',
                        published: true,
                        quiz: null,
                        discussion: null,
                        course: {_id: '102', name: 'Course 2'},
                      },
                    },
                    {
                      _id: 'sub3',
                      cachedDueDate: yesterday.toISOString(),
                      submittedAt: null,
                      late: false,
                      missing: true,
                      excused: false,
                      state: 'unsubmitted',
                      assignment: {
                        _id: '3',
                        name: 'Missing Assignment',
                        dueAt: yesterday.toISOString(),
                        pointsPossible: 30,
                        htmlUrl: '/courses/103/assignments/3',
                        submissionTypes: ['online_text_entry'],
                        state: 'published',
                        published: true,
                        quiz: null,
                        discussion: null,
                        course: {_id: '103', name: 'Course 3'},
                      },
                    },
                    {
                      _id: 'sub4',
                      cachedDueDate: threeDaysFromNow.toISOString(),
                      submittedAt: null,
                      late: false,
                      missing: false,
                      excused: false,
                      state: 'pending_review',
                      assignment: {
                        _id: '4',
                        name: 'Pending Review Assignment',
                        dueAt: threeDaysFromNow.toISOString(),
                        pointsPossible: 40,
                        htmlUrl: '/courses/105/assignments/4',
                        submissionTypes: ['online_text_entry'],
                        state: 'published',
                        published: true,
                        quiz: null,
                        discussion: null,
                        course: {_id: '105', name: 'Course 5'},
                      },
                    },
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                    endCursor: null,
                    startCursor: null,
                  },
                },
              },
            },
          })
        }
        return new Response('Query not handled', {status: 404})
      }),
    )

    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    // Wait for data to load and check specific status labels
    await screen.findAllByText('Submitted')
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getAllByText('Missing')).toHaveLength(2) // One from status, one from statistics card
    expect(screen.getByText('Pending Review')).toBeInTheDocument()
  })

  it('displays statistics cards with correct data', async () => {
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    // Wait for data to load
    await screen.findByText('Submitted')
    expect(screen.getByText('Due')).toBeInTheDocument()
    expect(screen.getByText('Missing')).toBeInTheDocument()

    // Check that statistics cards are displayed
    expect(screen.getByText('5')).toBeInTheDocument() // Due count
    expect(screen.getByText('2')).toBeInTheDocument() // Missing count
    expect(screen.getByText('8')).toBeInTheDocument() // Submitted count
  })

  it('shows the summary counts toggle in the header, on by default', async () => {
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    const toggle = await screen.findByTestId('show-summary-counts-toggle')
    expect(toggle).toBeChecked()
    expect(await screen.findByTestId('statistics-card-Due')).toBeInTheDocument()
    expect(screen.getByTestId('statistics-card-Missing')).toBeInTheDocument()
    expect(screen.getByTestId('statistics-card-Submitted')).toBeInTheDocument()
  })

  it('hides the statistics cards when the toggle is turned off', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    expect(await screen.findByTestId('statistics-card-Due')).toBeInTheDocument()

    await user.click(screen.getByTestId('show-summary-counts-toggle'))

    expect(screen.queryByTestId('statistics-card-Due')).not.toBeInTheDocument()
    expect(screen.queryByTestId('statistics-card-Missing')).not.toBeInTheDocument()
    expect(screen.queryByTestId('statistics-card-Submitted')).not.toBeInTheDocument()
    expect(await screen.findByText('Essay on Climate Change')).toBeInTheDocument()
  })

  it('toggling back on restores the statistics cards', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    const toggle = await screen.findByTestId('show-summary-counts-toggle')
    await user.click(toggle)
    expect(screen.queryByTestId('statistics-card-Due')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(await screen.findByTestId('statistics-card-Due')).toBeInTheDocument()
  })

  it('does not fetch course work statistics when the toggle is off', async () => {
    const user = userEvent.setup()
    let statisticsRequestCount = 0
    server.use(
      graphql.query('GetUserCourseStatistics', () => {
        statisticsRequestCount += 1
        return HttpResponse.json({
          data: {
            legacyNode: {
              _id: '123',
              enrollments: [
                {
                  course: {
                    _id: '123',
                    name: 'Test Course',
                    submissionStatistics: mockStatisticsData,
                  },
                },
              ],
            },
          },
        })
      }),
    )

    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    await screen.findByTestId('statistics-card-Due')
    expect(statisticsRequestCount).toBeGreaterThan(0)

    const baselineCount = statisticsRequestCount
    await user.click(screen.getByTestId('show-summary-counts-toggle'))

    await screen.findByText('Essay on Climate Change')
    await new Promise(resolve => setTimeout(resolve, 50))
    await waitFor(() => {
      expect(statisticsRequestCount).toBe(baselineCount)
    })
  })

  it('persists the toggle state via the widget config mutation', async () => {
    const user = userEvent.setup()
    const mutationPayloads: Array<Record<string, unknown>> = []
    server.use(
      graphql.mutation('UpdateWidgetDashboardConfig', ({variables}) => {
        mutationPayloads.push(variables as Record<string, unknown>)
        return HttpResponse.json({
          data: {
            updateWidgetDashboardConfig: {
              widgetId: variables.widgetId,
              filters: variables.filters,
              errors: null,
            },
          },
        })
      }),
    )

    renderWithProviders(<CourseWorkCombinedWidget {...buildDefaultProps()} />)

    await user.click(await screen.findByTestId('show-summary-counts-toggle'))

    await waitFor(() => expect(mutationPayloads.length).toBeGreaterThanOrEqual(1))
    const lastPayload = mutationPayloads[mutationPayloads.length - 1]
    expect(lastPayload.widgetId).toBe('course-work-combined-widget')
    expect((lastPayload.filters as Record<string, unknown>).showSummaryCounts).toBe(false)
  })

  it('filters work items by course and then by status, updating the stat counts', async () => {
    global.event = undefined // workaround bug in SimpleSelect that accesses the global event
    const user = userEvent.setup()

    // Course 102 has nothing not-submitted, but has 2 missing and 2 submitted items.
    // Course 101 carries the only "due" work so the initial (All Courses) view is non-empty.
    server.use(
      graphql.query('GetUserCourseStatistics', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              _id: '123',
              enrollments: [
                {
                  course: {
                    _id: '101',
                    name: 'Course 1',
                    submissionStatistics: {
                      submissionsDueCount: 3,
                      missingSubmissionsCount: 0,
                      submissionsSubmittedCount: 0,
                    },
                  },
                },
                {
                  course: {
                    _id: '102',
                    name: 'Course 2',
                    submissionStatistics: {
                      submissionsDueCount: 0,
                      missingSubmissionsCount: 2,
                      submissionsSubmittedCount: 2,
                    },
                  },
                },
              ],
            },
          },
        })
      }),
      http.post('/api/graphql', async ({request}) => {
        const body = (await request.json()) as {query: string; variables: any}
        if (body.query.includes('GetUserCourseWork')) {
          const {courseFilter, onlySubmitted, includeOverdue} = body.variables

          const buildNode = (
            id: string,
            name: string,
            courseId: string,
            courseName: string,
            statusFlags: {missing?: boolean; state?: string; submittedAt?: string | null},
          ) => ({
            _id: `sub-${id}`,
            cachedDueDate: tomorrow.toISOString(),
            submittedAt: statusFlags.submittedAt ?? null,
            late: false,
            missing: statusFlags.missing ?? false,
            excused: false,
            state: statusFlags.state ?? 'unsubmitted',
            assignment: {
              _id: id,
              name,
              dueAt: tomorrow.toISOString(),
              pointsPossible: 10,
              htmlUrl: `/courses/${courseId}/assignments/${id}`,
              submissionTypes: ['online_text_entry'],
              state: 'published',
              published: true,
              quiz: null,
              discussion: null,
              course: {_id: courseId, name: courseName},
            },
          })

          let nodes: ReturnType<typeof buildNode>[] = []

          if (courseFilter === '102') {
            if (onlySubmitted) {
              nodes = [
                buildNode('201', 'C2 Submitted A', '102', 'Course 2', {
                  state: 'submitted',
                  submittedAt: tomorrow.toISOString(),
                }),
                buildNode('202', 'C2 Submitted B', '102', 'Course 2', {
                  state: 'submitted',
                  submittedAt: tomorrow.toISOString(),
                }),
              ]
            } else if (includeOverdue) {
              nodes = [
                buildNode('203', 'C2 Missing A', '102', 'Course 2', {missing: true}),
                buildNode('204', 'C2 Missing B', '102', 'Course 2', {missing: true}),
              ]
            } else {
              // not_submitted for course 102 -> empty
              nodes = []
            }
          } else {
            // All courses (or course 101) default view has the due item from course 101
            nodes = [buildNode('101', 'C1 Due Work', '101', 'Course 1', {})]
          }

          return HttpResponse.json({
            data: {
              legacyNode: {
                _id: '1',
                courseWorkSubmissionsConnection: {
                  nodes,
                  pageInfo: {
                    hasNextPage: false,
                    hasPreviousPage: false,
                    endCursor: null,
                    startCursor: null,
                    totalCount: nodes.length,
                  },
                },
              },
            },
          })
        }
        return new Response('Query not handled', {status: 404})
      }),
    )

    const sharedCourseData = [
      {
        courseId: '101',
        courseCode: 'C1',
        courseName: 'Course 1',
        currentGrade: 95,
        gradingScheme: 'percentage' as const,
        lastUpdated: '2025-01-01T00:00:00Z',
      },
      {
        courseId: '102',
        courseCode: 'C2',
        courseName: 'Course 2',
        currentGrade: 88,
        gradingScheme: 'percentage' as const,
        lastUpdated: '2025-01-01T00:00:00Z',
      },
    ]

    const queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    render(
      <PlatformTestWrapper>
        <QueryClientProvider client={queryClient}>
          <WidgetDashboardProvider sharedCourseData={sharedCourseData}>
            <WidgetDashboardEditProvider>
              <WidgetLayoutProvider>
                <CourseWorkCombinedWidget {...buildDefaultProps()} />
              </WidgetLayoutProvider>
            </WidgetDashboardEditProvider>
          </WidgetDashboardProvider>
        </QueryClientProvider>
      </PlatformTestWrapper>,
    )

    // Initial (All Courses, Not submitted): the combined "Due" stat sums both courses (3 + 0)
    const dueCardInitial = await screen.findByTestId('statistics-card-Due')
    expect(dueCardInitial).toHaveTextContent('3')
    expect(dueCardInitial).toHaveTextContent('Due')
    expect(await screen.findByText('C1 Due Work')).toBeInTheDocument()

    // Filter to Course 2 -> only that course's stats, and no not-submitted work for it
    await user.click(screen.getByTestId('course-filter-select'))
    await user.click(await screen.findByRole('option', {name: 'Course 2'}))

    await waitFor(() => {
      expect(screen.getByTestId('statistics-card-Due')).toHaveTextContent('0Due')
    })
    expect(await screen.findByTestId('no-course-work-message')).toHaveTextContent(
      'No upcoming course work for selected course',
    )
    expect(screen.queryByText('C1 Due Work')).not.toBeInTheDocument()

    // Apply the Missing status filter on top of the course filter
    await user.click(screen.getByTestId('submission-status-filter-select'))
    await user.click(await screen.findByRole('option', {name: 'Missing'}))

    await waitFor(() => {
      expect(screen.getAllByTestId(/^listed-course-work-item-/)).toHaveLength(2)
    })
    expect(screen.getByText('C2 Missing A')).toBeInTheDocument()
    expect(screen.getByText('C2 Missing B')).toBeInTheDocument()
    const missingCard = screen.getByTestId('statistics-card-Missing')
    expect(missingCard).toHaveTextContent('2Missing')

    // Switch the status filter to Submitted (course filter stays on Course 2)
    await user.click(screen.getByTestId('submission-status-filter-select'))
    await user.click(await screen.findByRole('option', {name: 'Submitted'}))

    await waitFor(() => {
      expect(screen.getAllByTestId(/^listed-course-work-item-/)).toHaveLength(2)
    })
    expect(screen.getByText('C2 Submitted A')).toBeInTheDocument()
    expect(screen.getByText('C2 Submitted B')).toBeInTheDocument()
    const submittedCard = screen.getByTestId('statistics-card-Submitted')
    expect(submittedCard).toHaveTextContent('2Submitted')
  })
})

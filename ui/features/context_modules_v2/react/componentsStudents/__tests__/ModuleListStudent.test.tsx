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
import {act, render, screen, waitFor} from '@testing-library/react'
import {ContextModuleProvider, contextModuleDefaultProps} from '../../hooks/useModuleContext'
import ModulesListStudent from '../ModuleListStudent'
import {setupServer} from 'msw/node'
import {graphql, HttpResponse} from 'msw'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import fakeEnv from '@canvas/test-utils/fakeENV'

type ComponentProps = object

const setUp = (props: ComponentProps = {}, courseId = 'test-course-id') => {
  const contextProps = {
    ...contextModuleDefaultProps,
    courseId,
    moduleGroupMenuTools: [],
    moduleMenuModalTools: [],
    moduleMenuTools: [],
    moduleIndexMenuModalTools: [],
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ContextModuleProvider {...contextProps}>
        <ModulesListStudent {...props} />
      </ContextModuleProvider>
    </QueryClientProvider>,
  )
}

const buildDefaultProps = (overrides: Partial<ComponentProps> = {}): ComponentProps => ({
  ...overrides,
})

const server = setupServer()

describe('ModulesListStudent', () => {
  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    fakeEnv.teardown()
  })
  afterAll(() => server.close())

  beforeEach(() => {
    fakeEnv.setup({
      TIMEZONE: 'UTC',
    })

    // Default mocks to prevent warnings
    server.use(
      graphql.query('GetCourseStudentQuery', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              name: 'Test Course',
              submissionStatistics: {
                missingSubmissionsCount: 0,
                submissionsDueThisWeekCount: 0,
              },
              settings: {
                showStudentOnlyModuleId: null,
              },
            },
          },
        })
      }),
      graphql.query('GetModuleItemsStudentQuery', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              moduleItems: [],
            },
          },
        })
      }),
    )
  })

  it('shows a loading spinner when loading and no data', () => {
    server.use(
      graphql.query('GetModulesStudentQuery', () => {
        return new Promise(() => {})
      }),
    )

    setUp(buildDefaultProps())
    expect(screen.getByText('Loading modules')).toBeInTheDocument()
  })

  it('shows error message if error is present', async () => {
    const courseId = 'test-course-id'
    const errorMsg = 'Failed to load modules'

    server.use(
      graphql.query('GetModulesStudentQuery', () => {
        return HttpResponse.json({
          errors: [{message: errorMsg}],
        })
      }),
    )

    setUp(buildDefaultProps(), courseId)

    await waitFor(() => {
      expect(screen.getByText('Error loading modules')).toBeInTheDocument()
    })
  })

  it('shows no modules message when modules array is empty', async () => {
    const courseId = 'test-course-id'

    server.use(
      graphql.query('GetModulesStudentQuery', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              modulesConnection: {
                edges: [],
                pageInfo: {hasNextPage: false, endCursor: null},
              },
            },
          },
        })
      }),
    )

    setUp(buildDefaultProps(), courseId)
    await waitFor(() => {
      expect(screen.getByText('No modules found')).toBeInTheDocument()
    })
  })

  it('renders a module if one exists', async () => {
    const courseId = 'test-course-id'
    const moduleId = 'module-1'

    server.use(
      graphql.query('GetModulesStudentQuery', () => {
        return HttpResponse.json({
          data: {
            legacyNode: {
              modulesConnection: {
                edges: [
                  {
                    node: {
                      _id: moduleId,
                      name: 'Intro Module',
                      completionRequirements: [],
                      prerequisites: [
                        {id: 'prereq-1', name: 'Prerequisite Module', type: 'context_module'},
                      ],
                      requireSequentialProgress: false,
                      progression: {collapsed: false},
                      requirementCount: 0,
                      unlockAt: null,
                      submissionStatistics: null,
                    },
                  },
                ],
                pageInfo: {hasNextPage: false, endCursor: null},
              },
            },
          },
        })
      }),
    )

    setUp(buildDefaultProps(), courseId)
    await waitFor(() => {
      expect(screen.getByText('Intro Module')).toBeInTheDocument()
    })
  })

  describe('scroll to #module_<id> anchor', () => {
    const scrolledIds: string[] = []
    const originalScrollIntoView = (HTMLElement.prototype as any).scrollIntoView
    const originalHash = window.location.hash

    // Manually-drained RAF queue. Bridging RAF through setTimeout(16ms) caused
    // ~60 ticks per timer-advance, which compounded across the shard's many
    // test files and pushed the vitest worker over its 2 GB heap.
    const rafQueue = new Map<number, FrameRequestCallback>()
    let nextRafId = 1
    const flushRaf = () => {
      const pending = Array.from(rafQueue.values())
      rafQueue.clear()
      for (const cb of pending) cb(Date.now())
    }
    // Separate act() calls so React 18's MessageChannel-scheduled effect work
    // settles between the timer advance and the RAF drain.
    const advanceAndFlush = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
      })
      await act(async () => {
        flushRaf()
      })
    }

    const mockModules = (ids: string[]) => {
      server.use(
        graphql.query('GetModulesStudentQuery', () =>
          HttpResponse.json({
            data: {
              legacyNode: {
                modulesConnection: {
                  edges: ids.map(id => ({
                    node: {
                      _id: id,
                      name: `Module ${id}`,
                      completionRequirements: [],
                      prerequisites: [],
                      requireSequentialProgress: false,
                      progression: {collapsed: true},
                      requirementCount: 0,
                      unlockAt: null,
                      submissionStatistics: null,
                    },
                  })),
                  pageInfo: {hasNextPage: false, endCursor: null},
                },
              },
            },
          }),
        ),
      )
    }

    // Per-test setup/teardown (not beforeAll/afterAll) so fake-timer + RAF
    // state can't accumulate across the 5 tests and push vitest-04's worker
    // over its heap ceiling.
    beforeEach(() => {
      vi.useFakeTimers({shouldAdvanceTime: true})
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
        (cb: FrameRequestCallback): number => {
          const id = nextRafId++
          rafQueue.set(id, cb)
          return id
        },
      )
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id: number): void => {
        rafQueue.delete(id)
      })
      scrolledIds.length = 0
      rafQueue.clear()
      ;(HTMLElement.prototype as any).scrollIntoView = function (this: HTMLElement) {
        scrolledIds.push(this.id)
      }
    })

    afterEach(() => {
      ;(window.requestAnimationFrame as any).mockRestore?.()
      ;(window.cancelAnimationFrame as any).mockRestore?.()
      vi.useRealTimers()
      ;(HTMLElement.prototype as any).scrollIntoView = originalScrollIntoView
      window.location.hash = originalHash
    })

    it('renders a module_<id> anchor for each module so URL fragments can target them', async () => {
      mockModules(['1', '2', '3'])

      setUp(buildDefaultProps())

      await waitFor(() => expect(screen.getByText('Module 1')).toBeInTheDocument())
      expect(document.getElementById('module_1')).not.toBeNull()
      expect(document.getElementById('module_2')).not.toBeNull()
      expect(document.getElementById('module_3')).not.toBeNull()
    })

    it('scrolls the matching module into view when the hash targets a rendered module', async () => {
      mockModules(['1', '2', '3'])
      window.location.hash = '#module_2'

      setUp(buildDefaultProps())

      await waitFor(() => expect(screen.getByText('Module 2')).toBeInTheDocument())
      // First step fires the queries-idle timer and runs RAF tick #1 (records
      // the rect top); the second advances past the settle window so tick #2
      // sees it stable and scrolls.
      await advanceAndFlush(300)
      await advanceAndFlush(400)

      expect(scrolledIds).toEqual(['module_2'])
    })

    it('does not scroll when there is no hash', async () => {
      mockModules(['1', '2', '3'])
      window.location.hash = ''

      setUp(buildDefaultProps())

      await waitFor(() => expect(screen.getByText('Module 1')).toBeInTheDocument())
      await advanceAndFlush(300)

      expect(scrolledIds).toEqual([])
    })

    it('does not scroll when the hash does not match a rendered module', async () => {
      mockModules(['1', '2', '3'])
      window.location.hash = '#module_999'

      setUp(buildDefaultProps())

      await waitFor(() => expect(screen.getByText('Module 1')).toBeInTheDocument())
      await advanceAndFlush(300)

      expect(scrolledIds).toEqual([])
    })

    it('does not scroll for hashes outside the #module_<id> pattern', async () => {
      mockModules(['1', '2', '3'])
      window.location.hash = '#some_other_anchor'

      setUp(buildDefaultProps())

      await waitFor(() => expect(screen.getByText('Module 1')).toBeInTheDocument())
      await advanceAndFlush(300)

      expect(scrolledIds).toEqual([])
    })
  })
})

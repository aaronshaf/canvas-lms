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
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {setupServer} from 'msw/node'
import {graphql, HttpResponse} from 'msw'
import fakeENV from '@canvas/test-utils/fakeENV'
import {getWidget} from '../WidgetRegistry'
import {WIDGET_TYPES} from '../../constants'
import {WidgetDashboardProvider} from '../../hooks/useWidgetDashboardContext'
import {WidgetDashboardEditProvider} from '../../hooks/useWidgetDashboardEdit'
import {WidgetLayoutProvider} from '../../hooks/useWidgetLayout'
import {ResponsiveProvider} from '../../hooks/useResponsiveContext'
import {
  defaultGraphQLHandlers,
  clearWidgetDashboardCache,
  PlatformTestWrapper,
} from '../../__tests__/testHelpers'

const emptyEnrollments = {data: {legacyNode: {_id: '123', enrollments: []}}}

const server = setupServer(
  ...defaultGraphQLHandlers,
  graphql.query('GetUserCourseWork', () => HttpResponse.json(emptyEnrollments)),
  graphql.query('GetUserCourseStatistics', () => HttpResponse.json(emptyEnrollments)),
)

let queryClient: QueryClient

const courseWorkWidget = {
  id: 'course-work-1',
  type: WIDGET_TYPES.COURSE_WORK_COMBINED,
  position: {col: 1, row: 1, relative: 0},
  title: 'Course work',
}

describe('WidgetRegistry rendering', () => {
  beforeAll(() => {
    server.listen({onUnhandledRequest: 'error'})
  })

  beforeEach(() => {
    fakeENV.setup({current_user_id: '123'})
    clearWidgetDashboardCache()
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false, gcTime: 0}},
    })
  })

  afterEach(() => {
    server.resetHandlers()
    queryClient.clear()
    fakeENV.teardown()
  })

  afterAll(() => {
    server.close()
  })

  // Guards the registry → package boundary: the local CourseWorkCombinedWidget and
  // its tests were deleted when this widget moved to @instructure/platform-widget-dashboard,
  // so this is the only Canvas-side check that the registered component still mounts
  // through the real registry, PlatformUiProvider, and TranslationsProvider.
  it('mounts the CourseWorkCombinedWidget resolved from the real registry', async () => {
    const renderer = getWidget(WIDGET_TYPES.COURSE_WORK_COMBINED)
    expect(renderer).toBeDefined()
    const WidgetComponent = renderer!.component

    render(
      <PlatformTestWrapper>
        <QueryClientProvider client={queryClient}>
          <WidgetDashboardProvider>
            <WidgetDashboardEditProvider>
              <WidgetLayoutProvider>
                <ResponsiveProvider matches={['desktop']}>
                  <WidgetComponent {...renderer!.props} widget={courseWorkWidget} />
                </ResponsiveProvider>
              </WidgetLayoutProvider>
            </WidgetDashboardEditProvider>
          </WidgetDashboardProvider>
        </QueryClientProvider>
      </PlatformTestWrapper>,
    )

    // Root mounts, and both halves of the combined widget render: the statistics
    // summary cards and the course-work list (empty state for our stubbed data).
    expect(await screen.findByTestId('widget-course-work-1')).toBeInTheDocument()
    expect(await screen.findByTestId('statistics-card-Due')).toBeInTheDocument()
    expect(await screen.findByTestId('no-course-work-message')).toBeInTheDocument()
  })
})

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
import {render, act, waitFor} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {DashboardHeader} from '../DashboardHeader'
import injectGlobalAlertContainers from '@canvas/util/react/testing/injectGlobalAlertContainers'

vi.mock('@canvas/planner', async () => {
  const actual = await vi.importActual('@canvas/planner')
  return {
    ...actual,
    resetPlanner: vi.fn(),
    initializePlanner: vi.fn().mockResolvedValue(),
    loadPlannerDashboard: vi.fn(),
  }
})

// Stub the dynamic-imported Backbone view so loadStreamItemDashboard's
// Promise.all resolves and the .html() write executes.
vi.mock('../../backbone/views/DashboardView', () => ({
  default: vi.fn().mockImplementation(function FakeDashboardView() {
    return {undelegateEvents: vi.fn()}
  }),
}))

injectGlobalAlertContainers()

const EVENT_HANDLER_ATTR = /^on[a-z]+$/i

const expectNoEventHandlers = root => {
  root.querySelectorAll('*').forEach(el => {
    el.getAttributeNames().forEach(name => {
      expect(name).not.toMatch(EVENT_HANDLER_ATTR)
    })
  })
}

const setupDashboardDom = () => {
  document.body.innerHTML = `
    <div id="dashboard-planner" style="display: none;"></div>
    <div id="dashboard-planner-header" style="display: none;"></div>
    <div id="dashboard-planner-header-aux" style="display: none;"></div>
    <div id="dashboard-activity" style="display: block;"></div>
    <div id="DashboardCard_Container" style="display: none;"></div>
    <div id="right-side-wrapper" style="display: none;"></div>
  `
}

const renderActivityDashboard = () => {
  const env = {
    current_user: {id: '1'},
    current_user_roles: ['user', 'student'],
    OBSERVED_USERS_LIST: [],
    CAN_ADD_OBSERVEE: false,
    MOMENT_LOCALE: 'en',
    TIMEZONE: 'UTC',
  }
  return render(
    <DashboardHeader
      planner_enabled={false}
      dashboard_view="activity"
      env={env}
      loadDashboardSidebar={vi.fn()}
    />,
  )
}

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'bypass'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('DashboardHeader activity feed — XSS regression at jQuery .html() sink', () => {
  beforeEach(() => {
    setupDashboardDom()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('strips on* event handlers from a malicious activity-stream response', async () => {
    server.use(
      http.get(
        '*/dashboard/stream_items',
        () =>
          new HttpResponse(
            '<div class="entry">hi <img src=x onerror="window.__xss_fired = true"></div>',
            {headers: {'Content-Type': 'text/html'}},
          ),
      ),
    )

    await act(async () => {
      renderActivityDashboard()
    })

    const activity = document.getElementById('dashboard-activity')
    await waitFor(() => {
      expect(activity.children.length).toBeGreaterThan(0)
    })

    expectNoEventHandlers(activity)
    expect(window.__xss_fired).toBeUndefined()
    delete window.__xss_fired
  })

  it('strips <script> tags from a malicious activity-stream response', async () => {
    server.use(
      http.get(
        '*/dashboard/stream_items',
        () =>
          new HttpResponse(
            '<div class="entry">before<script>window.__xss_fired = true</script>after</div>',
            {headers: {'Content-Type': 'text/html'}},
          ),
      ),
    )

    await act(async () => {
      renderActivityDashboard()
    })

    const activity = document.getElementById('dashboard-activity')
    await waitFor(() => {
      expect(activity.children.length).toBeGreaterThan(0)
    })

    expect(activity.querySelector('script')).toBeNull()
    expect(window.__xss_fired).toBeUndefined()
    delete window.__xss_fired
  })

  it('strips javascript: hrefs from a malicious activity-stream response', async () => {
    server.use(
      http.get(
        '*/dashboard/stream_items',
        () =>
          new HttpResponse(
            '<div class="entry"><a href="javascript:window.__xss_fired=true">click</a></div>',
            {headers: {'Content-Type': 'text/html'}},
          ),
      ),
    )

    await act(async () => {
      renderActivityDashboard()
    })

    const activity = document.getElementById('dashboard-activity')
    await waitFor(() => {
      expect(activity.children.length).toBeGreaterThan(0)
    })

    activity.querySelectorAll('a').forEach(a => {
      expect(a.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
    })
    expect(window.__xss_fired).toBeUndefined()
    delete window.__xss_fired
  })

  it('preserves benign activity-stream markup', async () => {
    server.use(
      http.get(
        '*/dashboard/stream_items',
        () =>
          new HttpResponse(
            '<div class="entry"><p>You commented on <strong>Math homework</strong>.</p></div>',
            {headers: {'Content-Type': 'text/html'}},
          ),
      ),
    )

    await act(async () => {
      renderActivityDashboard()
    })

    const activity = document.getElementById('dashboard-activity')
    await waitFor(() => {
      expect(activity.children.length).toBeGreaterThan(0)
    })

    expect(activity.querySelector('strong')?.textContent).toBe('Math homework')
    expect(activity.textContent).toContain('You commented on')
  })
})

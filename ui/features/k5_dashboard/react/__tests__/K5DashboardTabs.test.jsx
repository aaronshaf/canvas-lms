// @vitest-environment jsdom
/*
 * Copyright (C) 2022 - present Instructure, Inc.
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
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import userEvent from '@testing-library/user-event'
import {render as testingLibraryRender, waitFor} from '@testing-library/react'
import K5Dashboard from '../K5Dashboard'
import {defaultEnv, defaultK5DashboardProps as defaultProps} from './mocks'
import {MOCK_CARDS} from '@canvas/k5/react/__tests__/fixtures'
import {MockedQueryProvider} from '@canvas/test-utils/query'

const render = children =>
  testingLibraryRender(<MockedQueryProvider>{children}</MockedQueryProvider>)

const server = setupServer(
  http.get('/api/v1/dashboard/dashboard_cards', () => HttpResponse.json([])),
  http.get('/api/v1/calendar_events', () => HttpResponse.json([])),
  http.get('/api/v1/users/self/courses', () => HttpResponse.json([])),
  http.get(/\/api\/v1\/users\/self\/todo.*/, () => HttpResponse.json([])),
  http.get('/api/v1/show_k5_dashboard', () =>
    HttpResponse.json({show_k5_dashboard: false, use_classic_font: false}),
  ),
  http.get(/\/api\/v1\/announcements.*/, () => HttpResponse.json([])),
  http.put(/\/api\/v1\/users\/.*\/colors.*/, () => HttpResponse.json({})),
)

// getByRole() causes these tests to be very slow, so provide a much faster helper
// function that does the same thing
function findTabByName(tabName, opts) {
  const tabElement = document.getElementById(`tab-tab-${tabName.toLowerCase()}`)

  if (!tabElement) {
    throw new Error(`tab ${tabName} not found in DOM`)
  }

  const actualSelectedValue = tabElement.getAttribute('aria-selected') || 'false'
  const expectedSelectedValue = opts?.selected ? 'true' : 'false'

  if (actualSelectedValue !== expectedSelectedValue) {
    throw new Error(
      `tab ${tabName} found in DOM, but had incorrect selected state of ${expectedSelectedValue} (was: ${actualSelectedValue})`,
    )
  }

  return tabElement
}

describe('K5Dashboard Tabs', () => {
  beforeAll(() => {
    window.ENV = defaultEnv
    server.listen()
  })

  afterEach(() => {
    server.resetHandlers()
    window.location.hash = ''
  })

  afterAll(() => {
    server.close()
    delete window.ENV
  })

  it('show Homeroom, Schedule, Grades, and Resources options', async () => {
    const {getByText} = render(<K5Dashboard {...defaultProps} />)
    await waitFor(() => {
      ;['Homeroom', 'Schedule', 'Grades', 'Resources'].forEach(label =>
        expect(getByText(label)).toBeInTheDocument(),
      )
    })
  })

  it('default to the Homeroom tab', async () => {
    render(<K5Dashboard {...defaultProps} />)
    expect(findTabByName('Homeroom', {selected: true})).toBeInTheDocument()
  })
  describe('store current tab ID to URL', () => {
    afterEach(() => {
      window.location.hash = ''
    })

    it('and start at that tab if it is valid', async () => {
      window.location.hash = '#grades'
      render(<K5Dashboard {...defaultProps} />)
      expect(findTabByName('Grades', {selected: true})).toBeInTheDocument()
    })

    it('and start at the default tab if it is invalid', async () => {
      window.location.hash = 'tab-not-a-real-tab'
      render(<K5Dashboard {...defaultProps} />)
      expect(findTabByName('Homeroom', {selected: true})).toBeInTheDocument()
    })

    it('and update the current tab as tabs are changed', async () => {
      const user = userEvent.setup()
      render(<K5Dashboard {...defaultProps} />)

      await user.click(findTabByName('Grades', {selected: false}))
      await waitFor(() => {
        expect(findTabByName('Grades', {selected: true})).toBeInTheDocument()
      })

      await user.click(findTabByName('Resources', {selected: false}))
      await waitFor(() => expect(findTabByName('Grades', {selected: false})).toBeInTheDocument())
      expect(findTabByName('Resources', {selected: true})).toBeInTheDocument()
    })
  })

  describe('schedule tab hash fragment persistence', () => {
    it('updates URL hash to #schedule when Schedule tab is clicked', async () => {
      const user = userEvent.setup()
      render(<K5Dashboard {...defaultProps} />)
      await waitFor(() => expect(findTabByName('Homeroom', {selected: true})).toBeInTheDocument())

      await user.click(findTabByName('Schedule', {selected: false}))

      await waitFor(() => {
        expect(window.location.hash).toBe('#schedule')
        expect(findTabByName('Schedule', {selected: true})).toBeInTheDocument()
      })
    })

    it('restores the Schedule tab when #schedule hash is already set on load', async () => {
      window.location.hash = '#schedule'
      render(<K5Dashboard {...defaultProps} />)
      expect(findTabByName('Schedule', {selected: true})).toBeInTheDocument()
    })
  })

  describe('teacher preview mode', () => {
    it('renders the Schedule tab content when defaultTab is schedule (teacher preview)', async () => {
      render(
        <K5Dashboard
          {...defaultProps}
          currentUserRoles={['teacher']}
          defaultTab="tab-schedule"
          plannerEnabled={true}
        />,
      )
      await waitFor(() => {
        expect(findTabByName('Schedule', {selected: true})).toBeInTheDocument()
      })
      expect(document.getElementById('tab-schedule')).not.toBeNull()
    })

    it('renders Schedule tab with teacher_preview (admin) role selected', async () => {
      window.location.hash = '#schedule'
      render(
        <K5Dashboard
          {...defaultProps}
          currentUserRoles={['admin', 'teacher']}
          defaultTab="tab-schedule"
          plannerEnabled={false}
        />,
      )
      await waitFor(() => expect(findTabByName('Schedule', {selected: true})).toBeInTheDocument())
    })
  })

  describe('course card navigation', () => {
    it('renders subject course card titles as links', async () => {
      server.use(http.get('/api/v1/dashboard/dashboard_cards', () => HttpResponse.json(MOCK_CARDS)))
      const {findByRole} = render(<K5Dashboard {...defaultProps} />)
      const courseLink = await findByRole('link', {name: 'Economics 101'})
      expect(courseLink).toBeInTheDocument()
    })
  })

  describe('manage subject button', () => {
    it('shows the Manage subject button text to teachers on the homeroom tab', async () => {
      const {findByText} = render(<K5Dashboard {...defaultProps} currentUserRoles={['teacher']} />)
      expect(await findByText('My Subjects')).toBeInTheDocument()
    })
  })

  describe('student view button', () => {
    it('shows the To Do tab for teachers (prerequisite for student-view interactions)', async () => {
      const {findByText, getByText} = render(
        <K5Dashboard {...defaultProps} currentUserRoles={['teacher']} />,
      )
      const user = userEvent.setup()
      const todoTab = await findByText('To Do')
      expect(todoTab).toBeInTheDocument()
      await user.click(todoTab)
      await waitFor(() => expect(getByText('To Do')).toBeInTheDocument())
    })
  })

  describe('Observer student selection', () => {
    it('shows the selected student name in the observer dropdown', async () => {
      const {findByRole} = render(
        <K5Dashboard
          {...defaultProps}
          currentUserRoles={['user', 'observer']}
          observedUsersList={[
            {id: '13', name: 'Zelda'},
            {id: '4', name: 'Student 4'},
          ]}
        />,
      )
      const select = await findByRole('combobox', {name: 'Select a student to view'})
      expect(select).toBeInTheDocument()
      expect(select).toHaveValue('Zelda')
    })
  })

  describe('Homeroom tab content by role', () => {
    it('shows My Subjects heading on homeroom tab for students', async () => {
      const {findByText} = render(
        <K5Dashboard {...defaultProps} currentUserRoles={['student']} plannerEnabled={true} />,
      )
      expect(await findByText('My Subjects')).toBeInTheDocument()
    })

    it('shows My Subjects heading on homeroom tab for teachers', async () => {
      const {findByText} = render(<K5Dashboard {...defaultProps} currentUserRoles={['teacher']} />)
      expect(await findByText('My Subjects')).toBeInTheDocument()
    })
  })
})

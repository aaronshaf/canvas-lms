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

// Mock problematic InstUI import chain before anything else loads
vi.mock('@instructure/platform-alerts', () => ({
  showFlashAlert: vi.fn(),
  showFlashSuccess: vi.fn(),
  showFlashError: vi.fn(),
}))

vi.mock('@instructure/platform-query', () => ({
  queryClient: {
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
  },
}))

vi.mock('@canvas/dashboard-card/dashboardCardQueries', () => ({
  fetchDashboardCardsAsync: vi.fn(),
}))

vi.mock('@canvas/dashboard-card/util/dashboardUtils', () => ({
  processDashboardCards: vi.fn(cards => cards),
}))

// Mock apiUtils to avoid transformation side effects in these HTTP-focused tests
vi.mock('../../utilities/apiUtils', async () => ({
  ...(await vi.importActual('../../utilities/apiUtils')),
  transformInternalToApiItem: vi.fn(item => ({...item, transformedToApi: true})),
  transformInternalToApiOverride: vi.fn(item => ({
    ...item.planner_override,
    marked_complete: null,
    transformedToApiOverride: true,
  })),
  transformPlannerNoteApiToInternalItem: vi.fn(item => ({...item, transformedToInternal: true})),
  transformApiToInternalItem: vi.fn(item => ({...item, transformedFromApi: true})),
}))

import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import moment from 'moment-timezone'
import * as Actions from '../index'
import {initialize as alertInitialize} from '../../utilities/alertUtils'

// Thunk-aware dispatch for actions that call dispatch(otherThunk())
function makeThunkDispatch(getStateFn) {
  const dispatch = vi.fn(action => {
    if (typeof action === 'function') return action(dispatch, getStateFn)
  })
  return dispatch
}

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

beforeEach(() => {
  alertInitialize({
    visualSuccessCallback() {},
    visualErrorCallback() {},
    srAlertCallback() {},
  })
})

const mockState = {
  courses: [],
  groups: [],
  timeZone: 'UTC',
  currentUser: {id: '1'},
  opportunities: {items: [{}], nextUrl: null},
  selectedObservee: null,
  singleCourse: false,
  weeklyDashboard: null,
  loading: {},
  sidebar: {},
  ui: {},
}

describe('planner CRUD actions — axios-to-fetch migration', () => {
  describe('savePlannerItem (new)', () => {
    it('POSTs to /api/v1/planner_notes', async () => {
      let capturedRequest
      server.use(
        http.post('/api/v1/planner_notes', async ({request}) => {
          capturedRequest = request
          return HttpResponse.json({id: '42', title: 'new item'}, {status: 201})
        }),
      )
      const dispatch = vi.fn(action => (typeof action?.then === 'function' ? action : undefined))
      const plannerItem = {title: 'new item', date: '2026-05-27'}
      await Actions.savePlannerItem(plannerItem)(dispatch, () => mockState)
      expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner_notes')
      expect(capturedRequest.method).toBe('POST')
    })
  })

  describe('savePlannerItem (existing)', () => {
    it('PUTs to /api/v1/planner_notes/:id', async () => {
      let capturedRequest
      server.use(
        http.put('/api/v1/planner_notes/7', async ({request}) => {
          capturedRequest = request
          return HttpResponse.json({id: '7', title: 'updated'}, {status: 200})
        }),
      )
      const dispatch = vi.fn(action => (typeof action?.then === 'function' ? action : undefined))
      const plannerItem = {id: '7', title: 'updated', date: '2026-05-27'}
      await Actions.savePlannerItem(plannerItem)(dispatch, () => mockState)
      expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner_notes/7')
      expect(capturedRequest.method).toBe('PUT')
    })
  })

  describe('deletePlannerItem', () => {
    it('DELETEs to /api/v1/planner_notes/:id', async () => {
      let capturedRequest
      server.use(
        http.delete('/api/v1/planner_notes/5', async ({request}) => {
          capturedRequest = request
          return HttpResponse.json({id: '5'}, {status: 200})
        }),
      )
      const dispatch = vi.fn(action => (typeof action?.then === 'function' ? action : undefined))
      const plannerItem = {id: '5', title: 'to delete'}
      await Actions.deletePlannerItem(plannerItem)(dispatch, () => mockState)
      expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner_notes/5')
      expect(capturedRequest.method).toBe('DELETE')
    })
  })

  describe('dismissOpportunity (new override)', () => {
    it('POSTs to /api/v1/planner/overrides', async () => {
      let capturedRequest
      server.use(
        http.post('/api/v1/planner/overrides', async ({request}) => {
          capturedRequest = request
          return HttpResponse.json({id: '99', marked_complete: true}, {status: 201})
        }),
      )
      const dispatch = vi.fn()
      // no id means saveNewPlannerOverride
      await Actions.dismissOpportunity('6', {})(dispatch)
      expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner/overrides')
      expect(capturedRequest.method).toBe('POST')
    })
  })

  describe('dismissOpportunity (existing override)', () => {
    it('PUTs to /api/v1/planner/overrides/:id', async () => {
      let capturedRequest
      server.use(
        http.put('/api/v1/planner/overrides/12', async ({request}) => {
          capturedRequest = request
          return HttpResponse.json({id: '12', marked_complete: true}, {status: 200})
        }),
      )
      const dispatch = vi.fn()
      await Actions.dismissOpportunity('6', {id: '12'})(dispatch)
      expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner/overrides/12')
      expect(capturedRequest.method).toBe('PUT')
    })
  })

  describe('getNextOpportunities', () => {
    it('GETs the nextUrl and dispatches addOpportunities', async () => {
      server.use(
        http.get('/api/v1/opportunities/next', () =>
          HttpResponse.json(
            [
              {id: 1, dismissed: false},
              {id: 2, dismissed: false},
            ],
            {headers: {'Content-Type': 'application/json', link: '</>; rel="current"'}},
          ),
        ),
      )
      const state = {
        ...mockState,
        opportunities: {items: [{}], nextUrl: '/api/v1/opportunities/next'},
      }
      const dispatch = vi.fn()
      await Actions.getNextOpportunities()(dispatch, () => state)
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({type: 'START_LOADING_OPPORTUNITIES'}),
      )
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADD_OPPORTUNITIES',
          payload: expect.objectContaining({nextUrl: null}),
        }),
      )
    })
  })
})

describe('togglePlannerItemCompletion (new override)', () => {
  it('POSTs to /api/v1/planner/overrides when no existing override', async () => {
    let capturedRequest
    server.use(
      http.post('/api/v1/planner/overrides', async ({request}) => {
        capturedRequest = request
        return HttpResponse.json({id: '100', marked_complete: true}, {status: 201})
      }),
    )
    const dispatch = vi.fn(action => (typeof action?.then === 'function' ? action : undefined))
    const plannerItem = {id: '10', title: 'Test item', completed: false, planner_override: null}
    await Actions.togglePlannerItemCompletion(plannerItem)(dispatch, () => mockState)
    expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner/overrides')
    expect(capturedRequest.method).toBe('POST')
  })
})

describe('togglePlannerItemCompletion (existing override)', () => {
  it('PUTs to /api/v1/planner/overrides/:id when override exists', async () => {
    let capturedRequest
    server.use(
      http.put('/api/v1/planner/overrides/55', async ({request}) => {
        capturedRequest = request
        return HttpResponse.json({id: '55', marked_complete: true}, {status: 200})
      }),
    )
    const dispatch = vi.fn(action => (typeof action?.then === 'function' ? action : undefined))
    const plannerItem = {
      id: '10',
      title: 'Test item',
      completed: false,
      planner_override: {id: '55'},
    }
    await Actions.togglePlannerItemCompletion(plannerItem)(dispatch, () => mockState)
    expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner/overrides/55')
    expect(capturedRequest.method).toBe('PUT')
  })
})

describe('getInitialOpportunities', () => {
  it('GETs /api/v1/users/self/missing_submissions', async () => {
    let capturedRequest
    server.use(
      http.get('/api/v1/users/self/missing_submissions', ({request}) => {
        capturedRequest = request
        return HttpResponse.json([], {
          headers: {'Content-Type': 'application/json', link: '</>; rel="current"'},
        })
      }),
    )
    const dispatch = vi.fn()
    await Actions.getInitialOpportunities()(dispatch, () => mockState)
    expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/users/self/missing_submissions')
    expect(capturedRequest.method).toBe('GET')
  })

  it('dispatches addOpportunities when items are returned', async () => {
    server.use(
      http.get('/api/v1/users/self/missing_submissions', () =>
        HttpResponse.json([{id: 1}, {id: 2}], {
          headers: {'Content-Type': 'application/json', link: '</>; rel="current"'},
        }),
      ),
    )
    const dispatch = vi.fn()
    await Actions.getInitialOpportunities()(dispatch, () => mockState)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'START_LOADING_OPPORTUNITIES'}),
    )
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADD_OPPORTUNITIES',
        payload: expect.objectContaining({items: [{id: 1}, {id: 2}]}),
      }),
    )
  })
})

describe('sidebarLoadNextItems', () => {
  it('GETs the sidebar nextUrl', async () => {
    let capturedRequest
    server.use(
      http.get('/api/v1/planner/items', ({request}) => {
        capturedRequest = request
        return HttpResponse.json([], {headers: {'Content-Type': 'application/json'}})
      }),
    )
    const state = {
      ...mockState,
      sidebar: {loading: false, nextUrl: '/api/v1/planner/items'},
    }
    const dispatch = vi.fn()
    await Actions.sidebarLoadNextItems()(dispatch, () => state)
    expect(new URL(capturedRequest.url).pathname).toBe('/api/v1/planner/items')
    expect(capturedRequest.method).toBe('GET')
  })
})

describe('sidebarLoadInitialItems', () => {
  it('GETs /api/v1/planner/items after loading courses', async () => {
    let capturedPlannerRequest
    server.use(
      http.get('/api/v1/dashboard/dashboard_cards', () =>
        HttpResponse.json([], {headers: {'Content-Type': 'application/json'}}),
      ),
      http.get('/api/v1/planner/items', ({request}) => {
        capturedPlannerRequest = request
        return HttpResponse.json([], {headers: {'Content-Type': 'application/json'}})
      }),
    )
    const state = {...mockState, sidebar: {}}
    const dispatch = makeThunkDispatch(() => state)
    await Actions.sidebarLoadInitialItems(moment.tz('2026-05-27', 'UTC'), null)(
      dispatch,
      () => state,
    )
    expect(new URL(capturedPlannerRequest.url).pathname).toBe('/api/v1/planner/items')
    expect(capturedPlannerRequest.method).toBe('GET')
  })
})

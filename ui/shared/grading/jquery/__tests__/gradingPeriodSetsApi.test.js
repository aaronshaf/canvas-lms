/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import fakeENV from '@canvas/test-utils/fakeENV'
import NaiveRequestDispatch from '@canvas/network/NaiveRequestDispatch/index'
import api from '../gradingPeriodSetsApi'

vi.mock('@canvas/network/NaiveRequestDispatch/index')

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const deserializedSets = [
  {
    id: '1',
    title: 'Fall 2015',
    weighted: false,
    displayTotalsForAllGradingPeriods: false,
    gradingPeriods: [
      {
        id: '1',
        title: 'Q1',
        startDate: new Date('2015-09-01T12:00:00Z'),
        endDate: new Date('2015-10-31T12:00:00Z'),
        closeDate: new Date('2015-11-07T12:00:00Z'),
        isClosed: true,
        isLast: false,
        weight: 43.5,
      },
      {
        id: '2',
        title: 'Q2',
        startDate: new Date('2015-11-01T12:00:00Z'),
        endDate: new Date('2015-12-31T12:00:00Z'),
        closeDate: new Date('2016-01-07T12:00:00Z'),
        isClosed: false,
        isLast: true,
        weight: null,
      },
    ],
    permissions: {
      read: true,
      create: true,
      update: true,
      delete: true,
    },
    createdAt: new Date('2015-12-29T12:00:00Z'),
    enrollmentTermIDs: undefined,
  },
  {
    id: '2',
    title: 'Spring 2016',
    weighted: true,
    displayTotalsForAllGradingPeriods: false,
    gradingPeriods: [],
    permissions: {
      read: true,
      create: true,
      update: true,
      delete: true,
    },
    createdAt: new Date('2015-11-29T12:00:00Z'),
    enrollmentTermIDs: undefined,
  },
]

const serializedSets = [
  {
    grading_period_sets: [
      {
        id: '1',
        title: 'Fall 2015',
        weighted: false,
        display_totals_for_all_grading_periods: false,
        grading_periods: [
          {
            id: '1',
            title: 'Q1',
            start_date: '2015-09-01T12:00:00Z',
            end_date: '2015-10-31T12:00:00Z',
            close_date: '2015-11-07T12:00:00Z',
            is_closed: true,
            is_last: false,
            weight: 43.5,
          },
          {
            id: '2',
            title: 'Q2',
            start_date: '2015-11-01T12:00:00Z',
            end_date: '2015-12-31T12:00:00Z',
            close_date: '2016-01-07T12:00:00Z',
            is_closed: false,
            is_last: true,
            weight: null,
          },
        ],
        permissions: {
          read: true,
          create: true,
          update: true,
          delete: true,
        },
        created_at: '2015-12-29T12:00:00Z',
      },
      {
        id: '2',
        title: 'Spring 2016',
        weighted: true,
        display_totals_for_all_grading_periods: false,
        grading_periods: [],
        permissions: {
          read: true,
          create: true,
          update: true,
          delete: true,
        },
        created_at: '2015-11-29T12:00:00Z',
      },
    ],
  },
]

const deserializedSetCreating = {
  title: 'Fall 2015',
  weighted: null,
  displayTotalsForAllGradingPeriods: false,
  enrollmentTermIDs: ['1', '2'],
}

describe('gradingPeriodSetsApi', () => {
  let mockGetDepaginated

  beforeEach(() => {
    fakeENV.setup()
    ENV.GRADING_PERIOD_SETS_URL = '/api/grading_period_sets'
    ENV.GRADING_PERIOD_SET_UPDATE_URL = '/api/grading_period_sets/{{ id }}'

    mockGetDepaginated = vi.fn()
    NaiveRequestDispatch.mockImplementation(function () {
      return {getDepaginated: mockGetDepaginated}
    })
  })

  afterEach(() => {
    fakeENV.teardown()
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('calls the resolved endpoint', async () => {
      mockGetDepaginated.mockReturnValue({
        then: callback => {
          callback([])
          return {
            fail: () => {},
          }
        },
      })

      await api.list()
      expect(mockGetDepaginated).toHaveBeenCalledWith('/api/grading_period_sets')
    })

    it('deserializes returned grading period sets', async () => {
      mockGetDepaginated.mockReturnValue({
        then: callback => {
          callback(serializedSets)
          return {
            fail: () => {},
          }
        },
      })

      const sets = await api.list()
      expect(sets).toEqual(deserializedSets)
    })

    it('creates a title from the creation date when the set has no title', async () => {
      const untitledSets = [
        {
          grading_period_sets: [
            {
              id: '1',
              title: null,
              grading_periods: [],
              permissions: {
                read: true,
                create: true,
                update: true,
                delete: true,
              },
              created_at: '2015-11-29T12:00:00Z',
            },
          ],
        },
      ]

      mockGetDepaginated.mockReturnValue({
        then: callback => {
          callback(untitledSets)
          return {
            fail: () => {},
          }
        },
      })

      const sets = await api.list()
      expect(sets[0].title).toBe('Set created Nov 29, 2015')
    })
  })

  describe('create', () => {
    it('calls the resolved endpoint with the serialized grading period set', async () => {
      const responseBody = {
        grading_period_set: {
          id: '1',
          title: 'Fall 2015',
          weighted: null,
          display_totals_for_all_grading_periods: false,
          grading_periods: [],
          permissions: {read: true, create: true, update: true, delete: true},
          created_at: '2015-12-29T12:00:00Z',
        },
      }
      let capturedBody = null
      server.use(
        http.post('/api/grading_period_sets', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json(responseBody)
        }),
      )
      await api.create(deserializedSetCreating)
      expect(capturedBody).toEqual({
        enrollment_term_ids: ['1', '2'],
        grading_period_set: {
          title: 'Fall 2015',
          weighted: null,
          display_totals_for_all_grading_periods: false,
        },
      })
    })

    it('deserializes the returned grading period set', async () => {
      const responseBody = {
        grading_period_set: {
          id: '1',
          title: 'Fall 2015',
          weighted: null,
          display_totals_for_all_grading_periods: false,
          grading_periods: [],
          permissions: {read: true, create: true, update: true, delete: true},
          created_at: '2015-12-29T12:00:00Z',
        },
      }
      server.use(http.post('/api/grading_period_sets', () => HttpResponse.json(responseBody)))
      const result = await api.create(deserializedSetCreating)
      expect(result).toMatchObject({id: '1', title: 'Fall 2015'})
    })

    it('rejects on non-2xx response', async () => {
      server.use(http.post('/api/grading_period_sets', () => new HttpResponse(null, {status: 422})))
      await expect(api.create(deserializedSetCreating)).rejects.toThrow()
    })
  })

  describe('update', () => {
    const updatingSet = {
      id: '1',
      title: 'Fall 2015 Updated',
      weighted: false,
      displayTotalsForAllGradingPeriods: true,
      enrollmentTermIDs: ['1'],
    }

    beforeEach(() => {
      ENV.GRADING_PERIOD_SET_UPDATE_URL = '/api/grading_period_sets/{{ id }}'
    })

    it('returns the input set on success', async () => {
      server.use(
        http.patch('/api/grading_period_sets/1', () => new HttpResponse(null, {status: 204})),
      )
      const result = await api.update(updatingSet)
      expect(result).toBe(updatingSet)
    })

    it('sends the serialized set to the correct URL', async () => {
      let capturedBody = null
      server.use(
        http.patch('/api/grading_period_sets/1', async ({request}) => {
          capturedBody = await request.json()
          return new HttpResponse(null, {status: 204})
        }),
      )
      await api.update(updatingSet)
      expect(capturedBody).toEqual({
        enrollment_term_ids: ['1'],
        grading_period_set: {
          title: 'Fall 2015 Updated',
          weighted: false,
          display_totals_for_all_grading_periods: true,
        },
      })
    })

    it('rejects on non-2xx response', async () => {
      server.use(
        http.patch('/api/grading_period_sets/1', () => new HttpResponse(null, {status: 500})),
      )
      await expect(api.update(updatingSet)).rejects.toThrow()
    })
  })
})

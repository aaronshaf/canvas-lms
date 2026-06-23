/*
 * Copyright (C) 2016 - present Instructure, Inc.
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
import api from '../gradingPeriodsApi'

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const deserializedPeriods = [
  {
    id: '1',
    title: 'Q1',
    startDate: new Date('2015-09-01T12:00:00Z'),
    endDate: new Date('2015-10-31T12:00:00Z'),
    closeDate: new Date('2015-11-07T12:00:00Z'),
    isClosed: true,
    isLast: false,
    weight: 40,
  },
  {
    id: '2',
    title: 'Q2',
    startDate: new Date('2015-11-01T12:00:00Z'),
    endDate: new Date('2015-12-31T12:00:00Z'),
    closeDate: new Date('2016-01-07T12:00:00Z'),
    isClosed: true,
    isLast: true,
    weight: 60,
  },
]

const serializedPeriods = {
  grading_periods: [
    {
      id: '1',
      title: 'Q1',
      start_date: new Date('2015-09-01T12:00:00Z'),
      end_date: new Date('2015-10-31T12:00:00Z'),
      close_date: new Date('2015-11-07T12:00:00Z'),
      weight: 40,
    },
    {
      id: '2',
      title: 'Q2',
      start_date: new Date('2015-11-01T12:00:00Z'),
      end_date: new Date('2015-12-31T12:00:00Z'),
      close_date: new Date('2016-01-07T12:00:00Z'),
      weight: 60,
    },
  ],
}

const periodsData = {
  grading_periods: [
    {
      id: '1',
      title: 'Q1',
      start_date: '2015-09-01T12:00:00Z',
      end_date: '2015-10-31T12:00:00Z',
      close_date: '2015-11-07T12:00:00Z',
      is_closed: true,
      is_last: false,
      weight: 40,
    },
    {
      id: '2',
      title: 'Q2',
      start_date: '2015-11-01T12:00:00Z',
      end_date: '2015-12-31T12:00:00Z',
      close_date: '2016-01-07T12:00:00Z',
      is_closed: true,
      is_last: true,
      weight: 60,
    },
  ],
}

describe('batchUpdate', () => {
  beforeEach(() => {
    fakeENV.setup()
    ENV.GRADING_PERIODS_UPDATE_URL = '/api/{{ set_id }}/batch_update'
  })

  afterEach(() => {
    fakeENV.teardown()
  })

  it('calls the resolved endpoint with serialized grading periods', async () => {
    let capturedBody = null
    server.use(
      http.patch('/api/123/batch_update', async ({request}) => {
        capturedBody = await request.json()
        return HttpResponse.json(periodsData)
      }),
    )
    await api.batchUpdate(123, deserializedPeriods)
    expect(capturedBody).toMatchObject({
      grading_periods: expect.arrayContaining([
        expect.objectContaining({id: '1', title: 'Q1', weight: 40}),
        expect.objectContaining({id: '2', title: 'Q2', weight: 60}),
      ]),
    })
  })

  it('deserializes returned grading periods', async () => {
    server.use(http.patch('/api/123/batch_update', () => HttpResponse.json(periodsData)))
    const periods = await api.batchUpdate(123, deserializedPeriods)
    expect(periods).toEqual(deserializedPeriods)
  })

  it('rejects the promise upon errors', async () => {
    server.use(http.patch('/api/123/batch_update', () => new HttpResponse(null, {status: 500})))
    await expect(api.batchUpdate(123, deserializedPeriods)).rejects.toThrow()
  })
})

describe('deserializePeriods', () => {
  it('returns an empty array if passed undefined', () => {
    expect(api.deserializePeriods(undefined)).toEqual([])
  })

  it('returns an empty array if passed null', () => {
    expect(api.deserializePeriods(null)).toEqual([])
  })

  it('deserializes periods', () => {
    const result = api.deserializePeriods(periodsData.grading_periods)
    expect(result).toEqual(deserializedPeriods)
  })
})

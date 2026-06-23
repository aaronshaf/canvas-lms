/*
 * Copyright (C) 2020 - present Instructure, Inc.
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
import * as apiClient from '../apiClient'

const server = setupServer()
const ctx = {contextType: 'course', contextId: '1'}

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('apiClient', () => {
  describe('getAnnouncements', () => {
    const announcementsCtx = {
      contextType: 'course',
      contextId: '1',
      announcements: {currentPage: 1},
      announcementsSearch: {term: '', filter: ''},
    }

    it('returns {data, headers} with announcements list', async () => {
      const announcements = [{id: 1}, {id: 2}]
      server.use(
        http.get('/api/v1/courses/1/discussion_topics', ({request}) => {
          const url = new URL(request.url)
          expect(url.searchParams.get('only_announcements')).toBe('true')
          return HttpResponse.json(announcements, {
            headers: {link: '<https://example.com>; rel="next"'},
          })
        }),
      )
      const result = await apiClient.getAnnouncements(announcementsCtx, {page: 1})
      expect(result.data).toEqual(announcements)
      expect(result.headers.link).toBe('<https://example.com>; rel="next"')
    })

    it('rejects on non-2xx response', async () => {
      server.use(
        http.get('/api/v1/courses/1/discussion_topics', () => {
          return new HttpResponse(null, {status: 500})
        }),
      )
      await expect(apiClient.getAnnouncements(announcementsCtx, {page: 1})).rejects.toThrow()
    })
  })

  describe('lockAnnouncements', () => {
    it('sends PUT with locked=true for each announcement id', async () => {
      const captured = {}
      server.use(
        http.put('/api/v1/courses/1/discussion_topics/10', async ({request}) => {
          captured[10] = await request.json()
          return HttpResponse.json({id: 10})
        }),
        http.put('/api/v1/courses/1/discussion_topics/20', async ({request}) => {
          captured[20] = await request.json()
          return HttpResponse.json({id: 20})
        }),
      )
      const result = await apiClient.lockAnnouncements(ctx, [10, 20])
      expect(captured[10]).toEqual({locked: true})
      expect(captured[20]).toEqual({locked: true})
      expect(result.successes).toHaveLength(2)
      expect(result.failures).toHaveLength(0)
    })

    it('sends PUT with locked=false when unlocking', async () => {
      let capturedBody
      server.use(
        http.put('/api/v1/courses/1/discussion_topics/10', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({id: 10})
        }),
      )
      await apiClient.lockAnnouncements(ctx, [10], false)
      expect(capturedBody).toEqual({locked: false})
    })

    it('reports failures when a request errors', async () => {
      server.use(
        http.put(
          '/api/v1/courses/1/discussion_topics/10',
          () => new HttpResponse(null, {status: 500}),
        ),
      )
      const result = await apiClient.lockAnnouncements(ctx, [10])
      expect(result.failures).toHaveLength(1)
    })
  })

  describe('deleteAnnouncements', () => {
    it('sends DELETE for each announcement id', async () => {
      const deleted = []
      server.use(
        http.delete('/api/v1/courses/1/discussion_topics/10', () => {
          deleted.push(10)
          return new HttpResponse(null, {status: 204})
        }),
        http.delete('/api/v1/courses/1/discussion_topics/20', () => {
          deleted.push(20)
          return new HttpResponse(null, {status: 204})
        }),
      )
      const result = await apiClient.deleteAnnouncements(ctx, [10, 20])
      expect(deleted).toEqual(expect.arrayContaining([10, 20]))
      expect(result.successes).toHaveLength(2)
      expect(result.failures).toHaveLength(0)
    })

    it('reports failures when a request errors', async () => {
      server.use(
        http.delete(
          '/api/v1/courses/1/discussion_topics/10',
          () => new HttpResponse(null, {status: 403}),
        ),
      )
      const result = await apiClient.deleteAnnouncements(ctx, [10])
      expect(result.failures).toHaveLength(1)
    })
  })

  describe('markAllAnnouncementRead', () => {
    it('sends PUT to read_all with only_announcements param', async () => {
      let requestUrl
      server.use(
        http.put('*', ({request}) => {
          requestUrl = request.url
          return HttpResponse.json({})
        }),
      )
      await apiClient.markAllAnnouncementRead(ctx)
      expect(requestUrl).toContain('/api/v1/courses/1/discussion_topics/read_all')
      expect(requestUrl).toContain('only_announcements=true')
    })
  })

  describe('getExternalFeeds', () => {
    it('fetches external feeds with per_page=100', async () => {
      let requestUrl
      server.use(
        http.get('*', ({request}) => {
          requestUrl = request.url
          return HttpResponse.json([{id: 1}, {id: 2}])
        }),
      )
      const result = await apiClient.getExternalFeeds(ctx)
      expect(requestUrl).toContain('/api/v1/courses/1/external_feeds')
      expect(requestUrl).toContain('per_page=100')
      expect(result.json).toEqual([{id: 1}, {id: 2}])
    })
  })

  describe('deleteExternalFeed', () => {
    it('sends DELETE to the specific feed URL', async () => {
      let deleted = false
      server.use(
        http.delete('/api/v1/courses/1/external_feeds/42', () => {
          deleted = true
          return new HttpResponse(null, {status: 204})
        }),
      )
      await apiClient.deleteExternalFeed(ctx, 42)
      expect(deleted).toBe(true)
    })
  })

  describe('addExternalFeed', () => {
    it('provides arguments to the post request correctly', async () => {
      let capturedBody
      server.use(
        http.post('/api/v1/courses/1/external_feeds', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({id: 1})
        }),
      )
      await apiClient.addExternalFeed(ctx, {
        url: 'reddit.com',
        verbosity: 'full',
        header_match: 'this # should work',
      })
      expect(capturedBody).toEqual({
        url: 'reddit.com',
        verbosity: 'full',
        header_match: 'this # should work',
      })
    })

    it('returns the created feed from the response', async () => {
      server.use(
        http.post('/api/v1/courses/1/external_feeds', () =>
          HttpResponse.json({id: 99, url: 'example.com'}),
        ),
      )
      const result = await apiClient.addExternalFeed(ctx, {
        url: 'example.com',
        verbosity: 'link_only',
        header_match: null,
      })
      expect(result.json).toEqual({id: 99, url: 'example.com'})
    })

    it('throws on server error', async () => {
      server.use(
        http.post('/api/v1/courses/1/external_feeds', () => new HttpResponse(null, {status: 422})),
      )
      await expect(
        apiClient.addExternalFeed(ctx, {url: 'bad', verbosity: 'full', header_match: null}),
      ).rejects.toThrow()
    })
  })
})

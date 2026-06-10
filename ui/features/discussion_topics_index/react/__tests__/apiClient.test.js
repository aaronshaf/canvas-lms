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
import * as apiClient from '../apiClient'

const server = setupServer()
const ctx = {contextType: 'course', contextId: '1'}

beforeAll(() => server.listen({onUnhandledRequest: 'error'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('discussion_topics_index apiClient', () => {
  describe('updateDiscussion', () => {
    it('sends PUT with updated fields and returns json', async () => {
      let capturedBody
      server.use(
        http.put('/api/v1/courses/1/discussion_topics/5', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({id: 5, title: 'Updated'})
        }),
      )
      const result = await apiClient.updateDiscussion(
        ctx,
        {id: 5},
        {title: 'Updated', locked: false},
      )
      expect(capturedBody).toEqual({title: 'Updated', locked: false})
      expect(result.json).toEqual({id: 5, title: 'Updated'})
    })
  })

  describe('deleteDiscussion', () => {
    it('sends DELETE to the discussion URL', async () => {
      let deleted = false
      server.use(
        http.delete('/api/v1/courses/1/discussion_topics/5', () => {
          deleted = true
          return new HttpResponse(null, {status: 204})
        }),
      )
      await apiClient.deleteDiscussion(ctx, {discussion: {id: 5}})
      expect(deleted).toBe(true)
    })
  })

  describe('subscribeToTopic', () => {
    it('sends PUT to the subscribed endpoint', async () => {
      let method
      server.use(
        http.put('/api/v1/courses/1/discussion_topics/7/subscribed', ({request}) => {
          method = request.method
          return HttpResponse.json({})
        }),
      )
      await apiClient.subscribeToTopic(ctx, {id: 7})
      expect(method).toBe('PUT')
    })
  })

  describe('unsubscribeFromTopic', () => {
    it('sends DELETE to the subscribed endpoint', async () => {
      let deleted = false
      server.use(
        http.delete('/api/v1/courses/1/discussion_topics/7/subscribed', () => {
          deleted = true
          return new HttpResponse(null, {status: 204})
        }),
      )
      await apiClient.unsubscribeFromTopic(ctx, {id: 7})
      expect(deleted).toBe(true)
    })
  })

  describe('getUserSettings', () => {
    it('fetches user settings and returns json', async () => {
      server.use(
        http.get('/api/v1/users/42/settings', () => HttpResponse.json({manual_mark_as_read: true})),
      )
      const result = await apiClient.getUserSettings({currentUserId: '42'})
      expect(result.json).toEqual({manual_mark_as_read: true})
    })
  })

  describe('getCourseSettings', () => {
    it('fetches course settings and returns json', async () => {
      server.use(
        http.get('/api/v1/courses/1/settings', () =>
          HttpResponse.json({allow_student_discussion_topics: true}),
        ),
      )
      const result = await apiClient.getCourseSettings(ctx)
      expect(result.json).toEqual({allow_student_discussion_topics: true})
    })
  })

  describe('saveCourseSettings', () => {
    it('sends PUT with settings body', async () => {
      let capturedBody
      server.use(
        http.put('/api/v1/courses/1/settings', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({})
        }),
      )
      await apiClient.saveCourseSettings(ctx, {allow_student_discussion_topics: false})
      expect(capturedBody).toEqual({allow_student_discussion_topics: false})
    })
  })

  describe('saveUserSettings', () => {
    it('sends PUT with settings body to user endpoint', async () => {
      let capturedBody
      server.use(
        http.put('/api/v1/users/42/settings', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({})
        }),
      )
      await apiClient.saveUserSettings({currentUserId: '42'}, {manual_mark_as_read: false})
      expect(capturedBody).toEqual({manual_mark_as_read: false})
    })
  })

  describe('duplicateDiscussion', () => {
    it('sends POST to duplicate endpoint and returns new discussion', async () => {
      server.use(
        http.post('/api/v1/courses/1/discussion_topics/5/duplicate', () =>
          HttpResponse.json({id: 99, title: 'Copy of Discussion'}),
        ),
      )
      const result = await apiClient.duplicateDiscussion(ctx, 5)
      expect(result.json).toEqual({id: 99, title: 'Copy of Discussion'})
    })
  })

  describe('reorderPinnedDiscussions', () => {
    it('sends POST with order as a comma-joined string', async () => {
      let capturedBody
      server.use(
        http.post('/api/v1/courses/1/discussion_topics/reorder', async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({reorder: true})
        }),
      )
      await apiClient.reorderPinnedDiscussions(ctx, [3, 1, 2])
      expect(capturedBody).toEqual({order: '3,1,2'})
    })
  })

  describe('migrateDiscussionDisallowThreadedReplies', () => {
    it('sends PUT to the migrate_disallow endpoint', async () => {
      let called = false
      server.use(
        http.put('/api/v1/courses/1/discussion_topics/migrate_disallow', () => {
          called = true
          return HttpResponse.json({})
        }),
      )
      await apiClient.migrateDiscussionDisallowThreadedReplies({contextId: '1'})
      expect(called).toBe(true)
    })
  })

  describe('updateDiscussionTopicTypes', () => {
    it('sends PUT with threaded and not_threaded arrays', async () => {
      let capturedBody
      server.use(
        http.put(
          '/api/v1/courses/1/discussion_topics/update_discussion_types',
          async ({request}) => {
            capturedBody = await request.json()
            return HttpResponse.json({success: 'true'})
          },
        ),
      )
      const result = await apiClient.updateDiscussionTopicTypes({
        contextId: '1',
        threaded: [1, 2],
        notThreaded: [3],
      })
      expect(capturedBody).toEqual({threaded: [1, 2], not_threaded: [3]})
      expect(result.json).toEqual({success: 'true'})
    })

    it('returns success=false on failure response', async () => {
      server.use(
        http.put('/api/v1/courses/1/discussion_topics/update_discussion_types', () =>
          HttpResponse.json({success: 'false'}),
        ),
      )
      const result = await apiClient.updateDiscussionTopicTypes({
        contextId: '1',
        threaded: [],
        notThreaded: [],
      })
      expect(result.json.success).toBe('false')
    })

    it('throws on server error', async () => {
      server.use(
        http.put(
          '/api/v1/courses/1/discussion_topics/update_discussion_types',
          () => new HttpResponse(null, {status: 500}),
        ),
      )
      await expect(
        apiClient.updateDiscussionTopicTypes({contextId: '1', threaded: [], notThreaded: []}),
      ).rejects.toThrow()
    })
  })
})

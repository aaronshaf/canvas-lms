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

import {describe, it, expect, beforeAll, beforeEach, afterEach, afterAll} from 'vitest'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'
import {REACTION_TYPE} from '@instructure/platform-notebook'
import {CanvasNotebookApi} from '../CanvasNotebookApi'

type CapturedRequest = {query: string; variables?: Record<string, unknown>}

const COURSE_ID = '42'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function mockGraphQL(responseBody: object, status = 200) {
  server.use(http.post('/api/graphql', () => HttpResponse.json(responseBody, {status})))
}

const STUDY_NOTE_FIXTURE = {
  _id: '1',
  courseId: '42',
  userText: 'my note',
  reactions: ['Important'],
  highlightData: {
    selectedText: 'hello',
    textPosition: null,
    range: null,
    pageLastModifiedAt: '2026-01-01',
  },
  learningObjectId: 'p1',
  learningObjectType: 'WikiPage',
  userId: 'u1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('CanvasNotebookApi', () => {
  let api: CanvasNotebookApi

  beforeEach(() => {
    api = new CanvasNotebookApi(COURSE_ID)
  })

  describe('getNotes', () => {
    it('returns paginated notes mapped to NoteType', async () => {
      mockGraphQL({
        data: {
          studyNotesConnection: {
            nodes: [STUDY_NOTE_FIXTURE],
            pageInfo: {totalCount: 1, totalNrOfPages: 1},
          },
        },
      })

      const result = await api.getNotes({pageSize: 10})

      expect(result.notes).toHaveLength(1)
      expect(result.notes[0]).toMatchObject({
        id: '1',
        courseId: '42',
        objectId: 'p1',
        objectType: 'WikiPage',
        userText: 'my note',
        reaction: ['Important'],
        userId: 'u1',
      })
      expect(result.pageInfo.totalCount).toBe(1)
      expect(result.pageInfo.totalNrOfPages).toBe(1)
    })

    it('returns totalCount and totalNrOfPages from pageInfo when provided', async () => {
      mockGraphQL({
        data: {
          studyNotesConnection: {
            nodes: [STUDY_NOTE_FIXTURE],
            pageInfo: {totalCount: 42, totalNrOfPages: 5},
          },
        },
      })

      const result = await api.getNotes({pageSize: 10})
      expect(result.pageInfo.totalCount).toBe(42)
      expect(result.pageInfo.totalNrOfPages).toBe(5)
    })

    it('returns undefined totalCount and totalNrOfPages when not provided', async () => {
      mockGraphQL({
        data: {
          studyNotesConnection: {nodes: [], pageInfo: {}},
        },
      })

      const result = await api.getNotes({})
      expect(result.pageInfo.totalCount).toBeUndefined()
      expect(result.pageInfo.totalNrOfPages).toBeUndefined()
    })

    it('maps _id to id', async () => {
      mockGraphQL({
        data: {
          studyNotesConnection: {
            nodes: [{...STUDY_NOTE_FIXTURE, _id: '99'}],
            pageInfo: {},
          },
        },
      })

      const result = await api.getNotes({})
      expect(result.notes[0].id).toBe('99')
    })

    it('sends courseId from constructor to the query', async () => {
      const captured = {body: null as CapturedRequest | null}
      server.use(
        http.post('/api/graphql', async ({request}) => {
          captured.body = (await request.json()) as CapturedRequest
          return HttpResponse.json({
            data: {studyNotesConnection: {nodes: [], pageInfo: {}}},
          })
        }),
      )

      await api.getNotes({pageSize: 5})

      expect(captured.body?.variables?.['courseId']).toBe(COURSE_ID)
    })

    it('maps learningObject filter to canvas-lms filter shape', async () => {
      const captured = {body: null as CapturedRequest | null}
      server.use(
        http.post('/api/graphql', async ({request}) => {
          captured.body = (await request.json()) as CapturedRequest
          return HttpResponse.json({
            data: {studyNotesConnection: {nodes: [], pageInfo: {}}},
          })
        }),
      )

      await api.getNotes({filter: {learningObject: {type: 'WikiPage', id: 'p1'}}})

      expect(captured.body?.variables?.['filter']).toEqual({
        learningObject: {learningObjectId: 'p1', learningObjectType: 'WikiPage'},
        reactions: undefined,
      })
    })

    it('encodes offset as a base64 `after` cursor', async () => {
      const captured = {body: null as CapturedRequest | null}
      server.use(
        http.post('/api/graphql', async ({request}) => {
          captured.body = (await request.json()) as CapturedRequest
          return HttpResponse.json({
            data: {studyNotesConnection: {nodes: [], pageInfo: {}}},
          })
        }),
      )

      await api.getNotes({offset: 20, pageSize: 5})

      expect(captured.body?.variables).toMatchObject({first: 5, after: btoa('20')})
    })

    it('omits the `after` cursor on the first page and defaults first to 10', async () => {
      const captured = {body: null as CapturedRequest | null}
      server.use(
        http.post('/api/graphql', async ({request}) => {
          captured.body = (await request.json()) as CapturedRequest
          return HttpResponse.json({
            data: {studyNotesConnection: {nodes: [], pageInfo: {}}},
          })
        }),
      )

      await api.getNotes({})

      expect(captured.body?.variables).toMatchObject({first: 10, after: null})
    })
  })

  describe('createNote', () => {
    it('creates a note and returns it mapped to NoteType', async () => {
      mockGraphQL({
        data: {
          createStudyNote: {
            studyNote: {...STUDY_NOTE_FIXTURE, _id: '2', userText: 'new note'},
            errors: [],
          },
        },
      })

      const result = await api.createNote({
        courseId: COURSE_ID,
        objectId: 'p1',
        objectType: 'WikiPage',
        reaction: [REACTION_TYPE.IMPORTANT],
        highlightData: STUDY_NOTE_FIXTURE.highlightData as Parameters<
          typeof api.createNote
        >[0]['highlightData'],
      })

      expect(result.id).toBe('2')
      expect(result.userText).toBe('new note')
      expect(result.objectId).toBe('p1')
    })

    it('sends learningObjectId and learningObjectType from objectId/objectType', async () => {
      const captured = {body: null as CapturedRequest | null}
      server.use(
        http.post('/api/graphql', async ({request}) => {
          captured.body = (await request.json()) as CapturedRequest
          return HttpResponse.json({
            data: {createStudyNote: {studyNote: STUDY_NOTE_FIXTURE, errors: []}},
          })
        }),
      )

      await api.createNote({
        courseId: COURSE_ID,
        objectId: 'p1',
        objectType: 'WikiPage',
        reaction: [],
        highlightData: STUDY_NOTE_FIXTURE.highlightData as Parameters<
          typeof api.createNote
        >[0]['highlightData'],
      })

      expect(captured.body?.variables).toMatchObject({
        learningObjectId: 'p1',
        learningObjectType: 'WikiPage',
      })
    })

    it('throws when mutation returns errors', async () => {
      mockGraphQL({
        data: {
          createStudyNote: {
            studyNote: null,
            errors: [{attribute: 'base', message: 'Course not found'}],
          },
        },
      })

      await expect(
        api.createNote({
          courseId: COURSE_ID,
          objectId: 'p1',
          objectType: 'WikiPage',
          reaction: [],
          highlightData: STUDY_NOTE_FIXTURE.highlightData as Parameters<
            typeof api.createNote
          >[0]['highlightData'],
        }),
      ).rejects.toThrow('Course not found')
    })
  })

  describe('updateNote', () => {
    it('updates a note and returns it', async () => {
      mockGraphQL({
        data: {
          updateStudyNote: {
            studyNote: {...STUDY_NOTE_FIXTURE, userText: 'updated'},
            errors: [],
          },
        },
      })

      const result = await api.updateNote('1', {
        id: '1',
        reaction: [REACTION_TYPE.CONFUSING],
        highlightData: STUDY_NOTE_FIXTURE.highlightData as Parameters<
          typeof api.updateNote
        >[1]['highlightData'],
      })

      expect(result.userText).toBe('updated')
    })

    it('sends the note id in variables', async () => {
      const captured = {body: null as CapturedRequest | null}
      server.use(
        http.post('/api/graphql', async ({request}) => {
          captured.body = (await request.json()) as CapturedRequest
          return HttpResponse.json({
            data: {updateStudyNote: {studyNote: STUDY_NOTE_FIXTURE, errors: []}},
          })
        }),
      )

      await api.updateNote('1', {
        id: '1',
        reaction: [REACTION_TYPE.IMPORTANT],
        highlightData: STUDY_NOTE_FIXTURE.highlightData as Parameters<
          typeof api.updateNote
        >[1]['highlightData'],
      })

      expect(captured.body?.variables?.['id']).toBe('1')
    })

    it('throws when mutation returns errors', async () => {
      mockGraphQL({
        data: {
          updateStudyNote: {
            studyNote: null,
            errors: [{attribute: 'base', message: 'Note not found'}],
          },
        },
      })

      await expect(
        api.updateNote('999', {
          id: '999',
          reaction: [],
          highlightData: STUDY_NOTE_FIXTURE.highlightData as Parameters<
            typeof api.updateNote
          >[1]['highlightData'],
        }),
      ).rejects.toThrow('Note not found')
    })
  })

  describe('deleteNote', () => {
    it('deletes a note without returning data', async () => {
      mockGraphQL({
        data: {deleteStudyNote: {studyNoteId: '1', errors: []}},
      })

      await expect(api.deleteNote('1')).resolves.toBeUndefined()
    })

    it('throws when mutation returns errors', async () => {
      mockGraphQL({
        data: {
          deleteStudyNote: {
            studyNoteId: null,
            errors: [{attribute: 'base', message: 'Note not found'}],
          },
        },
      })

      await expect(api.deleteNote('999')).rejects.toThrow('Note not found')
    })
  })

  describe('error handling', () => {
    it('throws on top-level GraphQL errors', async () => {
      mockGraphQL({
        errors: [{message: 'Not authorized'}, {message: 'Invalid query'}],
      })

      await expect(api.deleteNote('1')).rejects.toThrow('Not authorized; Invalid query')
    })

    it('throws when no data is returned', async () => {
      mockGraphQL({data: null})

      await expect(api.deleteNote('1')).rejects.toThrow('No data returned from GraphQL')
    })
  })
})

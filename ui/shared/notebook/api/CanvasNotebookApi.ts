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

import doFetchApi from '@canvas/do-fetch-api-effect'
import type {
  CreateNoteInputType,
  GetNotesParams,
  NotebookApi,
  NoteType,
  PaginatedNotes,
  UpdateNoteInputType,
} from '@instructure/platform-notebook'
import {
  CREATE_NOTE_MUTATION,
  DELETE_NOTE_MUTATION,
  GET_NOTES_QUERY,
  UPDATE_NOTE_MUTATION,
} from './queries'

interface GraphQLResponse<TData> {
  data?: TData
  errors?: Array<{message: string}>
}

interface StudyNoteFields {
  _id: string
  courseId: string
  userText?: string
  reactions: string[]
  highlightData: Record<string, unknown>
  learningObjectId: string
  learningObjectType: string
  userId: string
  createdAt: string
  updatedAt: string
}

interface StudyNotesConnectionData {
  studyNotesConnection: {
    nodes: StudyNoteFields[]
    pageInfo: {
      totalCount?: number | null
      totalNrOfPages?: number | null
    }
  }
}

interface CreateStudyNoteData {
  createStudyNote: {
    studyNote: StudyNoteFields
    errors?: Array<{attribute: string; message: string}>
  }
}

interface UpdateStudyNoteData {
  updateStudyNote: {
    studyNote: StudyNoteFields
    errors?: Array<{attribute: string; message: string}>
  }
}

interface DeleteStudyNoteData {
  deleteStudyNote: {
    studyNoteId: string
    errors?: Array<{attribute: string; message: string}>
  }
}

function mapStudyNote(note: StudyNoteFields): NoteType {
  return {
    id: note._id,
    rootAccountUuid: '',
    courseId: String(note.courseId),
    objectId: note.learningObjectId,
    objectType: note.learningObjectType,
    userText: note.userText,
    reaction: note.reactions as NoteType['reaction'],
    highlightData: note.highlightData as NoteType['highlightData'],
    userId: String(note.userId),
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

async function executeGraphQL<TData>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<TData> {
  const {json} = await doFetchApi<GraphQLResponse<TData>>({
    path: '/api/graphql',
    method: 'POST',
    body: {query, variables},
  })

  if (!json) throw new Error('No response from GraphQL')

  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map(e => e.message).join('; '))
  }

  if (!json.data) throw new Error('No data returned from GraphQL')

  return json.data
}

export class CanvasNotebookApi implements NotebookApi {
  private courseId: string

  constructor(courseId: string) {
    this.courseId = courseId
  }

  async getNotes(params: GetNotesParams): Promise<PaginatedNotes> {
    const {filter} = params
    const canvasFilter = filter
      ? {
          learningObject: filter.learningObject
            ? {
                learningObjectId: filter.learningObject.id,
                learningObjectType: filter.learningObject.type,
              }
            : undefined,
          reactions: filter.reactions,
        }
      : undefined

    const offset = params.offset ?? 0
    const data = await executeGraphQL<StudyNotesConnectionData>(GET_NOTES_QUERY, {
      courseId: this.courseId,
      filter: canvasFilter,
      first: params.pageSize ?? 10,
      after: offset > 0 ? btoa(String(offset)) : null,
    })

    const {nodes, pageInfo} = data.studyNotesConnection
    return {
      notes: nodes.map(mapStudyNote),
      pageInfo: {
        totalCount: pageInfo.totalCount ?? undefined,
        totalNrOfPages: pageInfo.totalNrOfPages ?? undefined,
      },
    }
  }

  async createNote(input: CreateNoteInputType): Promise<NoteType> {
    const data = await executeGraphQL<CreateStudyNoteData>(CREATE_NOTE_MUTATION, {
      courseId: this.courseId,
      learningObjectId: input.objectId,
      learningObjectType: input.objectType,
      userText: input.userText,
      reactions: input.reaction,
      highlightData: input.highlightData,
    })

    if (data.createStudyNote.errors?.length) {
      throw new Error(data.createStudyNote.errors.map(e => e.message).join('; '))
    }

    return mapStudyNote(data.createStudyNote.studyNote)
  }

  async updateNote(id: string, input: UpdateNoteInputType): Promise<NoteType> {
    const data = await executeGraphQL<UpdateStudyNoteData>(UPDATE_NOTE_MUTATION, {
      id,
      userText: input.userText,
      reactions: input.reaction,
      highlightData: input.highlightData,
    })

    if (data.updateStudyNote.errors?.length) {
      throw new Error(data.updateStudyNote.errors.map(e => e.message).join('; '))
    }

    return mapStudyNote(data.updateStudyNote.studyNote)
  }

  async deleteNote(id: string): Promise<void> {
    const data = await executeGraphQL<DeleteStudyNoteData>(DELETE_NOTE_MUTATION, {id})

    if (data.deleteStudyNote.errors?.length) {
      throw new Error(data.deleteStudyNote.errors.map(e => e.message).join('; '))
    }
  }
}

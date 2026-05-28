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

const STUDY_NOTE_FIELDS = `
  fragment NotebookStudyNoteFields on StudyNote {
    _id
    courseId
    userText
    reactions
    highlightData
    learningObjectId
    learningObjectType
    userId
    createdAt
    updatedAt
  }
`

export const GET_NOTES_QUERY = `
  query NotebookGetNotes(
    $courseId: ID!
    $first: Int
    $after: String
    $filter: StudyNoteFilterInput
  ) {
    studyNotesConnection(
      courseId: $courseId
      filter: $filter
      first: $first
      after: $after
    ) {
      nodes {
        ...NotebookStudyNoteFields
      }
      pageInfo {
        totalCount
        totalNrOfPages
      }
    }
  }
  ${STUDY_NOTE_FIELDS}
`

export const CREATE_NOTE_MUTATION = `
  mutation NotebookCreateStudyNote(
    $courseId: ID!
    $learningObjectId: String!
    $learningObjectType: LearningObjectType!
    $userText: String
    $reactions: [String!]
    $highlightData: JSON
  ) {
    createStudyNote(input: {
      courseId: $courseId
      learningObjectId: $learningObjectId
      learningObjectType: $learningObjectType
      userText: $userText
      reactions: $reactions
      highlightData: $highlightData
    }) {
      studyNote {
        ...NotebookStudyNoteFields
      }
      errors { attribute message }
    }
  }
  ${STUDY_NOTE_FIELDS}
`

export const UPDATE_NOTE_MUTATION = `
  mutation NotebookUpdateStudyNote(
    $id: ID!
    $userText: String
    $reactions: [String!]
    $highlightData: JSON
  ) {
    updateStudyNote(input: {
      id: $id
      userText: $userText
      reactions: $reactions
      highlightData: $highlightData
    }) {
      studyNote {
        ...NotebookStudyNoteFields
      }
      errors { attribute message }
    }
  }
  ${STUDY_NOTE_FIELDS}
`

export const DELETE_NOTE_MUTATION = `
  mutation NotebookDeleteStudyNote($id: ID!) {
    deleteStudyNote(input: { id: $id }) {
      studyNoteId
      errors { attribute message }
    }
  }
`

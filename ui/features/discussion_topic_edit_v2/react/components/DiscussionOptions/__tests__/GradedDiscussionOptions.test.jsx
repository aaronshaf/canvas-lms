/*
 * Copyright (C) 2023 - present Instructure, Inc.
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

import {render} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import React from 'react'

import {GradedDiscussionOptions} from '../GradedDiscussionOptions'

const server = setupServer()

const defaultProps = {
  assignmentGroups: [],
  pointsPossible: 10,
  setPointsPossible: () => {},
  displayGradeAs: 'points',
  setDisplayGradeAs: () => {},
  assignmentGroup: '',
  setAssignmentGroup: () => {},
  peerReviewAssignment: '',
  setPeerReviewAssignment: () => {},
  peerReviewsPerStudent: 0,
  setPeerReviewsPerStudent: () => {},
  peerReviewDueDate: '',
  setPeerReviewDueDate: () => {},
  assignedInfoList: [],
  setAssignedInfoList: () => {},
  isCheckpoints: false,
  canManageAssignTo: true,
}

const SECTIONS_URL = `/api/v1/courses/1/sections`
const STUDENTS_URL = `/api/v1/courses/1/users`
const COURSE_SETTINGS_URL = `/api/v1/courses/1/settings`
const GRAPHQL_URL = `/api/graphql`

const renderGradedDiscussionOptions = (props = {}) => {
  return render(<GradedDiscussionOptions {...defaultProps} {...props} />)
}
describe('GradedDiscussionOptions', () => {
  beforeEach(() => {
    ENV.DISCUSSION_TOPIC = {
      ATTRIBUTES: {
        id: '1',
      },
    }
  })

  it('renders', () => {
    const {getAllByText, getByText} = renderGradedDiscussionOptions()
    expect(getByText('Points Possible')).toBeInTheDocument()
    expect(getByText('Display Grade As')).toBeInTheDocument()
    expect(getByText('Assignment Group')).toBeInTheDocument()
    expect(getAllByText('Peer Reviews')).toHaveLength(1)
    expect(getByText('Assignment Settings')).toBeInTheDocument()
  })

  it('renders with null points possible value', () => {
    const {getAllByText, getByText} = renderGradedDiscussionOptions({pointsPossible: null})
    expect(getByText('Points Possible')).toBeInTheDocument()
    expect(getByText('Display Grade As')).toBeInTheDocument()
    expect(getByText('Assignment Group')).toBeInTheDocument()
    expect(getAllByText('Peer Reviews')).toHaveLength(1)
    expect(getByText('Assignment Settings')).toBeInTheDocument()
  })

  describe('Checkpoints', () => {
    it('renders the section Checkpoint Settings when the checkpoints checkbox is selected', () => {
      const {getByText} = renderGradedDiscussionOptions({isCheckpoints: true})
      expect(getByText('Checkpoint Settings')).toBeInTheDocument()
    })
  })

  describe('Sync to SIS', () => {
    afterEach(() => {
      delete ENV.POST_TO_SIS
      delete ENV.SIS_NAME
    })

    it('renders the Sync to SIS checkbox unchecked by default when SIS syncing is on', () => {
      // ENV.POST_TO_SIS gates the checkbox on (set when the account has SIS syncing enabled).
      // The form passes postToSis=false for a new discussion, so the box must render unchecked.
      ENV.POST_TO_SIS = true
      ENV.SIS_NAME = 'SIS'
      const {getByRole} = renderGradedDiscussionOptions({postToSis: false})
      const checkbox = getByRole('checkbox', {
        name: "Include this assignment's grades when syncing to your school's Student Information System",
      })
      expect(checkbox).not.toBeChecked()
    })

    it('does not render the Sync to SIS checkbox when ENV.POST_TO_SIS is off', () => {
      ENV.POST_TO_SIS = false
      const {queryByRole} = renderGradedDiscussionOptions({postToSis: false})
      expect(
        queryByRole('checkbox', {
          name: "Include this assignment's grades when syncing to your school's Student Information System",
        }),
      ).not.toBeInTheDocument()
    })
  })

  describe('with selective release', () => {
    beforeAll(() => server.listen())
    afterAll(() => server.close())

    beforeEach(() => {
      server.use(
        http.get(SECTIONS_URL, () => {
          return HttpResponse.json([])
        }),
        http.get(STUDENTS_URL, () => {
          return HttpResponse.json([])
        }),
        http.get(COURSE_SETTINGS_URL, () => {
          return HttpResponse.json({hide_final_grades: false})
        }),
        http.post(GRAPHQL_URL, () => {
          return HttpResponse.json({
            data: {
              course: {
                usersConnection: {
                  pageInfo: {hasNextPage: false, endCursor: null},
                  nodes: [],
                },
              },
            },
          })
        }),
      )
      ENV.COURSE_ID = '1'
    })

    afterEach(() => {
      server.resetHandlers()
    })

    it('does not render assignment settings if canManageAssignTo is false', () => {
      const {getByText, queryByText, rerender} = renderGradedDiscussionOptions({
        canManageAssignTo: true,
      })
      expect(getByText('Assignment Settings')).toBeInTheDocument()
      rerender(<GradedDiscussionOptions {...defaultProps} canManageAssignTo={false} />)
      expect(queryByText('Assignment Settings')).not.toBeInTheDocument()
    })
  })
})

/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import StudentAnnotationAttempt from '../StudentAnnotationAttempt'
import {render, waitFor} from '@testing-library/react'
import {mockAssignmentAndSubmission} from '@canvas/assignments/graphql/studentMocks'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import React from 'react'

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

async function makeProps(overrides) {
  const assignmentAndSubmission = await mockAssignmentAndSubmission(overrides)
  const props = {
    ...assignmentAndSubmission,
    title: 'Title',
    createSubmissionDraft: vi.fn().mockResolvedValue({}),
  }
  return props
}

// This test is isolated in its own file due to slow execution time (>2s)
// caused by mockAssignmentAndSubmission initialization overhead.
describe('StudentAnnotationAttempt draft submission', () => {
  it('sets submission_attempt=draft when attempt index is 0', async () => {
    let capturedBody = null
    server.use(
      http.post('/api/v1/canvadoc_session', async ({request}) => {
        capturedBody = await request.json()
        return HttpResponse.json({canvadocs_session_url: 'CANVADOCS_SESSION_URL'})
      }),
    )

    const props = await makeProps({
      Submission: {
        state: 'graded',
        attempt: 0,
      },
    })

    render(<StudentAnnotationAttempt {...props} />)
    await waitFor(() => {
      expect(capturedBody).toEqual({submission_attempt: 'draft', submission_id: '1'})
    })
  })
})

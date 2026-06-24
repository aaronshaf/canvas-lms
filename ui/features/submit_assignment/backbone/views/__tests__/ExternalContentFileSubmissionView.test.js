/*
 * Copyright (C) 2017 - present Instructure, Inc.
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

import Backbone from '@canvas/backbone'
import ExternalContentFileSubmissionView from '../ExternalContentFileSubmissionView'
import $ from 'jquery'
import '@canvas/jquery/jquery.disableWhileLoading'
import '@canvas/rails-flash-notifications'
import fakeENV from '@canvas/test-utils/fakeENV'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import {waitFor} from '@testing-library/dom'

vi.mock('@canvas/util/globalUtils', () => ({
  windowAlert: vi.fn(),
  reloadWindow: vi.fn(),
}))

const container = document.createElement('div')
container.setAttribute('id', 'fixtures')
document.body.appendChild(container)

const contentItem = {
  '@type': 'FileItem',
  url: 'http://lti.example.com/content/launch/42',
  name: 'FileDude',
  comment: 'Foo all the bars!',
  eula_agreement_timestamp: 1522419910,
}

const server = setupServer()
let capturedRequest

let model
let view

describe('ExternalContentFileSubmissionView#uploadFileFromUrl', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    capturedRequest = null
    server.use(
      http.post('*', async ({request}) => {
        const url = new URL(request.url)
        const body = await request.json().catch(() => null)
        capturedRequest = {pathname: url.pathname, search: url.search, body}
        return HttpResponse.json({upload_url: null})
      }),
    )
    fakeENV.setup()
    window.ENV.COURSE_ID = 42
    window.ENV.current_user_id = 5
    window.ENV.SUBMIT_ASSIGNMENT = {
      ID: 24,
    }
    model = new Backbone.Model(contentItem)
    const el = $('<div><button class="submit_button">Submit</button></div>')
    $('#fixtures').append(el)
    view = new ExternalContentFileSubmissionView({el})
  })

  afterEach(() => {
    fakeENV.teardown()
    $('#fixtures').empty()
    server.resetHandlers()
  })

  test('hits the course url', async () => {
    view.uploadFileFromUrl({}, model)
    await waitFor(() =>
      expect(capturedRequest?.pathname).toBe(
        '/api/v1/courses/42/assignments/24/submissions/5/files',
      ),
    )
  })

  test('hits the group url', async () => {
    window.ENV.SUBMIT_ASSIGNMENT.GROUP_ID_FOR_USER = 2
    view.uploadFileFromUrl({}, model)
    await waitFor(() =>
      expect(capturedRequest?.pathname + capturedRequest?.search).toBe(
        '/api/v1/groups/2/files?assignment_id=24&submit_assignment=1',
      ),
    )
  })

  test('sends the eula agreement timestamp to the submission endpoint', async () => {
    view.uploadFileFromUrl({}, model)
    await waitFor(() =>
      expect(capturedRequest?.body?.eula_agreement_timestamp).toBe(
        model.get('eula_agreement_timestamp'),
      ),
    )
  })

  test('sends the comment to the submission endpoint', async () => {
    view.uploadFileFromUrl({}, model)
    await waitFor(() => expect(capturedRequest?.body?.comment).toBe(model.get('comment')))
  })
})

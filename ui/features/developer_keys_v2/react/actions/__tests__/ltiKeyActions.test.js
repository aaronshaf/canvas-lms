/*
 * Copyright (C) 2018 - present Instructure, Inc.
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
import actions from '../developerKeysActions'
import $ from 'jquery'

const server = setupServer()

beforeAll(() => server.listen({onUnhandledRequest: 'bypass'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('saveLtiToolConfiguration', () => {
  let dispatch

  beforeEach(() => {
    dispatch = vi.fn()
  })

  const save = async (includeUrl = false) => {
    await actions.saveLtiToolConfiguration({
      account_id: '1',
      developer_key: {name: 'test'},
      settings: {test: 'config'},
      ...(includeUrl ? {settings_url: 'test.url'} : {}),
    })(dispatch)
  }

  it('sets the developer key with provided fields', () => {
    server.use(
      http.post('*/api/lti/accounts/1/developer_keys/tool_configuration', () =>
        HttpResponse.json({
          tool_configuration: {settings: {test: 'config'}, developer_key_id: '1'},
          developer_key: {id: 100000000087, name: 'test key'},
        }),
      ),
    )
    save()
    expect(dispatch).toHaveBeenCalledWith(actions.setEditingDeveloperKey({name: 'test'}))
  })

  describe('on successful response', () => {
    it('prepends the developer key to the list', async () => {
      server.use(
        http.post('*/api/lti/accounts/1/developer_keys/tool_configuration', () =>
          HttpResponse.json({
            tool_configuration: {settings: {test: 'config'}, developer_key_id: '1'},
            developer_key: {id: 100000000087, name: 'test key'},
          }),
        ),
      )

      await save()

      expect(dispatch).toHaveBeenCalledWith(
        actions.listDeveloperKeysPrepend({
          id: 100000000087,
          name: 'test key',
          tool_configuration: {test: 'config'},
        }),
      )
    })
  })

  describe('on error response', () => {
    beforeEach(() => {
      server.use(
        http.post('*/api/lti/accounts/1/developer_keys/tool_configuration', () =>
          HttpResponse.json(
            {
              errors: [
                {message: '["Thats no moon...its a space station."]'},
                {message: '["Its too big to be a space station!"]'},
              ],
            },
            {status: 400},
          ),
        ),
      )
      $.flashError = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('calls flashError for each message', async () => {
      await expect(save()).rejects.toThrow()
      expect($.flashError).toHaveBeenCalledTimes(2)
      expect(dispatch).toHaveBeenCalledWith(actions.setEditingDeveloperKey(false))
    })
  })
})

describe('updateLtiKey', () => {
  const scopes = ['https://www.test.com/scope']
  const redirectUris = 'https://www.test.com'
  const disabledPlacements = ['account_navigation', 'course_navigaiton']
  const developerKeyId = 123
  const toolConfiguration = {}
  const customFields = 'foo=bar\r\nkey=value'
  const developerKey = {
    scopes,
    redirect_uris: redirectUris,
    name: 'Test',
    notes: 'This is a test',
    email: 'test@example.com',
    access_token_count: 1,
  }

  const update = () => {
    return actions.updateLtiKey(
      developerKey,
      disabledPlacements,
      developerKeyId,
      toolConfiguration,
      customFields,
    )
  }

  it('makes a request to the tool config update endpoint', async () => {
    let capturedBody = null
    server.use(
      http.put(
        `*/api/lti/developer_keys/${developerKeyId}/tool_configuration`,
        async ({request}) => {
          capturedBody = await request.json()
          return HttpResponse.json({developer_key: {}, tool_configuration: {}})
        },
      ),
    )

    await update()

    expect(capturedBody).toEqual({
      developer_key: {
        scopes,
        redirect_uris: redirectUris,
        name: developerKey.name,
        notes: developerKey.notes,
        email: developerKey.email,
      },
      tool_configuration: {
        disabled_placements: disabledPlacements,
        settings: toolConfiguration,
        custom_fields: customFields,
      },
    })
  })
})

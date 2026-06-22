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

import {AlertManagerContext} from '@instructure/platform-alerts'
import {ApolloProvider} from '@apollo/client'
import ComposeModalContainer from '../ComposeModalContainer/ComposeModalContainer'
import {fireEvent, render, waitFor} from '@testing-library/react'
import {mswClient} from '../../../../../shared/msw/mswClient'
import React from 'react'
import {ConversationContext} from '../../../util/constants'
import fakeENV from '@canvas/test-utils/fakeENV'

describe('ComposeModalContainer body', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
    fakeENV.setup({
      current_user_id: '1',
      CONVERSATIONS: {
        ATTACHMENTS_FOLDER_ID: 1,
        // Skip the "Please select a course" validation so the message can send.
        CAN_MESSAGE_ACCOUNT_CONTEXT: true,
      },
    })
  })

  afterEach(() => {
    fakeENV.teardown()
  })

  const setup = ({createConversation = vi.fn()} = {}) =>
    render(
      <ApolloProvider client={mswClient}>
        <AlertManagerContext.Provider value={{setOnFailure: vi.fn(), setOnSuccess: vi.fn()}}>
          <ConversationContext.Provider value={{isSubmissionCommentsType: false}}>
            <ComposeModalContainer
              open={true}
              onDismiss={vi.fn()}
              createConversation={createConversation}
              addConversationMessage={vi.fn()}
              createSubmissionComment={vi.fn()}
              courses={{
                enrollments: [],
                favoriteCoursesConnection: {nodes: []},
                favoriteGroupsConnection: {nodes: []},
              }}
              onSelectedIdsChange={vi.fn()}
              selectedIds={[{_id: '1', id: '1'}]}
              setSendingMessage={vi.fn()}
              sendingMessage={false}
            />
          </ConversationContext.Provider>
        </AlertManagerContext.Provider>
      </ApolloProvider>,
    )

  it('passes plain-text special characters in the body verbatim to the mutation', async () => {
    const createConversation = vi.fn()
    const {findByTestId, getByTestId} = setup({createConversation})

    // Characters a user legitimately types that the old client-side sanitizeHTML
    // would entity-encode (& -> &amp;, < -> &lt;) or silently drop (<draft>).
    const rawBody = '5 < 10 & <draft>'

    const bodyInput = await findByTestId('message-body')
    fireEvent.change(bodyInput, {target: {value: rawBody}})

    fireEvent.click(getByTestId('send-button'))

    await waitFor(() => {
      expect(createConversation).toHaveBeenCalled()
    })
    expect(createConversation.mock.calls[0][0].variables.body).toBe(rawBody)
  })
})

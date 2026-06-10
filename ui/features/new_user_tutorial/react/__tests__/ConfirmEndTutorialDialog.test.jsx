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

import React from 'react'
import {render, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import * as globalUtils from '@canvas/util/globalUtils'
import ConfirmEndTutorialDialog from '../ConfirmEndTutorialDialog'

const API_URL = '/api/v1/users/self/features/flags/new_user_tutorial_on_off'

describe('ConfirmEndTutorialDialog Spec', () => {
  const server = setupServer()

  beforeAll(() => server.listen())
  beforeEach(() => vi.spyOn(globalUtils, 'reloadWindow').mockImplementation(() => {}))
  afterEach(() => {
    server.resetHandlers()
    vi.restoreAllMocks()
  })
  afterAll(() => server.close())

  const defaultProps = {
    isOpen: true,
    handleRequestClose() {},
  }

  test('handleOkayButtonClick calls the proper api endpoint and data', async () => {
    let capturedBody
    server.use(
      http.put(API_URL, async ({request}) => {
        capturedBody = await request.json()
        return HttpResponse.json({}, {status: 200})
      }),
    )

    const user = userEvent.setup()
    const {getByRole} = render(<ConfirmEndTutorialDialog {...defaultProps} />)
    const okButton = getByRole('button', {name: /okay/i})
    await user.click(okButton)

    await waitFor(() => {
      expect(capturedBody).toEqual({state: 'off'})
    })
  })

  test('handleOkayButtonClick calls onSuccessFunc after calling the api', async () => {
    server.use(
      http.put(API_URL, () => {
        return HttpResponse.json({}, {status: 200})
      }),
    )

    const user = userEvent.setup()
    const onSuccessSpy = vi
      .spyOn(ConfirmEndTutorialDialog, 'onSuccess')
      .mockImplementation(() => {})
    const {getByRole} = render(<ConfirmEndTutorialDialog {...defaultProps} />)
    const okButton = getByRole('button', {name: /okay/i})
    await user.click(okButton)

    await waitFor(() => {
      expect(onSuccessSpy).toHaveBeenCalled()
    })
  })

  test('cancel button does not call the api', async () => {
    let apiCalled = false
    server.use(
      http.put(API_URL, () => {
        apiCalled = true
        return HttpResponse.json({})
      }),
    )

    const handleRequestClose = vi.fn()
    const user = userEvent.setup()
    const {getByRole} = render(
      <ConfirmEndTutorialDialog {...defaultProps} handleRequestClose={handleRequestClose} />,
    )
    await user.click(getByRole('button', {name: /cancel/i}))

    expect(apiCalled).toBe(false)
    expect(handleRequestClose).toHaveBeenCalled()
  })

  test('does not call onSuccess when api returns an error', async () => {
    server.use(http.put(API_URL, () => new HttpResponse(null, {status: 500})))

    const rejectionCaught = new Promise(resolve => process.once('unhandledRejection', resolve))

    const onSuccessSpy = vi
      .spyOn(ConfirmEndTutorialDialog, 'onSuccess')
      .mockImplementation(() => {})
    const user = userEvent.setup()
    const {getByRole} = render(<ConfirmEndTutorialDialog {...defaultProps} />)
    await user.click(getByRole('button', {name: /okay/i}))

    const err = await rejectionCaught
    expect(err.message).toContain('500')
    expect(onSuccessSpy).not.toHaveBeenCalled()
  })
})

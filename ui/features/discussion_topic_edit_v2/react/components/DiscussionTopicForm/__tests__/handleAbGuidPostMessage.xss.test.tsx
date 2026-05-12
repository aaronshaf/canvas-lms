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

import {handleAbGuidPostMessage} from '../DiscussionTopicForm'

const VALID_GUID = '1E20776E-7053-11DF-8EBF-BE719DFF4B22'
const TRUSTED_ORIGIN = 'https://canvas.example.test'

const buildEvent = (
  origin: string | undefined,
  data: unknown,
): Pick<MessageEvent, 'origin' | 'data'> => ({origin: origin as string, data})

const buildPayload = () => ({
  subject: 'assignment.set_ab_guid',
  data: [VALID_GUID],
})

describe('handleAbGuidPostMessage — XSS regression at postMessage origin', () => {
  let setAbGuid: ReturnType<typeof vi.fn>
  let originalEnv: typeof window.ENV

  beforeEach(() => {
    setAbGuid = vi.fn()
    originalEnv = window.ENV
    window.ENV = {...window.ENV, DEEP_LINKING_POST_MESSAGE_ORIGIN: TRUSTED_ORIGIN}
  })

  afterEach(() => {
    window.ENV = originalEnv
  })

  it('ignores a valid-payload message from a foreign origin', () => {
    handleAbGuidPostMessage(
      buildEvent('https://evil.example', buildPayload()) as MessageEvent,
      setAbGuid,
    )
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('ignores a valid-payload message from a typosquat origin', () => {
    handleAbGuidPostMessage(
      buildEvent('https://canvas.instructurer.com', buildPayload()) as MessageEvent,
      setAbGuid,
    )
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('ignores a valid-payload message from origin "" (sandbox iframe)', () => {
    handleAbGuidPostMessage(buildEvent('', buildPayload()) as MessageEvent, setAbGuid)
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('ignores a message when ENV has no DEEP_LINKING_POST_MESSAGE_ORIGIN configured', () => {
    delete (window.ENV as Partial<typeof window.ENV>).DEEP_LINKING_POST_MESSAGE_ORIGIN
    handleAbGuidPostMessage(
      buildEvent('https://evil.example', buildPayload()) as MessageEvent,
      setAbGuid,
    )
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('ignores a message when both event.origin and trusted origin are undefined', () => {
    delete (window.ENV as Partial<typeof window.ENV>).DEEP_LINKING_POST_MESSAGE_ORIGIN
    handleAbGuidPostMessage(buildEvent(undefined, buildPayload()) as MessageEvent, setAbGuid)
    expect(setAbGuid).not.toHaveBeenCalled()
  })

  it('still writes guids when origin matches and payload validates', () => {
    handleAbGuidPostMessage(buildEvent(TRUSTED_ORIGIN, buildPayload()) as MessageEvent, setAbGuid)
    expect(setAbGuid).toHaveBeenCalledTimes(1)
    expect(setAbGuid).toHaveBeenCalledWith([VALID_GUID])
  })

  it('still rejects an invalid-format guid even from the trusted origin', () => {
    handleAbGuidPostMessage(
      buildEvent(TRUSTED_ORIGIN, {
        subject: 'assignment.set_ab_guid',
        data: ['not-a-uuid'],
      }) as MessageEvent,
      setAbGuid,
    )
    expect(setAbGuid).not.toHaveBeenCalled()
  })
})

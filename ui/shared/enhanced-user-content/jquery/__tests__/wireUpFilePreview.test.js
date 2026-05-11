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

import {wireUpFilePreview} from '../index'

const showFilePreview = vi.fn()

vi.mock('../../react/showFilePreview', () => ({
  showFilePreview: (...args) => showFilePreview(...args),
}))

describe('wireUpFilePreview postMessage origin guard', () => {
  let listeners

  beforeEach(() => {
    showFilePreview.mockClear()
    listeners = []
    const realAdd = window.addEventListener.bind(window)
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
      if (type === 'message') listeners.push(fn)
      return realAdd(type, fn, opts)
    })
    window.ENV = {}
    wireUpFilePreview()
  })

  afterEach(() => {
    listeners.forEach(fn => window.removeEventListener('message', fn))
    vi.restoreAllMocks()
    delete window.ENV
  })

  const post = origin =>
    new Promise(resolve => {
      // jsdom won't let dispatched MessageEvents have a non-empty origin via
      // dispatchEvent, so call the registered handler directly with a synthetic
      // event object — that's what the production handler actually receives.
      listeners.forEach(fn =>
        fn({origin, data: {subject: 'preview_file', file_id: '123', verifier: 'v'}}),
      )
      // Allow the dynamic import inside showFilePreviewInOverlayHandler to settle.
      setTimeout(resolve, 0)
    })

  it('ignores messages from a foreign origin', async () => {
    await post('https://evil.example')
    expect(showFilePreview).not.toHaveBeenCalled()
  })

  it('dispatches messages from window.location.origin', async () => {
    await post(window.location.origin)
    expect(showFilePreview).toHaveBeenCalledWith('123', 'v', undefined, undefined, undefined)
  })

  it('honors ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN as the trusted origin', async () => {
    listeners.forEach(fn => window.removeEventListener('message', fn))
    listeners = []
    window.ENV = {DEEP_LINKING_POST_MESSAGE_ORIGIN: 'https://canvas.test'}
    wireUpFilePreview()

    await post('https://evil.example')
    expect(showFilePreview).not.toHaveBeenCalled()

    await post('https://canvas.test')
    expect(showFilePreview).toHaveBeenCalledTimes(1)
  })

  it('does not throw when event.data is null', async () => {
    expect(() =>
      listeners.forEach(fn => fn({origin: window.location.origin, data: null})),
    ).not.toThrow()
    expect(showFilePreview).not.toHaveBeenCalled()
  })
})

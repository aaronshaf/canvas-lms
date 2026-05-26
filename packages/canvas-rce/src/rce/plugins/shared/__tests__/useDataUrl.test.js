/*
 * Copyright (C) 2019 - present Instructure, Inc.
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

import {act, renderHook} from '@testing-library/react'
import useDataUrl from '../useDataUrl'
import fetchMock from 'fetch-mock'

const flushPromises = () => new Promise(setTimeout)

describe('useDataUrl()', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'FileReader', {
      writable: true,
      // Must use function (not arrow) — vitest 4.x requires constructable mocks.
      value: vi.fn(function MockFileReader() {
        return {
          readAsDataURL() {
            this.onloadend()
          },
          result: 'data:image/png;base64,asdfasdfjksdf==',
        }
      }),
    })
  })

  const subject = () => renderHook(() => useDataUrl())

  beforeEach(() => {
    fetchMock.mock('/foo/bar.png', {})
  })

  afterEach(() => {
    vi.clearAllMocks()
    fetchMock.restore('/foo/bar.png')
  })

  it('uses correct initial state', () => {
    const {result} = subject()

    expect(result.current).toMatchObject({
      dataUrl: '',
      dataLoading: false,
      dataError: undefined,
    })
  })

  describe('after fetching a resource', () => {
    let current

    beforeEach(async () => {
      const {result} = subject()
      const {setUrl} = result.current

      await act(async () => {
        setUrl('/foo/bar.png')
        await flushPromises()
      })

      current = result.current
    })

    it('sets the data URL', () => {
      expect(current.dataUrl).toEqual('data:image/png;base64,asdfasdfjksdf==')
    })

    it('sets "loading" to false after loading completes', () => {
      expect(current.dataLoading).toEqual(false)
    })
  })

  describe('when an error occurs generating the data URL', () => {
    let current

    beforeEach(async () => {
      Object.defineProperty(global, 'FileReader', {
        writable: true,
        // Must use function (not arrow) — vitest 4.x requires constructable mocks.
        value: vi.fn(function MockFileReaderError() {
          return {
            readAsDataURL() {
              // eslint-disable-next-line no-throw-literal
              throw 'an error occured!'
            },
            result: 'data:image/png;base64,asdfasdfjksdf==',
          }
        }),
      })

      const {result} = subject()
      const {setUrl} = result.current

      await act(async () => {
        setUrl('/foo/bar.png')
        await flushPromises()
      })

      current = result.current
    })

    it('sets the error', () => {
      expect(current.dataError).toEqual('an error occured!')
    })

    it('sets loading to "false', () => {
      expect(current.dataLoading).toEqual(false)
    })
  })
})

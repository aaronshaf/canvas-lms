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

import React from 'react'
import {renderHook, act, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {useBulkManageDifferentiationTags} from '../useBulkManageDifferentiationTags'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'

vi.mock('@instructure/platform-query', () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

const server = setupServer()

describe('useBulkManageDifferentiationTags', () => {
  let queryClient: QueryClient

  beforeAll(() => server.listen())
  afterAll(() => server.close())

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {retry: false},
        mutations: {retry: false},
      },
    })
  })

  afterEach(() => {
    server.resetHandlers()
    queryClient.clear()
  })

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const defaultVariables = {
    courseId: 1,
    operations: {create: [{name: 'Tag A'}]},
  }

  const successResponse = {
    created: [{group: {id: 10, name: 'Tag A', members_count: 0}}],
    updated: [],
    deleted: [],
    group_category: {id: 1, name: 'Category'},
  }

  it('resolves with the response json on success', async () => {
    server.use(
      http.post('*/group_categories/bulk_manage_differentiation_tag', () => {
        return HttpResponse.json(successResponse)
      }),
    )

    const {result} = renderHook(() => useBulkManageDifferentiationTags(), {wrapper})

    act(() => {
      result.current.mutate(defaultVariables)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual(successResponse)
  })

  it('throws a joined error message when errors is an array of objects with message fields', async () => {
    server.use(
      http.post('*/group_categories/bulk_manage_differentiation_tag', () => {
        return HttpResponse.json(
          {errors: [{message: 'Name is too long'}, {message: 'Category limit exceeded'}]},
          {status: 422},
        )
      }),
    )

    const {result} = renderHook(() => useBulkManageDifferentiationTags(), {wrapper})

    act(() => {
      result.current.mutate(defaultVariables)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('Name is too long, Category limit exceeded')
  })

  it('throws a joined error message when errors is an array of objects with type fields', async () => {
    server.use(
      http.post('*/group_categories/bulk_manage_differentiation_tag', () => {
        return HttpResponse.json(
          {errors: [{type: 'invalid_name'}, {type: 'limit_exceeded'}]},
          {status: 422},
        )
      }),
    )

    const {result} = renderHook(() => useBulkManageDifferentiationTags(), {wrapper})

    act(() => {
      result.current.mutate(defaultVariables)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('invalid_name, limit_exceeded')
  })

  it('throws the error string when errors is a string', async () => {
    server.use(
      http.post('*/group_categories/bulk_manage_differentiation_tag', () => {
        return HttpResponse.json(
          {errors: 'Something went wrong on the server'},
          {status: 422},
        )
      }),
    )

    const {result} = renderHook(() => useBulkManageDifferentiationTags(), {wrapper})

    act(() => {
      result.current.mutate(defaultVariables)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('Something went wrong on the server')
  })

  it('throws the default message when the error response has no errors field', async () => {
    server.use(
      http.post('*/group_categories/bulk_manage_differentiation_tag', () => {
        return HttpResponse.json({message: 'Internal Server Error'}, {status: 500})
      }),
    )

    const {result} = renderHook(() => useBulkManageDifferentiationTags(), {wrapper})

    act(() => {
      result.current.mutate(defaultVariables)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('Bulk manage differentiation tags failed')
  })
})

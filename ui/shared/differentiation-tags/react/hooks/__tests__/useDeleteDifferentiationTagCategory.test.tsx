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
import {useDeleteDifferentiationTagCategory} from '../useDeleteDifferentiationTagCategory'
import {setupServer} from 'msw/node'
import {http, HttpResponse} from 'msw'

vi.mock('@instructure/platform-query', () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

const server = setupServer()

describe('useDeleteDifferentiationTagCategory', () => {
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

  it('resolves with the response json on success', async () => {
    server.use(
      http.delete('/api/v1/group_categories/:id', () => {
        return HttpResponse.json({deleted: true, id: 1})
      }),
    )

    const {result} = renderHook(() => useDeleteDifferentiationTagCategory(), {wrapper})

    act(() => {
      result.current.mutate({differentiationTagCategoryId: 1})
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toEqual({deleted: true, id: 1})
  })

  it('throws "You do not have permission to delete this tag" on a 403', async () => {
    server.use(
      http.delete('/api/v1/group_categories/:id', () => {
        return HttpResponse.json({message: 'Forbidden'}, {status: 403})
      }),
    )

    const {result} = renderHook(() => useDeleteDifferentiationTagCategory(), {wrapper})

    act(() => {
      result.current.mutate({differentiationTagCategoryId: 1})
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('You do not have permission to delete this tag')
  })

  it('throws "Failed to delete Differentiation Tag Category" on other HTTP errors', async () => {
    server.use(
      http.delete('/api/v1/group_categories/:id', () => {
        return HttpResponse.json({message: 'Internal Server Error'}, {status: 500})
      }),
    )

    const {result} = renderHook(() => useDeleteDifferentiationTagCategory(), {wrapper})

    act(() => {
      result.current.mutate({differentiationTagCategoryId: 1})
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('Failed to delete Differentiation Tag Category')
  })

  it('throws "No data returned from the server" when the response has no JSON body', async () => {
    server.use(
      http.delete('/api/v1/group_categories/:id', () => {
        return new HttpResponse(null, {status: 200})
      }),
    )

    const {result} = renderHook(() => useDeleteDifferentiationTagCategory(), {wrapper})

    act(() => {
      result.current.mutate({differentiationTagCategoryId: 1})
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.message).toBe('No data returned from the server')
  })
})

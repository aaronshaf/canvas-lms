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

import {useAllModuleItems, getAllModuleItems} from '../useAllModuleItems'
import {moduleItemsFetchQueue} from '../useModuleItems'
import {renderHook} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'
import {waitFor} from '@testing-library/react'
import {setupServer} from 'msw/node'
import {graphql, HttpResponse} from 'msw'

const moduleId = 'mod-all'
const node1 = {id: 'item_1'}
const node2 = {id: 'item_2'}
const node3 = {id: 'item_3'}

const server = setupServer()

const renderUseAllModuleItems = (enabled = true) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  return renderHook(() => useAllModuleItems(moduleId, enabled, 'teacher'), {
    wrapper: ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}

describe('useAllModuleItems', () => {
  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    moduleItemsFetchQueue.clear()
  })
  afterAll(() => server.close())

  it('fetches a single page when hasNextPage is false', async () => {
    server.use(
      graphql.query('GetModuleItemsQuery', () =>
        HttpResponse.json({
          data: {
            legacyNode: {
              moduleItemsConnection: {
                edges: [{node: node1}, {node: node2}],
                pageInfo: {hasNextPage: false, endCursor: null},
              },
            },
          },
        }),
      ),
    )

    const {result} = renderUseAllModuleItems()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.moduleItems).toHaveLength(2)
    expect(result.current.data?.pageInfo).toEqual({hasNextPage: false, endCursor: null})
  })

  it('paginates across multiple pages and concatenates items', async () => {
    let calls = 0
    server.use(
      graphql.query('GetModuleItemsQuery', ({variables}) => {
        calls++
        if (variables.cursor == null) {
          return HttpResponse.json({
            data: {
              legacyNode: {
                moduleItemsConnection: {
                  edges: [{node: node1}],
                  pageInfo: {hasNextPage: true, endCursor: 'cursor-1'},
                },
              },
            },
          })
        }
        return HttpResponse.json({
          data: {
            legacyNode: {
              moduleItemsConnection: {
                edges: [{node: node2}, {node: node3}],
                pageInfo: {hasNextPage: false, endCursor: null},
              },
            },
          },
        })
      }),
    )

    const {result} = renderUseAllModuleItems()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(calls).toBe(2)
    expect(result.current.data?.moduleItems).toHaveLength(3)
    expect(result.current.data?.pageInfo).toEqual({hasNextPage: false, endCursor: null})
  })

  it('does not query when enabled is false', async () => {
    let called = false
    server.use(
      graphql.query('GetModuleItemsQuery', () => {
        called = true
        return HttpResponse.json({
          data: {
            legacyNode: {
              moduleItemsConnection: {edges: [], pageInfo: {hasNextPage: false, endCursor: null}},
            },
          },
        })
      }),
    )

    const {result} = renderUseAllModuleItems(false)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(called).toBe(false)
    expect(result.current.data).toBeUndefined()
  })
})

describe('getAllModuleItems', () => {
  beforeAll(() => server.listen())
  afterEach(() => {
    server.resetHandlers()
    moduleItemsFetchQueue.clear()
  })
  afterAll(() => server.close())

  it('concatenates items across multiple pages', async () => {
    server.use(
      graphql.query('GetModuleItemsQuery', ({variables}) => {
        if (variables.cursor == null) {
          return HttpResponse.json({
            data: {
              legacyNode: {
                moduleItemsConnection: {
                  edges: [{node: node1}],
                  pageInfo: {hasNextPage: true, endCursor: 'cursor-1'},
                },
              },
            },
          })
        }
        return HttpResponse.json({
          data: {
            legacyNode: {
              moduleItemsConnection: {
                edges: [{node: node2}, {node: node3}],
                pageInfo: {hasNextPage: false, endCursor: null},
              },
            },
          },
        })
      }),
    )

    const result = await getAllModuleItems(moduleId, 'teacher')

    expect(result.moduleItems.map(item => item.id)).toEqual(['item_1', 'item_2', 'item_3'])
    expect(result.pageInfo).toEqual({hasNextPage: false, endCursor: null})
  })

  it('propagates GraphQL errors from a page fetch to the caller', async () => {
    server.use(
      graphql.query('GetModuleItemsQuery', () => HttpResponse.json({errors: [{message: 'boom'}]})),
    )

    await expect(getAllModuleItems(moduleId, 'teacher')).rejects.toThrow('boom')
  })
})

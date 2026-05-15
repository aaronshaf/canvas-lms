/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import {useEffect} from 'react'
import {gql} from 'graphql-tag'
import PQueue from 'p-queue'
import {executeQuery} from '@canvas/graphql'
import {useQuery} from '@tanstack/react-query'
import type {
  ModuleItem,
  PaginatedNavigationGraphQLResult,
  PaginatedNavigationResponse,
} from '../../utils/types'
import {
  MODULE_ITEMS,
  MODULE_ITEMS_FETCH_CONCURRENCY,
  PAGE_SIZE,
  MODULE_ITEMS_QUERY_MAP,
} from '../../utils/constants'

const transformItems = (items: ModuleItem[], moduleId: string) =>
  items.map((item, index) => ({
    ...item,
    moduleId,
    index,
  }))

export const moduleItemsFetchQueue = new PQueue({concurrency: MODULE_ITEMS_FETCH_CONCURRENCY})

export function useModuleItemsFetchQueueCleanup() {
  useEffect(() => {
    return () => {
      moduleItemsFetchQueue.clear()
    }
  }, [])
}

export async function getModuleItems(
  moduleId: string,
  cursor: string | null,
  view: string = 'teacher',
  pageSize: number = PAGE_SIZE,
  signal?: AbortSignal,
): Promise<PaginatedNavigationResponse> {
  const persistedQuery = MODULE_ITEMS_QUERY_MAP[view]
  const query = gql`${persistedQuery}`

  const result = await moduleItemsFetchQueue.add(
    () =>
      executeQuery<PaginatedNavigationGraphQLResult>(query, {
        moduleId,
        cursor,
        first: pageSize,
      }),
    {signal},
  )

  const {moduleItemsConnection} = result.legacyNode || {}
  const edges = moduleItemsConnection?.edges || []
  const pageInfo = moduleItemsConnection?.pageInfo || {
    hasNextPage: false,
    endCursor: null,
  }

  return {
    moduleItems: transformItems(
      edges.map(edge => edge.node),
      moduleId,
    ),
    pageInfo,
  }
}

export function useModuleItems(
  moduleId: string,
  cursor: string | null,
  enabled: boolean,
  view: string = 'teacher',
) {
  return useQuery<PaginatedNavigationResponse, Error>({
    queryKey: [MODULE_ITEMS, moduleId, cursor],
    queryFn: ({signal}) => getModuleItems(moduleId, cursor, view, PAGE_SIZE, signal),
    enabled,
    staleTime: 15 * 60 * 1000,
  })
}

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

import {useCallback, useMemo} from 'react'
import {useParams} from 'react-router-dom'
import {keepPreviousData, useInfiniteQuery} from '@tanstack/react-query'
import {queryClient} from '@instructure/platform-query'
import type {RubricQueryResponse} from '../../types/Rubric'
import {
  RUBRICS_PER_PAGE,
  fetchAccountRubrics,
  fetchCourseRubrics,
  type RubricSortInput,
} from '../../queries/ViewRubricQueries'

type UseRubricsQueryParams = {
  selectedTab: string | undefined
  searchTerm: string
  sort: RubricSortInput
  workflowStates: string[]
}

export const useRubricsQuery = ({
  selectedTab,
  searchTerm,
  sort,
  workflowStates,
}: UseRubricsQueryParams) => {
  const {accountId, courseId} = useParams()
  const isAccount = !!accountId
  const isCourse = !!courseId

  const queryKeyBase = isAccount ? `accountRubrics-${accountId}` : `courseRubrics-${courseId}`

  const query = useInfiniteQuery<RubricQueryResponse>({
    queryKey: [queryKeyBase, selectedTab, searchTerm, sort],
    queryFn: async ({pageParam}) => {
      const options = {
        first: RUBRICS_PER_PAGE,
        after: (pageParam as string | null) ?? null,
        searchTerm: searchTerm || undefined,
        sort,
        workflowStates,
      }
      if (isAccount) return fetchAccountRubrics({accountId}, options)
      if (isCourse) return fetchCourseRubrics({courseId}, options)
      throw new Error('No account or course id provided')
    },
    initialPageParam: null,
    getNextPageParam: lastPage => {
      const {hasNextPage, endCursor} = lastPage.rubricsConnection.pageInfo
      return hasNextPage ? endCursor : undefined
    },
    enabled: isAccount || isCourse,
    // Keep previously loaded pages visible while a filter/sort change refetches
    // from scratch so the table doesn't blink on every keystroke or sort click.
    placeholderData: keepPreviousData,
  })

  const rubrics = useMemo(
    () => query.data?.pages.flatMap(p => p.rubricsConnection.nodes) ?? [],
    [query.data?.pages],
  )
  const totalCount = query.data?.pages[0]?.rubricsConnection.pageInfo.totalCount ?? 0

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({queryKey: [queryKeyBase]}, {cancelRefetch: true}),
    [queryKeyBase],
  )

  return {
    rubrics,
    totalCount,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    invalidate,
  }
}

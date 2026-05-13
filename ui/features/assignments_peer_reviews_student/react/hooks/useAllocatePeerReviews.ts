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

import {useMutation, useQueryClient} from '@tanstack/react-query'
import doFetchApi, {FetchApiError} from '@canvas/do-fetch-api-effect'
import {showFlashAlert, showFlashError} from '@instructure/platform-alerts'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('assignments_peer_reviews_student')

interface AllocatePeerReviewsParams {
  courseId: string
  assignmentId: string
}

export function useAllocatePeerReviews() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({courseId, assignmentId}: AllocatePeerReviewsParams) => {
      await doFetchApi({
        path: `/api/v1/courses/${courseId}/assignments/${assignmentId}/allocate`,
        method: 'POST',
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({queryKey: ['peerReviewAssignment', variables.assignmentId]})
    },
    onError: (error: unknown) => {
      if (error instanceof FetchApiError && error.response.status === 400) {
        showFlashAlert({
          message: I18n.t(
            'No peer reviews are available to complete at this time. Check back after more students have submitted.',
          ),
          type: 'info',
        })
        return
      }
      showFlashError(I18n.t('Failed to allocate peer reviews'))()
    },
  })
}

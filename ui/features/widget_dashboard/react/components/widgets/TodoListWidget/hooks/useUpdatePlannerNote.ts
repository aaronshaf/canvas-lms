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

import {useMutation, useQueryClient} from '@tanstack/react-query'
import {updatePlannerNote, type UpdatePlannerNoteParams} from '../api'
import {PLANNER_ITEMS_QUERY_KEY} from './usePlannerItems'

export interface UpdatePlannerNoteMutationParams extends UpdatePlannerNoteParams {
  id: string
}

export function useUpdatePlannerNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({id, ...params}: UpdatePlannerNoteMutationParams) => updatePlannerNote(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: [PLANNER_ITEMS_QUERY_KEY]})
    },
  })
}

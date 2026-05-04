/*
 * Copyright (C) 2022 - present Instructure, Inc.
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

import React, {useState, useEffect} from 'react'
import {Avatar} from '@instructure/ui-avatar'
import {Tooltip} from '@instructure/ui-tooltip'
import {useQuery} from '@tanstack/react-query'

export const fetchLiveGradebookParticipantName = async (
  courseId: string,
  uuid: string,
): Promise<string> => {
  try {
    const response = await fetch(`/api/v1/courses/${courseId}/users/uuid:${uuid}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('Failed to fetch user data')
    }
    const data = await response.json()
    return data.name
  } catch (error) {
    console.error('Error fetching user data:', error)
    return 'Anonymous Panda'
  }
}
interface LiveGradebookParticipantOptions {
  courseId: string
  uuid: string
}

export default function LiveGradebookParticipant({
  courseId,
  uuid,
}: LiveGradebookParticipantOptions) {
  const {data} = useQuery({
    queryKey: ['liveGradebookParticipant', {uuid}],
    queryFn: () => fetchLiveGradebookParticipantName(courseId, uuid),
    staleTime: 60 * 60 * 1000, // Cache for 60 minutes
  })

  const userName = data ?? ''

  return (
    <Tooltip renderTip={userName}>
      <Avatar name={userName} margin="0 0 0 xx-small" size="x-small" />
    </Tooltip>
  )
}

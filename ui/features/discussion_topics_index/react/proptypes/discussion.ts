/*
 * Copyright (C) 2018 - present Instructure, Inc.
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
import type {Author} from '@canvas/users/react/proptypes/user'

export interface Discussion {
  id: string
  position?: number
  published: boolean
  title: string
  message?: string
  posted_at: string
  author: Author
  read_state: 'read' | 'unread'
  unread_count: number
  subscribed: boolean
}

export type DiscussionList = Discussion[]

export default Discussion

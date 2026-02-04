/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

export type AllDates = {
  id?: string // Override id. Not required. Missing if base: true.
  base?: boolean
  due_at?: string | null // iso8601 strings or null
  lock_at?: string | null
  unlock_at?: string | null
  title?: string
  can_edit?: boolean
  in_closed_grading_period?: boolean
  persisted?: boolean
  errors?: {
    [key: string]: string
  }
  [key: string]: any
}

export type Assignment = {
  id: string
  name: string
  all_dates: AllDates[]
  all_dates_count?: number
  selected?: boolean
  moderated_grading?: boolean
  [key: string]: any
}

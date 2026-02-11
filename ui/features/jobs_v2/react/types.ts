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

export type BucketType = 'queued' | 'running' | 'future' | 'failed'
export type GroupType = 'tag' | 'strand' | 'singleton'

export interface Job {
  id: number
  tag: string
  strand?: string
  singleton?: string
  shard_id?: number
  max_concurrent: number
  priority: number
  attempts: number
  max_attempts: number
  locked_by?: string
  run_at?: string
  locked_at?: string
  failed_at?: string
  original_job_id?: number
  requeued_job_id?: number
  handler?: string
  last_error?: string
  info: number | string
  [key: string]: any
}

export interface Group {
  tag?: string
  strand?: string
  singleton?: string
  count: number
  info: number | string
  orphaned?: boolean
}

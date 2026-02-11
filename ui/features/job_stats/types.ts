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

export interface JobCounts {
  running: number
  queued: number
  future: number
  blocked: number
}

export interface JobCluster {
  id: string
  database_server_id?: string
  block_stranded_shard_ids: string[]
  jobs_held_shard_ids: string[]
  domain?: string
  counts: JobCounts
  loading?: boolean
  error?: Error | string | null
  message?: string
}

export interface StuckJob {
  name: string
  count: number
}

export type StuckType = 'strand' | 'singleton'

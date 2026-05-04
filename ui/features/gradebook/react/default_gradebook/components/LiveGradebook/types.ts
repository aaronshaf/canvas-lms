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

type LastGradeChangeData = any

type Payload<T> = T & {
  ws_token: string
}

type UserConnectedEvent = {
  action: 'userConnected'
  uuid: string
  data: never
}

type UserDisconnectedEvent = {
  action: 'userDisconnected'
  uuid: string
  data: never
}

type LocationChangeBase = {
  action: 'locationChange'
  location: {row: number; cell: number}
}
type LocationChangePayload = Payload<LocationChangeBase>
type LocationChangeEvent = Omit<LocationChangeBase, 'location'> & {
  uuid: string
  data: LocationChangeBase['location']
}

type GradeChangeBase = {
  action: 'gradeChange'
  allSubmissionsResponse: LastGradeChangeData
}
type GradeChangePayload = Payload<GradeChangeBase>
type GradeChangeEvent = GradeChangeBase & {
  uuid: string
}

type SetConnectedUsersEvent = {
  action: 'setConnectedUsers'
  users: string[]
}

export type LiveGradebookPayload = LocationChangePayload | GradeChangePayload

export type LiveGradebookEvent =
  | UserConnectedEvent
  | UserDisconnectedEvent
  | LocationChangeEvent
  | GradeChangeEvent
  | SetConnectedUsersEvent

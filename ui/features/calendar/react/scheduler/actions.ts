/*
 * Copyright (C) 2016 - present Instructure, Inc.
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

// @ts-expect-error redux-actions does not have type definitions
import {createAction} from 'redux-actions'

const keys = {
  SET_FIND_APPOINTMENT_MODE: 'SET_FIND_APPOINTMENT_MODE',
  SET_COURSE: 'SET_COURSE',
} as const

const actions = {
  setFindAppointmentMode: createAction<boolean>(keys.SET_FIND_APPOINTMENT_MODE),
  setCourse: createAction<{asset_string?: string}>(keys.SET_COURSE),
}

export default {
  actions,
  keys,
}

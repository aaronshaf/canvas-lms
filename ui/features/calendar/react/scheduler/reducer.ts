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
import {handleActions} from 'redux-actions'
import SchedulerActions from './actions'
import initialState, {type SchedulerState} from './store/initialState'

const reducer = handleActions<SchedulerState, any>(
  {
    [SchedulerActions.keys.SET_FIND_APPOINTMENT_MODE]: (state = initialState, action: any) => {
      return {
        ...state,
        inFindAppointmentMode: action.payload as boolean,
      }
    },
    [SchedulerActions.keys.SET_COURSE]: (state = initialState, action: any) => {
      return {
        ...state,
        selectedCourse: action.payload as {asset_string?: string},
      }
    },
  },
  initialState,
)

export default reducer

/*
 * Copyright (C) 2021 - present Instructure, Inc.
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

import {useCallback, useReducer} from 'react'
import {sliceSyncSettings} from './settingsHelper'
import useFetchApi from '@canvas/use-fetch-api-hook'
import {reducerActions, defaultState, settingsReducer} from './settingsReducer'

/**
 * A custom React hook that handles state management for the MicrosoftSyncAccountSettings
 * component.
 * @returns {[import('./settingsReducer').State, Function]}
 */
export default function useSettings() {
  const [state, dispatch] = useReducer(settingsReducer, defaultState)

  const contextBaseUrl =
    (typeof window !== 'undefined' && window.ENV?.CONTEXT_BASE_URL) ||
    (typeof ENV !== 'undefined' && ENV?.CONTEXT_BASE_URL)

  useFetchApi({
    success: useCallback(data => {
      dispatch({
        type: reducerActions.fetchSuccess,
        payload: sliceSyncSettings(data || {}),
      })
    }, []),
    path: `/api/v1${contextBaseUrl}/settings`,
    loading: useCallback(loading => {
      dispatch({type: reducerActions.fetchLoading, payload: {loading}})
    }, []),
    error: useCallback(err => {
      if (process.env.DEBUG_MICROSOFT_SYNC_SETTINGS === '1') {
        console.error('Microsoft sync settings fetch error:', err)
      }
      dispatch({type: reducerActions.fetchError})
    }, []),
  })

  return [state, dispatch]
}

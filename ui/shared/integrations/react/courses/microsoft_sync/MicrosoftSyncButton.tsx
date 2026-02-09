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

import {useScope as createI18nScope} from '@canvas/i18n'
import React, {useEffect, useReducer} from 'react'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import {Spinner} from '@instructure/ui-spinner'
import {type GlobalEnv} from '@canvas/global/env/GlobalEnv'

const I18n = createI18nScope('course_settings')

declare const ENV: GlobalEnv & {
  MANUAL_MSFT_SYNC_COOLDOWN?: number
  MSFT_SYNC_CAN_BYPASS_COOLDOWN?: boolean
}

const readyStates = ['pending', 'errored', 'completed', 'scheduled']
const coolDownRequiredStates = ['completed', 'manually_scheduled', 'scheduled']

type Group = Record<string, unknown> & {
  workflow_state: string
  last_manually_synced_at?: string
}

type SyncState = {
  loading: boolean
  error: unknown
  previousError: unknown
  coolDownSeconds: number
  secondsRemaining: number
  readyForManualSync: boolean
  showCountdown: boolean
  canBypassCooldown: boolean
  enabled: boolean
  group: Group
}

type SyncAction =
  | {type: 'SCHEDULE'}
  | {type: 'SCHEDULE_SUCCESS'; payload: {group: Group}}
  | {type: 'SCHEDULE_FAILED'; payload: {error: unknown}}

const syncReducer = (state: SyncState, action: SyncAction): SyncState => {
  switch (action.type) {
    case 'SCHEDULE':
      return {...state, loading: true, error: false, previousError: state.error}
    case 'SCHEDULE_SUCCESS': {
      const {group} = action.payload
      const newSecondsRemaining = secondsUntilEditable(
        group,
        state.coolDownSeconds,
        state.canBypassCooldown,
      )

      return {
        ...state,
        loading: false,
        group,
        enabled: false,
        previousError: state.error,
        error: false,
        secondsRemaining: newSecondsRemaining,
        readyForManualSync: readyStates.includes(group.workflow_state),
        // We don't need to show the countdown for Site Admins
        showCountdown:
          coolDownRequiredStates.includes(group.workflow_state) && !state.canBypassCooldown,
      }
    }
    case 'SCHEDULE_FAILED':
      return {...state, loading: false, error: action.payload.error, enabled: true}
    default:
      throw new Error('Not implemented')
  }
}

const secondsUntilEditable = (
  group: Group,
  coolDownSeconds: number,
  canBypassCooldown: boolean,
) => {
  // Site admins can bypass the cooldown timer.
  if (!group.last_manually_synced_at || canBypassCooldown) {
    return 0 // No manual sync has ocurred yet- sync away!
  }

  // Get the difference between the current time and the
  // last manual sync time in seconds
  const secondsElapsed = (Date.now() - Date.parse(group.last_manually_synced_at)) / 1000
  return coolDownSeconds - secondsElapsed
}

const MicrosoftSyncButton = ({
  enabled,
  error,
  group,
  onError,
  onSuccess,
  onInfo,
  courseId,
}: {
  enabled: boolean
  error?: unknown
  group: Group
  onError: (error: unknown) => void
  onSuccess: (group: Group) => void
  onInfo: (info?: {message?: string; variant?: string} | string) => void
  courseId: string | number
}) => {
  const coolDownSeconds = Number(ENV.MANUAL_MSFT_SYNC_COOLDOWN ?? 0)
  const canBypassCooldown = !!ENV.MSFT_SYNC_CAN_BYPASS_COOLDOWN

  const [state, dispatch] = useReducer(syncReducer, {
    loading: false,
    error,
    coolDownSeconds,
    previousError: error,
    secondsRemaining: secondsUntilEditable(group, coolDownSeconds, canBypassCooldown),
    readyForManualSync: readyStates.includes(group.workflow_state),
    showCountdown: coolDownRequiredStates.includes(group.workflow_state),
    canBypassCooldown,
    enabled,
    group,
  })

  useEffect(() => onSuccess(state.group), [state.group, onSuccess])
  useEffect(() => {
    // we don't want to clear the error state unless
    // we've previously had an error in this component
    if (state.error || state.previousError) {
      onError(state.error)
    }
  }, [state.error, onError, state.previousError])
  useEffect(() => {
    const recentlyScheduled = state.coolDownSeconds - state.secondsRemaining < 15

    // A sync was just scheduled
    if (recentlyScheduled) {
      onInfo({
        message: I18n.t('Sync scheduled successfully! You may safely leave this page.'),
        variant: 'success',
      })
    }

    // A sync is already scheduled or running
    if (!state.readyForManualSync) {
      setTimeout(
        () => {
          onInfo(
            I18n.t(
              'A sync is currently running. Please wait for current sync to finish before starting another.',
            ),
          )
        },
        recentlyScheduled ? 5000 : 0, // Give time for the success message to show
      )
      return
    }

    // No sync is running, but the cooldown period has not completed
    if (state.secondsRemaining > 0 && state.showCountdown) {
      onInfo(
        I18n.t(
          'Manual syncs are available every %{coolDown} minutes. Please wait %{minutesRemaining} minutes to sync again.',
          {
            coolDown: Math.round(state.coolDownSeconds / 60),
            minutesRemaining: Math.round(state.secondsRemaining / 60),
          },
        ),
      )
      return
    }

    // Manual sync is available, clear info message
    onInfo(undefined)
  }, [
    state.secondsRemaining,
    state.readyForManualSync,
    state.coolDownSeconds,
    state.showCountdown,
    onInfo,
  ])

  const scheduleSync = () => {
    dispatch({type: 'SCHEDULE'})
    doFetchApi({
      method: 'POST',
      path: `/api/v1/courses/${courseId}/microsoft_sync/schedule_sync`,
    })
      .then(response => {
        dispatch({type: 'SCHEDULE_SUCCESS', payload: {group: response.json as Group}})
      })
      .catch((e: {message?: string}) =>
        dispatch({type: 'SCHEDULE_FAILED', payload: {error: e.message}}),
      )
  }

  return (
    <Button
      withBackground={false}
      color="primary"
      margin="none small none none"
      interaction={
        state.enabled && !state.loading && (state.secondsRemaining <= 0 || !state.showCountdown)
          ? 'enabled'
          : 'disabled'
      }
      onClick={scheduleSync}
      display="block"
    >
      <View display="block" height="20px">
        {state.loading ? (
          <Spinner renderTitle={I18n.t('Scheduling sync')} size="x-small" />
        ) : (
          I18n.t('Sync Now')
        )}
      </View>
    </Button>
  )
}

export default MicrosoftSyncButton

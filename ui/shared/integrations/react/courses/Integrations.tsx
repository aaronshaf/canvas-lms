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

import React, {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {type GlobalEnv} from '@canvas/global/env/GlobalEnv'

import {Flex} from '@instructure/ui-flex'
import {Text} from '@instructure/ui-text'
import {View} from '@instructure/ui-view'
import IntegrationRow from './IntegrationRow'

import MicrosoftSync from './microsoft_sync/MicrosoftSync'
import useMicrosoftSettings from './microsoft_sync/useSettings'
import MicrosoftSyncButton from './microsoft_sync/MicrosoftSyncButton'
import MicrosoftSyncDebugInfo from './microsoft_sync/MicrosoftSyncDebugInfo'

const I18n = createI18nScope('course_settings')

declare const ENV: GlobalEnv & {
  MSFT_SYNC_ENABLED?: boolean
  COURSE_ID: string | number
}

const Integrations = () => {
  const anyIntegrationsAvailable = !!ENV.MSFT_SYNC_ENABLED

  if (!anyIntegrationsAvailable) {
    return (
      <Flex justifyItems="space-around">
        <Flex.Item margin="medium 0 0 0">
          <Text size="x-large" color="secondary" weight="bold">
            {I18n.t('No integrations available')}
          </Text>
        </Flex.Item>
      </Flex>
    )
  }

  type MsGroup = Record<string, unknown> & {
    debug_info?: unknown
    workflow_state: string
    last_manually_synced_at?: string
    last_synced_at?: string
  }
  type MsInfo =
    | string
    | {
        variant?: 'info' | 'error' | 'success' | 'warning'
        message?: string
      }

  const [msGroup, msEnabled, msLoading, msError, msToggleEnabled, setMSError, setMSGroup] =
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMicrosoftSettings(ENV.COURSE_ID) as unknown as [
      MsGroup,
      boolean,
      boolean,
      unknown,
      () => void,
      (error: unknown) => void,
      (group: MsGroup) => void,
    ]

  const msErrorForUI = msError as unknown as string | {message?: string} | undefined

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [msExpanded, setMSExpanded] = useState<boolean>(!!msErrorForUI)

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [msInfo, setMSInfo] = useState<MsInfo | undefined>(undefined)

  return (
    <>
      <h2>{I18n.t('Integrations')}</h2>
      <View as="div" borderWidth="none none small none" borderColor="primary" padding="none small">
        <Flex justifyItems="space-between">
          <Flex.Item>
            <Text size="large">{I18n.t('Feature')}</Text>
          </Flex.Item>
          <Flex.Item>
            <Text size="large">{I18n.t('State')}</Text>
          </Flex.Item>
        </Flex>
      </View>
      <IntegrationRow
        name={I18n.t('Microsoft Sync')}
        available={!!ENV.MSFT_SYNC_ENABLED}
        enabled={msEnabled}
        loading={msLoading}
        onChange={() => {
          if (!msEnabled) {
            setMSExpanded(true)
          }
          msToggleEnabled()
        }}
        error={msErrorForUI}
        info={msInfo}
        expanded={msExpanded}
        onToggle={() => setMSExpanded(expanded => !expanded)}
      >
        {/* @ts-expect-error TS migration: the ENV-provided group workflow_state is a broader string. */}
        <MicrosoftSync group={msGroup} loading={msLoading}>
          <MicrosoftSyncButton
            courseId={ENV.COURSE_ID as string | number}
            enabled={msEnabled}
            group={msGroup}
            error={msErrorForUI}
            onError={setMSError}
            onInfo={setMSInfo as (...args: unknown[]) => void}
            onSuccess={setMSGroup}
          />
        </MicrosoftSync>
        {Array.isArray(msGroup?.debug_info) && (
          <MicrosoftSyncDebugInfo
            debugInfo={
              msGroup.debug_info as unknown as Array<{
                msg?: string
                timestamp?: string
                user_ids?: (string | number)[]
              }>
            }
          />
        )}
      </IntegrationRow>
    </>
  )
}

export default Integrations

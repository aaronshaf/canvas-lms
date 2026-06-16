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
import PropTypes from 'prop-types'
import {useMutation, useQuery} from '@tanstack/react-query'
import doFetchApi, {FetchApiError} from '@canvas/do-fetch-api-effect'
import {useScope as createI18nScope} from '@canvas/i18n'
import useCanvasContext from '@canvas/outcomes/react/hooks/useCanvasContext'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {Alert} from '@instructure/ui-alerts'
import {ProgressBar} from '@instructure/ui-progress'
import {InstUISettingsProvider} from '@instructure/emotion'
import {CanvasSelect, InstUIModal as Modal} from '@instructure/platform-instui-bindings'
import {Spinner} from '@instructure/ui-spinner'

interface GlobalOutcome {
  title: string
  guid: string
}

type MigrationWorkflowState =
  | 'pre_processing'
  | 'running'
  | 'waiting_for_select'
  | 'completed'
  | 'failed'

interface MigrationStatus {
  id: string
  workflow_state: MigrationWorkflowState
  audit_info?: {progress?: number}
  migration_issues_count?: number
  error?: string
}

const TERMINAL_STATES: MigrationWorkflowState[] = ['completed', 'failed']

const I18n = createI18nScope('OutcomeManagement')

const componentOverrides = {
  Mask: {
    zIndex: 1000,
  },
}

const ImportGlobalOutcomesModal = ({
  isOpen,
  onCloseHandler,
}: {
  isOpen: boolean
  onCloseHandler: () => void
}) => {
  const {isMobileView} = useCanvasContext()
  const {data, isPending, isError, error} = useQuery<GlobalOutcome[]>({
    queryKey: ['globalOutcomes', 'available'],
    queryFn: async () => {
      const path = `/api/v1/global/outcomes_import/available`

      const {json} = await doFetchApi<GlobalOutcome[] | {error?: string}>({
        path,
        method: 'GET',
      })

      if (!Array.isArray(json)) {
        throw new Error(
          json?.error ||
            I18n.t('There was an error loading the available global outcomes. Please try again.'),
        )
      }

      return json
    },
  })

  const [selectedId, setSelectedId] = useState<string>()
  const [migrationId, setMigrationId] = useState<string>()

  const {
    mutate: startImport,
    isPending: isStarting,
    error: startError,
    reset: resetStart,
  } = useMutation({
    mutationFn: async (guid: string) => {
      const {json} = await doFetchApi<{migration_id?: number; guid?: string; error?: string}>({
        path: `/api/v1/global/outcomes_import`,
        method: 'POST',
        body: {guid},
      })
      if (!json?.migration_id) {
        throw new Error(json?.error || I18n.t('Import failed to queue'))
      }
      return json
    },
    onSuccess: json => setMigrationId(String(json.migration_id)),
  })

  // Poll the migration status until the import reaches a terminal state.
  const {data: status} = useQuery<MigrationStatus>({
    queryKey: ['globalOutcomes', 'migrationStatus', migrationId],
    enabled: !!migrationId,
    queryFn: async () => {
      const {json} = await doFetchApi<MigrationStatus>({
        path: `/api/v1/global/outcomes_import/migration_status/${migrationId}`,
        method: 'GET',
      })
      return json as MigrationStatus
    },
    refetchInterval: query => {
      const ws = query.state.data?.workflow_state
      return ws && TERMINAL_STATES.includes(ws) ? false : 2000
    },
  })

  const completion = status?.audit_info?.progress
  const workflowState = status?.workflow_state
  const isImporting = !!migrationId && workflowState !== 'completed' && workflowState !== 'failed'
  const isDone = workflowState === 'completed'
  const isFailed = workflowState === 'failed' || !!status?.error

  const handleClose = () => {
    // Reset local state so a reopened modal starts fresh.
    setMigrationId(undefined)
    setSelectedId(undefined)
    resetStart()
    onCloseHandler()
  }

  const renderBody = () => {
    if (isError) {
      const message =
        error instanceof Error && !(error instanceof FetchApiError) ? error.message : undefined
      return (
        <Alert variant="error" margin="0">
          {message ||
            I18n.t('There was an error loading the available global outcomes. Please try again.')}
        </Alert>
      )
    }

    if (isPending) {
      return <Spinner renderTitle={I18n.t('Loading...')} />
    }

    if (migrationId) {
      if (isFailed) {
        return (
          <Alert variant="error" margin="0">
            {status?.error || I18n.t('The import failed. Please try again.')}
          </Alert>
        )
      }
      if (isDone) {
        return (
          <Alert variant="success" margin="0">
            {I18n.t('The outcomes were imported successfully.')}
          </Alert>
        )
      }
      return (
        <View as="div">
          <Text as="p">
            {I18n.t(
              'Importing outcomes. This may take a while and the progress bar will move slowly. The import will continue even if you close this page.',
            )}
          </Text>
          {typeof completion === 'number' ? (
            <ProgressBar
              size="small"
              meterColor="info"
              screenReaderLabel={I18n.t('Import progress')}
              valueNow={completion}
              valueMax={100}
              shouldAnimate={true}
              renderValue={() => `${completion}%`}
            />
          ) : (
            <Spinner size="small" renderTitle={I18n.t('Importing...')} />
          )}
        </View>
      )
    }

    return (
      <>
        {startError && (
          <View as="div" padding="0 0 medium">
            <Alert variant="error" margin="0">
              {(startError as Error).message}
            </Alert>
          </View>
        )}
        <CanvasSelect
          id="globalOutcomeGroupSelect"
          label={I18n.t('Global Outcome Group')}
          onChange={(_e: React.SyntheticEvent, value: string) => setSelectedId(value)}
          value={selectedId || ''}
        >
          {data.map(out => (
            <CanvasSelect.Option key={out.guid} id={out.guid} value={out.guid}>
              {out.title}
            </CanvasSelect.Option>
          ))}
        </CanvasSelect>
      </>
    )
  }

  return (
    <InstUISettingsProvider theme={{componentOverrides}}>
      <Modal
        size={!isMobileView ? 'large' : 'fullscreen'}
        label={I18n.t('Import Global Outcomes')}
        open={isOpen}
        shouldReturnFocus={true}
        onDismiss={handleClose}
        shouldCloseOnDocumentClick={false}
        data-testid="importGlobalOutcomesModal"
      >
        <Modal.Body>
          <View as="div">{renderBody()}</View>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="secondary" margin="0 x-small 0 0" onClick={handleClose}>
            {isDone ? I18n.t('Close') : I18n.t('Cancel')}
          </Button>
          {!isDone && (
            <Button
              type="button"
              color="primary"
              margin="0 x-small 0 0"
              interaction={!selectedId || isStarting || isImporting ? 'disabled' : 'enabled'}
              onClick={() => selectedId && startImport(selectedId)}
              data-testid="start-button"
            >
              {I18n.t('Start')}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </InstUISettingsProvider>
  )
}

ImportGlobalOutcomesModal.defaultProps = {}

ImportGlobalOutcomesModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onCloseHandler: PropTypes.func.isRequired,
}

export default ImportGlobalOutcomesModal

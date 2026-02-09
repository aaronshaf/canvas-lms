/*
 * Copyright (C) 2024 - present Instructure, Inc.
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

import React, {useState, useEffect} from 'react'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {Modal} from '@instructure/ui-modal'
import {Button, IconButton} from '@instructure/ui-buttons'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Heading} from '@instructure/ui-heading'
import {IconHourGlassLine} from '@instructure/ui-icons'
import {ProgressBar} from '@instructure/ui-progress'
import {type GlobalEnv} from '@canvas/global/env/GlobalEnv'

const I18n = createI18nScope('external_tools')

declare const ENV: GlobalEnv & {
  CONTEXT_BASE_URL: string
}

let apiTimeout: ReturnType<typeof setTimeout> | undefined

type MigrationInfo = {
  migration_running: boolean
  total_items: number
  completed_items: number
}

function isMigrationInfo(v: unknown): v is MigrationInfo {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  return (
    typeof obj.migration_running === 'boolean' &&
    typeof obj.total_items === 'number' &&
    typeof obj.completed_items === 'number'
  )
}

type ExternalToolMigrationInfoProps = {
  tool: {app_id: string | number} & Record<string, unknown>
}

export default function ExternalToolMigrationInfo(props: ExternalToolMigrationInfoProps) {
  const [data, setData] = useState<MigrationInfo>({
    migration_running: false,
    total_items: 0,
    completed_items: 0,
  })
  const [modalIsOpen, setModalIsOpen] = useState(false)

  const openModal = () => {
    setModalIsOpen(true)
  }

  const closeModal = () => {
    setModalIsOpen(false)
  }

  const tool = props.tool
  const tool_id = tool.app_id

  const fetchData = () => {
    doFetchApi({path: `/api/v1${ENV.CONTEXT_BASE_URL}/external_tools/${tool_id}/migration_info`})
      .then(response => {
        const json = response.json
        if (isMigrationInfo(json)) {
          setData(json)

          // Check status code to see if the API call was successful
          // If the modal is open or the tool is no longer migrating, don't continue to fetch data
          if (response.response?.status === 200 && modalIsOpen && json.migration_running) {
            apiTimeout = setTimeout(fetchData, 1000)
          } else if (apiTimeout) {
            clearTimeout(apiTimeout)
            apiTimeout = undefined
          }
        } else if (apiTimeout) {
          clearTimeout(apiTimeout)
          apiTimeout = undefined
        }
      })
      .catch(error => console.error(error))
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalIsOpen])

  const {migration_running, total_items, completed_items} = data

  const inProgressText = I18n.t('%{completed_items} out of %{total_items} Item Batches Migrated', {
    completed_items,
    total_items,
  })
  const completeText = I18n.t('Migration Completed')

  const modal = () => (
    <Modal open={modalIsOpen} onDismiss={closeModal} label={I18n.t('Migration Info')} size="small">
      <Modal.Header>
        <Heading>Migration Progress</Heading>
      </Modal.Header>
      <Modal.Body>
        <p>{migration_running ? inProgressText : completeText}</p>

        <ProgressBar
          size="x-small"
          valueNow={migration_running ? completed_items : 100}
          valueMax={migration_running ? total_items : 100}
          screenReaderLabel={migration_running ? inProgressText : completeText}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={closeModal}>Close</Button>
      </Modal.Footer>
    </Modal>
  )

  return (
    <>
      <IconButton
        renderIcon={IconHourGlassLine}
        onClick={openModal}
        screenReaderLabel={I18n.t('Migration Info')}
        withBackground={false}
        withBorder={false}
        margin={'0 0 0 x-small'}
      />
      {modal()}
    </>
  )
}

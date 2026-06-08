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

import React from 'react'
import {render} from '@canvas/react'
import ready from '@instructure/ready'
import {useScope as createI18nScope} from '@canvas/i18n'
import {IconButton} from '@instructure/ui-buttons'
import {IconNoteLine} from '@instructure/ui-icons'
import {Tooltip} from '@instructure/ui-tooltip'

const I18n = createI18nScope('notebook')

const MOBILE_MOUNT_ID = 'notebook_mobile_mount_point'
const ICON_MOUNT_IDS = ['notebook_mount_point', MOBILE_MOUNT_ID]
const OPEN_EVENT = 'notebook:open'

function dispatchOpen() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

function NotebookTrigger({isMobile}: {isMobile: boolean}) {
  return (
    <Tooltip renderTip={I18n.t('Notebook')}>
      <IconButton
        renderIcon={<IconNoteLine />}
        color={isMobile ? 'primary-inverse' : 'secondary'}
        withBackground={!isMobile}
        withBorder={!isMobile}
        onClick={dispatchOpen}
        data-testid="notebook-button"
        screenReaderLabel={I18n.t('Notebook')}
      />
    </Tooltip>
  )
}

ready(() => {
  if (!window.ENV.FEATURES?.notebook) return

  ICON_MOUNT_IDS.forEach(id => {
    const mount = document.getElementById(id)
    if (mount) render(<NotebookTrigger isMobile={id === MOBILE_MOUNT_ID} />, mount)
  })
})

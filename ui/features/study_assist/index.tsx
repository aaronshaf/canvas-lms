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
import {useTranslation} from '@canvas/i18next'
import {IconButton} from '@instructure/ui-buttons'
import {Tooltip} from '@instructure/ui-tooltip'
import {IconAiSolid} from '@instructure/ui-icons'

const ICON_MOUNT_IDS = ['study_assist_mount_point', 'study_assist_mobile_mount_point']
const OPEN_EVENT = 'study-assist:open'

function dispatchOpen() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

export function StudyAssistTrigger() {
  const {t} = useTranslation('study_assist')
  return (
    <Tooltip renderTip={t('IgniteAI Study Tools')}>
      <IconButton
        screenReaderLabel={t('IgniteAI Study Tools')}
        shape="circle"
        color="ai-primary"
        onClick={dispatchOpen}
        data-pendo="study-assist-trigger"
        data-testid="study-assist-trigger"
      >
        <IconAiSolid />
      </IconButton>
    </Tooltip>
  )
}

ready(() => {
  if (!window.ENV.FEATURES?.study_assist) return

  ICON_MOUNT_IDS.forEach(id => {
    const mount = document.getElementById(id)
    if (mount) render(<StudyAssistTrigger />, mount)
  })
})

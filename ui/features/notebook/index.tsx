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
import {Button} from '@instructure/ui-buttons'
import {IconNoteLine} from '@instructure/ui-icons'

const I18n = createI18nScope('notebook')

const OPEN_EVENT = 'notebook:open'

function dispatchOpen() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

function NotebookTrigger() {
  return (
    <Button
      renderIcon={<IconNoteLine />}
      color="secondary"
      onClick={dispatchOpen}
      data-testid="notebook-button"
    >
      {I18n.t('Notebook')}
    </Button>
  )
}

ready(() => {
  if (!window.ENV.FEATURES?.notebook) return

  const mount = document.getElementById('notebook_mount_point')
  if (!mount) return

  render(<NotebookTrigger />, mount)
})

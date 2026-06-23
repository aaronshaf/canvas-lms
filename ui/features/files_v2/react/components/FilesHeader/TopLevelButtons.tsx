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

import React from 'react'
import {useTranslation} from '@canvas/i18next'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {showFlashError} from '@instructure/platform-alerts'
import {Button} from '@instructure/ui-buttons'
import {IconUploadLine} from '@instructure/ui-icons'
import CreateFolderButton from './CreateFolderButton'
import ExternalToolsButton from './ExternalToolsButton'
import UploadButton from './UploadButton'
import {Flex} from '@instructure/ui-flex'
import {reloadWindow} from '@canvas/util/globalUtils'
import {getFilesEnv} from '../../../utils/filesEnvUtils'

interface TopLevelButtonsProps {
  isUserContext: boolean
  size: 'small' | 'medium' | 'large'
  shouldHideUploadButtons?: boolean
}

const TopLevelButtons = ({
  isUserContext,
  size,
  shouldHideUploadButtons = false,
}: TopLevelButtonsProps) => {
  const {t} = useTranslation('files_v2')
  const buttonDisplay = size === 'small' ? 'block' : 'inline-block'

  const createFolderButton = () => {
    if (shouldHideUploadButtons) return null

    return <CreateFolderButton buttonDisplay={buttonDisplay} />
  }

  const externalToolsButton = () => {
    if (shouldHideUploadButtons) return null

    return <ExternalToolsButton buttonDisplay={buttonDisplay} size={size} />
  }

  const uploadButton = () => {
    if (shouldHideUploadButtons) return null

    return (
      <UploadButton color="primary" renderIcon={<IconUploadLine />} display={buttonDisplay}>
        {t('Upload')}
      </UploadButton>
    )
  }

  const allMyFilesButton = () => {
    if (isUserContext) return null
    return (
      <a href="/files" tabIndex={-1}>
        <Button color="secondary" display={buttonDisplay}>
          {t('All My Files')}
        </Button>
      </a>
    )
  }

  const handleSwitchToOldFiles = async () => {
    doFetchApi({
      method: 'PUT',
      path: `/api/v1/users/self/files_ui_version_preference`,
      body: {files_ui_version: 'v1'},
    })
      .then(() => {
        reloadWindow()
      })
      .catch(_ => {
        showFlashError(t('Error switching to Old Files Page.'))()
      })
  }

  const switchUIButton = () => {
    if (!ENV.FEATURES?.files_a11y_rewrite_toggle) return null
    if (!ENV.current_user_id) return null
    return (
      <Button
        color="secondary"
        display={buttonDisplay}
        onClick={handleSwitchToOldFiles}
        data-id="switch-to-old-files-button"
      >
        {t('Switch to Old Files Page')}
      </Button>
    )
  }

  const isAccessRestricted = getFilesEnv().userFileAccessRestricted

  if (size === 'small') {
    return (
      <Flex as="div" gap="small" direction="column">
        {!isAccessRestricted && uploadButton()}
        {createFolderButton()}
        {allMyFilesButton()}
        {externalToolsButton()}
        {switchUIButton()}
      </Flex>
    )
  }

  return (
    <Flex as="div" gap="small">
      {switchUIButton()}
      {externalToolsButton()}
      {allMyFilesButton()}
      {createFolderButton()}
      {!isAccessRestricted && uploadButton()}
    </Flex>
  )
}

export default TopLevelButtons

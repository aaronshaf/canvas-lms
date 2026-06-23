/*
 * Copyright (C) 2025 - present Instructure, Inc.
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
import {Modal} from '@instructure/ui-modal'
import {useTranslation} from '@canvas/i18next'
import '@canvas/rails-flash-notifications'
import {Button, CloseButton} from '@instructure/ui-buttons'
import {Heading} from '@instructure/ui-heading'
import {BBFolderWrapper} from '../../../../utils/fileFolderWrappers'
import {FileUploadDrop} from '../../shared/FileUploadDrop'
import {Flex} from '@instructure/ui-flex'

type UploadFormProps = {
  contextId: string
  contextType: string
  currentFolder: BBFolderWrapper
  open: boolean
  onClose: () => void
}

export const UploadForm = ({
  contextId,
  contextType,
  currentFolder,
  open,
  onClose,
}: UploadFormProps) => {
  const {t} = useTranslation('upload_drop_zone')
  return (
    <Modal open={open} onDismiss={onClose} size="large" label={t('Upload file')}>
      <Modal.Header>
        <CloseButton
          data-testid="upload-close-button"
          placement="end"
          offset="small"
          onClick={onClose}
          screenReaderLabel={t('Close')}
        />
        <Heading>{t('Upload file')}</Heading>
      </Modal.Header>
      <Modal.Body>
        <Flex>
          <Flex.Item width="100%" height="50vh">
            <FileUploadDrop
              contextId={contextId}
              contextType={contextType}
              currentFolder={currentFolder}
              onClose={onClose}
              fileDropHeight={'100%'}
            />
          </Flex.Item>
        </Flex>
      </Modal.Body>
      <Modal.Footer>
        <Button data-testid="upload-cancel-button" onClick={onClose}>
          {t('Cancel')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

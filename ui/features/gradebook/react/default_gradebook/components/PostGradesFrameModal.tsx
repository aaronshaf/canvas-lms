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

import React, {useEffect, useMemo} from 'react'
import iframeAllowances from '@canvas/external-apps/iframeAllowances'
import {useTranslation} from '@canvas/i18next'
import {Modal} from '@instructure/ui-modal'
import {Lti} from '../gradebook.d'
import {CloseButton} from '@instructure/ui-buttons'
import {Heading} from '@instructure/ui-heading'
import {onLtiClosePostMessage} from '@canvas/lti/jquery/messages'
import sanitizeUrl from '@canvas/util/sanitizeUrl'

export type PostGradesFrameModalProps = {
  postGradesLtis: Lti[]
  selectedLtiId?: string | null
  onClose?: () => void
}

function PostGradesFrameModal({postGradesLtis, selectedLtiId, onClose}: PostGradesFrameModalProps) {
  const {t} = useTranslation('gradebook')
  const baseUrl = useMemo(() => {
    return postGradesLtis.filter(lti => lti.id === selectedLtiId)[0]?.data_url
  }, [postGradesLtis, selectedLtiId])

  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (onClose) {
      return onLtiClosePostMessage(() => iframeRef.current, onClose)
    }
  }, [onClose])

  return (
    <Modal
      as={'div'}
      label={t('Sync Grades')}
      size="large"
      open={(selectedLtiId ?? '').length > 0}
      onDismiss={onClose}
      data-testid="post-grades-frame-modal"
    >
      <Modal.Header spacing="compact">
        <Heading level="h2">{t('Sync Grades')}</Heading>
        <CloseButton
          placement="end"
          offset="small"
          onClick={onClose}
          screenReaderLabel={t('Close')}
        />
      </Modal.Header>
      <Modal.Body padding="none">
        {baseUrl ? (
          <iframe
            src={sanitizeUrl(baseUrl)}
            ref={iframeRef}
            className="post-grades-frame"
            style={{border: 'none', width: '100%', height: '75vh'}}
            title={t('Sync Grades')}
            allow={iframeAllowances()}
            data-lti-launch="true"
          />
        ) : null}
      </Modal.Body>
    </Modal>
  )
}

PostGradesFrameModal.defaultProps = {}

export default PostGradesFrameModal

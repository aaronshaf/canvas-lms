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

import {useState} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Alert} from '@instructure/ui-alerts'
import {Button, CloseButton} from '@instructure/ui-buttons'
import {Heading} from '@instructure/ui-heading'
import {Modal} from '@instructure/ui-modal'
import {Text} from '@instructure/ui-text'
import doFetchApi from '@canvas/do-fetch-api-effect'
import {showFlashSuccess, showFlashError} from '@instructure/platform-alerts'

const I18n = createI18nScope('force_password_reset')

interface ForcePasswordResetButtonProps {
  accountId: string
}

const ForcePasswordResetButton = ({accountId}: ForcePasswordResetButtonProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await doFetchApi({
        path: `/api/v1/accounts/${accountId}/authentication_providers/force_password_reset`,
        method: 'POST',
      })
      showFlashSuccess(I18n.t('Password reset enqueued for all Canvas logins.'))()
      setIsModalOpen(false)
    } catch {
      showFlashError(I18n.t('An error occurred while enqueueing the password reset.'))()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Heading margin="small auto xx-small auto" level="h4">
        {I18n.t('Force Password Reset')}
      </Heading>
      <Text size="small" lineHeight="double">
        {I18n.t(
          'Immediately require all users with Canvas logins to change their password on next login.',
        )}
      </Text>
      <br />
      <Button color="danger" margin="x-small auto" onClick={() => setIsModalOpen(true)}>
        {I18n.t('Force Password Reset')}
      </Button>

      <Modal
        open={isModalOpen}
        onDismiss={() => setIsModalOpen(false)}
        size="small"
        label={I18n.t('Force Password Reset')}
        shouldCloseOnDocumentClick={false}
      >
        <Modal.Header>
          <CloseButton
            placement="end"
            offset="small"
            onClick={() => setIsModalOpen(false)}
            screenReaderLabel={I18n.t('Close')}
          />
          <Heading>{I18n.t('Force Password Reset')}</Heading>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning" margin="none" hasShadow={false}>
            {I18n.t(
              'All users with Canvas logins will be required to reset their password on next login. This action cannot be undone.',
            )}
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="secondary"
            margin="0 x-small 0 0"
            onClick={() => setIsModalOpen(false)}
            disabled={isSubmitting}
          >
            {I18n.t('Cancel')}
          </Button>
          <Button color="danger" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? I18n.t('Enqueueing...') : I18n.t('Force Password Reset')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

export default ForcePasswordResetButton

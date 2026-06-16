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

import {Heading} from '@instructure/ui-heading'
import {Modal} from '@instructure/ui-modal'
import {Button, CloseButton} from '@instructure/ui-buttons'
import {Text} from '@instructure/ui-text'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('account_settings')

interface Props {
  onConfirm: () => void
  onClose: () => void
}

export default function SecurityContactWarningModal({onConfirm, onClose}: Props) {
  return (
    <Modal size="small" open onDismiss={onClose} label={I18n.t('Confirm security contact')}>
      <Modal.Header>
        <Heading>{I18n.t('This looks like a personal email address')}</Heading>
        <CloseButton
          data-testid="close-button"
          placement="end"
          size="medium"
          onClick={onClose}
          screenReaderLabel={I18n.t('Close')}
        />
      </Modal.Header>
      <Modal.Body>
        <Text data-testid="security-contact-warning-text">
          {I18n.t(
            'This email address looks like a personal address. Before you submit, please verify in your institution’s agreements that this contact is designated to receive notice of privacy or security incidents.',
          )}
        </Text>
      </Modal.Body>
      <Modal.Footer>
        <Button data-testid="security-contact-cancel" onClick={onClose} margin="0 buttons 0 0">
          {I18n.t('Go back')}
        </Button>
        <Button data-testid="security-contact-confirm" color="primary" onClick={onConfirm}>
          {I18n.t('Submit anyway')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

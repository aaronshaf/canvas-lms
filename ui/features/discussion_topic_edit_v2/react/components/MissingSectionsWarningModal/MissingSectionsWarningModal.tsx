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
import {Modal} from '@instructure/ui-modal'
import {useTranslation} from '@canvas/i18next'
import {Button, CloseButton} from '@instructure/ui-buttons'
import {Heading} from '@instructure/ui-heading'
import {Text} from '@instructure/ui-text'
import {IconWarningLine} from '@instructure/ui-icons'
import {Flex} from '@instructure/ui-flex'

type Props = {
  onClose: () => void
  onContinue: () => void
}

export const MissingSectionsWarningModal = ({onClose, onContinue}: Props) => {
  const {t} = useTranslation('discussion_create')
  const renderCloseButton = () => {
    return <CloseButton onClick={onClose} screenReaderLabel={t('Close')} />
  }
  return (
    <Modal
      as="form"
      open={true}
      onDismiss={onClose}
      label={t('Missing Sections Warning')}
      shouldCloseOnDocumentClick={true}
    >
      <Modal.Header>
        <Flex>
          <Flex.Item margin="0 x-small 0 0">
            <Text size="large">
              <IconWarningLine />
            </Text>
          </Flex.Item>
          <Flex.Item shouldGrow={true}>
            <Heading>{t('Warning')}</Heading>
          </Flex.Item>
          <Flex.Item>{renderCloseButton()}</Flex.Item>
        </Flex>
      </Modal.Header>
      <Modal.Body padding="small">
        <p>
          <Text>{t('Not everyone will be assigned this item!')}</Text>
        </p>
        <Text>{t('Would you like to continue?')}</Text>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose} margin="0 x-small 0 0" data-testid="go-back-button">
          {t('Go Back')}
        </Button>
        <Button onClick={onContinue} color="primary" type="submit" data-testid="continue-button">
          {t('Continue')}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}

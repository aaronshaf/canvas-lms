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
import {useTranslation} from '@canvas/i18next'
import {View} from '@instructure/ui-view'
import {Button} from '@instructure/ui-buttons'

export interface TrayFooterProps {
  onClose: () => void
  onMove: () => void
}

const TrayFooter: React.FC<TrayFooterProps> = ({onClose, onMove}) => {
  const {t} = useTranslation('context_modules_v2')
  return (
    <View as="div" textAlign="end" margin="medium 0 0 0">
      <hr aria-hidden="true" />
      <Button margin="0 x-small 0 0" onClick={onClose}>
        {t('Cancel')}
      </Button>
      <Button color="primary" onClick={onMove}>
        {t('Move')}
      </Button>
    </View>
  )
}

export default TrayFooter

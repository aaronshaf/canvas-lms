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

import React, {useMemo} from 'react'
import {useTranslation} from '@canvas/i18next'
import {View} from '@instructure/ui-view'
import {SimpleSelect} from '@instructure/ui-simple-select'
import {ModuleAction} from '../../utils/types'
import {MOVE_MODULE_ITEM, MOVE_MODULE, MOVE_MODULE_CONTENTS} from '../../utils/constants'

export interface PositionSelectProps {
  selectedPosition: string
  onPositionChange: (
    event: React.SyntheticEvent<Element, Event>,
    data: {value?: string | number},
  ) => void
  hasItems: boolean
  moduleAction: ModuleAction | null
  itemTitle: string
}

const PositionSelect: React.FC<PositionSelectProps> = ({
  selectedPosition,
  onPositionChange,
  hasItems,
  moduleAction,
  itemTitle,
}) => {
  const {t} = useTranslation('context_modules_v2')
  const title = useMemo(() => {
    if (moduleAction === MOVE_MODULE_ITEM) {
      return t('Place "{{itemTitle}}"', {itemTitle: itemTitle || t('Item')})
    } else if (moduleAction === MOVE_MODULE_CONTENTS) {
      return t('Place Contents')
    } else if (moduleAction === MOVE_MODULE) {
      return t('Place "{{moduleName}}"', {moduleName: itemTitle || t('Module')})
    } else {
      return t('Place Module')
    }
  }, [moduleAction, itemTitle, t])

  return (
    <View as="div" margin="medium 0 0 0">
      {(moduleAction === MOVE_MODULE || hasItems) && (
        <SimpleSelect
          renderLabel={hasItems ? title : ''}
          assistiveText={t('Select position')}
          value={selectedPosition}
          onChange={onPositionChange}
          data-testid="select_position_listbox"
        >
          <SimpleSelect.Option id="top" value="top">
            {t('At the top')}
          </SimpleSelect.Option>
          <SimpleSelect.Option id="before" value="before">
            {t('Before...')}
          </SimpleSelect.Option>
          <SimpleSelect.Option id="after" value="after">
            {t('After...')}
          </SimpleSelect.Option>
          <SimpleSelect.Option id="bottom" value="bottom">
            {t('At the bottom')}
          </SimpleSelect.Option>
        </SimpleSelect>
      )}
    </View>
  )
}

export default PositionSelect

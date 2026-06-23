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

import {useTranslation} from '@canvas/i18next'
import {SimpleSelect} from '@instructure/ui-simple-select'
import {AVAILABILITY_OPTIONS} from './PermissionsModalUtils'
import {type AvailabilityOption} from './PermissionsModalUtils'

export type AvailabilityOptionChangeHandler = (
  event: React.SyntheticEvent,
  data: {
    id?: string
  },
) => void

export type AvailabilitySelectProps = {
  availabilityOption: AvailabilityOption
  onChangeAvailabilityOption: AvailabilityOptionChangeHandler
}

export const AvailabilitySelect = ({
  availabilityOption,
  onChangeAvailabilityOption,
}: AvailabilitySelectProps) => {
  const {t} = useTranslation('files_v2')
  return (
    <SimpleSelect
      data-testid="permissions-availability-selector"
      renderLabel={t('Available')}
      renderBeforeInput={availabilityOption.icon}
      value={availabilityOption.id}
      onChange={onChangeAvailabilityOption}
    >
      {Object.values(AVAILABILITY_OPTIONS).map(option => (
        <SimpleSelect.Option
          key={option.id}
          id={option.id}
          value={option.id}
          renderBeforeLabel={option.icon}
        >
          {option.label}
        </SimpleSelect.Option>
      ))}
    </SimpleSelect>
  )
}

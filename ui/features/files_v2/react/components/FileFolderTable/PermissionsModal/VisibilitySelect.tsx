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
import {type AvailabilityOption, type VisibilityOption} from './PermissionsModalUtils'

export type VisibilityOptionChangeHandler = (
  event: React.SyntheticEvent,
  data: {
    id?: string
  },
) => void

type VisibilitySelectProps = {
  visibilityOption: VisibilityOption
  visibilityOptions: Record<string, VisibilityOption>
  availabilityOption: AvailabilityOption
  onChangeVisibilityOption: VisibilityOptionChangeHandler
}

export const VisibilitySelect = ({
  visibilityOption,
  visibilityOptions,
  availabilityOption,
  onChangeVisibilityOption,
}: VisibilitySelectProps) => {
  const {t} = useTranslation('files_v2')
  return (
    <SimpleSelect
      data-testid="permissions-visibility-selector"
      disabled={availabilityOption.id === 'unpublished'}
      renderLabel={t('Visibility')}
      value={visibilityOption.id}
      onChange={onChangeVisibilityOption}
    >
      {Object.values(visibilityOptions).map(option => (
        <SimpleSelect.Option key={option.id} id={option.id} value={option.id}>
          {option.label}
        </SimpleSelect.Option>
      ))}
    </SimpleSelect>
  )
}

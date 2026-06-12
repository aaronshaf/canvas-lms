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

import React from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {Button} from '@instructure/ui-buttons'
import {IconPlusLine} from '@instructure/ui-icons'
import {navyButtonTheme} from '../brand'

const I18n = createI18nScope('ai_experiences')

interface AddExperienceButtonProps {
  onClick: () => void
  elementRef?: (el: HTMLButtonElement | null) => void
  'data-testid'?: string
}

const AddExperienceButton: React.FC<AddExperienceButtonProps> = ({
  onClick,
  elementRef,
  'data-testid': dataTestId = 'ai-experiences-add-button',
}) => (
  <Button
    data-testid={dataTestId}
    color="primary"
    themeOverride={navyButtonTheme}
    renderIcon={() => <IconPlusLine />}
    onClick={onClick}
    elementRef={(el: Element | null) => elementRef?.(el as HTMLButtonElement | null)}
  >
    {I18n.t('Add')}
  </Button>
)

export default AddExperienceButton

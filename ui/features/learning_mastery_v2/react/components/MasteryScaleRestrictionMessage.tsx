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

const I18n = createI18nScope('learning_mastery_gradebook')

/**
 * Shared copy explaining why a single outcome's mastery icons and distribution
 * chart are disabled. Used by the distribution popover and the grid chart cell.
 */
export const MasteryScaleRestrictionMessage = (): JSX.Element => (
  <>
    {I18n.t(
      'Mastery scales with more than 5 levels disable mastery icons and distribution charts for this outcome. Scores appear as numbers in the gradebook instead.',
    )}
  </>
)

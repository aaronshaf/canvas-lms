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

import {canvas} from '@instructure/ui-themes'
import type {HighlightTheme} from '@instructure/platform-notebook'

export const HIGHLIGHT_THEME: HighlightTheme = {
  colors: {
    importantBackground: canvas.colors.contrasts.green1212,
    confusingBackground: canvas.colors.contrasts.red1212,
    importantUnderline: canvas.colors.contrasts.green4570,
    confusingUnderline: canvas.colors.contrasts.red4570,
  },
  borderWidthSmall: '0.0625rem',
  underlineOffset: '0.125rem',
}

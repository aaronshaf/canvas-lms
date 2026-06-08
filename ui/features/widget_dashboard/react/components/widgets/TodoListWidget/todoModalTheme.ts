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

import type {WidgetColors} from '../../../theme/darkThemeColors'

// InstUI default dark (variant="inverse") uses a grey palette that clashes with the
// widget dashboard's navy palette, so the To Do modal is themed explicitly from the
// dashboard dark colors to stay visually consistent with the rest of the dashboard.
export const getTodoModalDarkTheme = (colors: WidgetColors) => ({
  componentOverrides: {
    Modal: {
      background: colors.cardBackground,
      borderColor: colors.border,
      textColor: colors.textPrimary,
    },
    'Modal.Header': {
      background: colors.cardBackground,
      borderColor: colors.border,
    },
    'Modal.Footer': {
      background: colors.cardBackground,
      borderColor: colors.border,
    },
    Heading: {
      primaryColor: colors.textPrimary,
    },
    FormFieldLabel: {
      color: colors.textPrimary,
    },
    TextInput: {
      background: colors.inputBackground,
      color: colors.textPrimary,
      borderColor: colors.inputBorder,
      placeholderColor: colors.textSecondary,
    },
    TextArea: {
      background: colors.inputBackground,
      color: colors.textPrimary,
      borderTopColor: colors.inputBorder,
      borderBottomColor: colors.inputBorder,
      borderLeftColor: colors.inputBorder,
      borderRightColor: colors.inputBorder,
      placeholderColor: colors.textSecondary,
    },
    Select: {
      background: colors.inputBackground,
      color: colors.textPrimary,
    },
    Options: {
      background: colors.cardBackground,
      labelColor: colors.textPrimary,
    },
    'Options.Item': {
      background: colors.cardBackground,
      color: colors.textPrimary,
      highlightedBackground: colors.cardSecondary,
      highlightedLabelColor: colors.textPrimary,
      selectedBackground: colors.textLink,
      selectedLabelColor: '#FFFFFF',
      selectedHighlightedBackground: colors.textLink,
    },
    Calendar: {
      background: colors.cardBackground,
      color: colors.textPrimary,
    },
    BaseButton: {
      secondaryBackground: colors.inputBackground,
      secondaryColor: colors.textPrimary,
      secondaryBorderColor: colors.inputBorder,
      secondaryHoverBackground: colors.cardSecondary,
      secondaryActiveBackground: colors.pageBackground,
      secondaryGhostColor: colors.textPrimary,
      secondaryGhostHoverBackground: colors.cardBackground,
    },
  },
})

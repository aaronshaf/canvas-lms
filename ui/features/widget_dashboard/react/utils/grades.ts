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

import {useScope as createI18nScope} from '@canvas/i18n'
import numberHelper from '@canvas/i18n/numberHelper'
import {
  configureGradeFormatting,
  formatGrade,
  GradeFormatHelper,
} from '@instructure/platform-grades'
import type {FormatGradeOptions} from '@instructure/platform-grades'

const I18n = createI18nScope('widget_dashboard')

// Inject Canvas's locale-aware number formatting and translated strings into
// @instructure/platform-grades. GradeFormatHelper/formatGrade run in non-React
// contexts, so configuration is module-level rather than via React context.
// Strings reproduce Canvas's historical @canvas/grading output (e.g. lowercase
// "complete"/"incomplete") so the migration is behavior-preserving.
export function configureCanvasGradeFormatting(): void {
  configureGradeFormatting({
    formatNumber: (value, options) => I18n.n(value, options),
    parseNumber: input => numberHelper.parse(input),
    strings: {
      excused: I18n.t('Excused'),
      complete: I18n.t('complete'),
      incomplete: I18n.t('incomplete'),
      // Raw template: platform-grades interpolates %{score}/%{pointsPossible}
      // itself. Do NOT route through I18n.t — Canvas would eagerly interpolate
      // and emit "[missing score value]" since the values aren't provided here.
      scoreOutOf: '%{score}/%{pointsPossible}',
    },
  })
}

configureCanvasGradeFormatting()

// Canonical import path for widget_dashboard grade formatting. Widgets should
// import from here rather than reaching into @instructure/platform-grades or
// @canvas/grading directly.
export {formatGrade, GradeFormatHelper}
export type {FormatGradeOptions}

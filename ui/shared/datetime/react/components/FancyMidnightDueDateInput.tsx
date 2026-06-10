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

import React, {useCallback, useEffect, useRef, useState} from 'react'
import {DateTimeInput} from '@instructure/ui-date-time-input'
import {showFlashAlert} from '@instructure/platform-alerts'
import * as tz from '@instructure/moment-utils'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('fancy_midnight_due_date_input')

type DateTimeInputProps = React.ComponentProps<typeof DateTimeInput>

// "Fancy midnight": an end-of-day deadline stores 23:59:59, not :00, so it doesn't end 59s
// early. Midnight snaps to 23:59:59 (visible change); a :59 pick only restores the second
// InstUI truncated, so displayTimeChanged stays false.
export function normalizeDueDate(isoValue?: string): {value: string; displayTimeChanged: boolean} {
  if (!isoValue) {
    return {value: '', displayTimeChanged: false}
  }
  if (tz.format(isoValue, '%M') === '59') {
    const value = tz.setToEndOfMinute(isoValue)?.toISOString() ?? isoValue
    return {value, displayTimeChanged: false}
  }
  if (tz.isMidnight(isoValue)) {
    const value = tz.changeToTheSecondBeforeMidnight(isoValue)?.toISOString() ?? isoValue
    return {value, displayTimeChanged: value !== isoValue}
  }
  return {value: isoValue, displayTimeChanged: false}
}

/**
 * Drop-in DateTimeInput that snaps midnight picks to 23:59:59 ("fancy midnight").
 *
 * onChange always fires the corrected value synchronously. The display, uniquely, holds
 * the raw pick until blur, then snaps (InstUI only redraws on a real value change). A
 * snap also fires a screen-reader-only announcement.
 */
const FancyMidnightDueDateInput = ({onChange, onBlur, value, ...rest}: DateTimeInputProps) => {
  const [displayValue, setDisplayValue] = useState(value)
  const lastEmittedRef = useRef(value)

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setDisplayValue(value)
      lastEmittedRef.current = value
    }
  }, [value])

  const handleChange = useCallback(
    (event: React.SyntheticEvent, isoValue?: string) => {
      const {value: corrected, displayTimeChanged} = normalizeDueDate(isoValue)

      onChange?.(event, corrected)
      lastEmittedRef.current = corrected

      if (!displayTimeChanged) {
        setDisplayValue(corrected)
        return
      }

      setDisplayValue(isoValue)
      showFlashAlert({
        message: I18n.t('Due date was automatically changed to %{time}', {
          time: tz.timeString(corrected),
        }),
        type: 'info',
        srOnly: true,
        politeness: 'polite',
      })
    },
    [onChange],
  )

  const handleBlur = useCallback(
    (event: React.SyntheticEvent) => {
      setDisplayValue(lastEmittedRef.current)
      onBlur?.(event)
    },
    [onBlur],
  )

  return (
    <DateTimeInput {...rest} value={displayValue} onChange={handleChange} onBlur={handleBlur} />
  )
}

export default FancyMidnightDueDateInput

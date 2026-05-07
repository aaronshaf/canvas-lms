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

import React, {useState} from 'react'
import {useDebouncedCallback} from 'use-debounce'
import {useScope as createI18nScope} from '@canvas/i18n'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {IconSearchLine} from '@instructure/ui-icons'
import {TextInput} from '@instructure/ui-text-input'

const I18n = createI18nScope('rubrics-list-search')

export type RubricsSearchInputProps = {
  onDebouncedChange: (value: string) => void
  delay?: number
}

export const RubricsSearchInput = ({onDebouncedChange, delay = 300}: RubricsSearchInputProps) => {
  const [value, setValue] = useState('')
  const debouncedChange = useDebouncedCallback(onDebouncedChange, delay)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    debouncedChange(e.target.value)
  }

  return (
    <TextInput
      renderLabel={<ScreenReaderContent>{I18n.t('Search Rubrics')}</ScreenReaderContent>}
      placeholder={I18n.t('Search...')}
      value={value}
      onChange={handleChange}
      width="17"
      renderBeforeInput={<IconSearchLine inline={false} />}
      data-testid="rubric-search-bar"
    />
  )
}

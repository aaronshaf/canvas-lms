/*
 * Copyright (C) 2020 - present Instructure, Inc.
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
import {Tag} from '@instructure/ui-tag'
import {Text} from '@instructure/ui-text'
import {TextInput} from '@instructure/ui-text-input'
import type {TextInputProps} from '@instructure/ui-text-input'
import {nanoid} from 'nanoid'
import {IconInfoLine} from '@instructure/ui-icons'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Tooltip} from '@instructure/ui-tooltip'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('PronounsInput')

export default function PronounsInput(): React.JSX.Element {
  // @ts-expect-error - ENV.PRONOUNS_LIST not typed in Canvas ENV global
  const pronounList = (ENV.PRONOUNS_LIST as (string | null)[]).filter(
    (x): x is string => x !== null,
  )
  const [pronouns, setPronouns] = useState<string[]>(pronounList)
  const [inputValue, setInputValue] = useState<string>('')
  const [inputId] = useState<string>(`new_pronoun_input_${nanoid()}`)

  const createNewTag = (value: string): React.JSX.Element => (
    <span key={`pronoun_tag_container_${value}`}>
      <Tag
        dismissible={true}
        text={value}
        margin="0 small 0 0"
        onClick={() => deletePronoun(value)}
      />
      <input name="account[pronouns][]" type="hidden" value={value} />
    </span>
  )

  const handleChange: TextInputProps['onChange'] = (_e, value) => {
    setInputValue(value)
  }

  const deletePronoun = (pronounToDelete: string): void => {
    setPronouns(prevPronouns => prevPronouns.filter(pronoun => pronounToDelete !== pronoun))
  }

  const handleKeyDown: TextInputProps['onKeyDown'] = e => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const trimmedValue = inputValue.trim()
      if (trimmedValue !== '') {
        setPronouns(prevPronouns => [...new Set([...prevPronouns, trimmedValue])])
        setInputValue('')
      }
    }
  }

  const infoToolTip = I18n.t(
    'These pronouns will be available to Canvas users in your account to choose from.',
  )

  const textInputProps = {
    id: inputId,
    'data-testid': 'test_pronoun_input' as const,
    value: inputValue,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    renderLabel: (
      <>
        <Text>{I18n.t('Available Pronouns')}</Text>
        <Tooltip renderTip={infoToolTip} on={['hover', 'focus']} color="primary">
          <span
            style={{margin: '0 10px 0 10px'}}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            <IconInfoLine data-testid="pronoun_info" />
            <ScreenReaderContent>{infoToolTip}</ScreenReaderContent>
          </span>
        </Tooltip>
      </>
    ),
    size: 'medium' as const,
    resize: 'vertical' as const,
    height: '4 rem',
    renderBeforeInput: pronouns.map(pronoun => createNewTag(pronoun)),
  }

  return <TextInput {...textInputProps} />
}

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

import React from 'react'
import {Tag} from '@instructure/ui-tag'
import {Text} from '@instructure/ui-text'
import {TextInput} from '@instructure/ui-text-input'
import {nanoid} from 'nanoid'
import {IconInfoLine} from '@instructure/ui-icons'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {Tooltip} from '@instructure/ui-tooltip'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('PronounsInput')

interface PronounsInputState {
  pronouns: string[]
  input_id: string
  value?: string
}

export default class PronounsInput extends React.Component<{}, PronounsInputState> {
  constructor(props: {}) {
    super(props)

    // @ts-expect-error - PRONOUNS_LIST is set by backend but not in GlobalEnv type
    const pronounList = ENV.PRONOUNS_LIST.filter((x: string | null): x is string => x !== null)

    this.state = {
      pronouns: pronounList,
      input_id: `new_pronoun_input_${nanoid()}`,
    }
  }

  createNewTag = (value: string) => (
    <span key={`pronoun_tag_container_${value}`}>
      <Tag
        dismissible={true}
        text={value}
        margin="0 small 0 0"
        onClick={() => this.deletePronoun(value)}
      />
      <input name="account[pronouns][]" type="hidden" value={value} />
    </span>
  )

  handleChange = (_e: React.ChangeEvent<HTMLInputElement>, value: string) => {
    this.setState({value})
  }

  deletePronoun = (pronounToDelete: string) => {
    this.setState(prevState => ({
      pronouns: prevState.pronouns.filter(pronoun => pronounToDelete !== pronoun),
    }))
  }

  render() {
    const infoToolTip = I18n.t(
      'These pronouns will be available to Canvas users in your account to choose from.',
    )
    return (
      <TextInput
        id={`${this.state.input_id}`}
        data-testid="test_pronoun_input"
        onChange={this.handleChange}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            this.setState(prevState => {
              if (prevState.value && prevState.value.trim() !== '') {
                const updatedPronouns = [...prevState.pronouns, prevState.value.trim()]
                return {
                  pronouns: [...new Set(updatedPronouns)],
                  input_id: prevState.input_id,
                  value: '',
                }
              }
              return prevState
            })
            const element = document.querySelector<HTMLInputElement>(`#${this.state.input_id}`)
            if (element) {
              element.value = ''
            }
          }
        }}
        renderLabel={
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
        }
        size="medium"
        renderBeforeInput={this.state.pronouns.map(pronoun => {
          return this.createNewTag(pronoun)
        })}
      />
    )
  }
}

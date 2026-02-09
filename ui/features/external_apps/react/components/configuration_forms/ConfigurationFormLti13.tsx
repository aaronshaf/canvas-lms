/*
 * Copyright (C) 2019 - present Instructure, Inc.
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
import {TextInput} from '@instructure/ui-text-input'
import {IconLtiLine} from '@instructure/ui-icons'
import {View} from '@instructure/ui-view'

const I18n = createI18nScope('external_tools')

type Message = {text: string; type: 'error' | 'hint'}

type ConfigurationFormLti13State = {
  messages: Message[]
  clientId: string
}

class ConfigurationFormLti13 extends React.Component<{}, ConfigurationFormLti13State> {
  constructor(props: {}) {
    super(props)
    this.state = {
      messages: [],
      clientId: '',
    }
  }

  clientIdInput: HTMLInputElement | null = null

  setClientId = (_event: React.ChangeEvent<HTMLInputElement>, clientId: string) => {
    this.setState({
      clientId,
      messages: this.messages({clientId}),
    })
  }

  getFormData() {
    return {
      client_id: this.state.clientId,
    }
  }

  isValid() {
    const {clientId} = this.state
    if (!clientId) {
      this.clientIdInput?.focus()
    }
    this.setState({
      messages: this.messages({clientId}),
    })
    return !!this.state.clientId
  }

  messages(nextState: {clientId: string}): Message[] {
    const {clientId} = nextState
    return clientId ? [] : [{text: I18n.t('Client ID is required'), type: 'error'}]
  }

  render() {
    return (
      <View as="div" margin="0 0 small 0">
        <TextInput
          name="client_id"
          value={this.state.clientId}
          renderLabel={I18n.t('Client ID')}
          renderAfterInput={() => <IconLtiLine />}
          inputRef={el => {
            this.clientIdInput = el
          }}
          onChange={this.setClientId}
          messages={[
            {
              text: I18n.t(
                'To obtain a client ID, an account admin will need to generate an LTI developer key.',
              ),
              type: 'hint',
            },
            ...this.state.messages,
          ]}
          isRequired={true}
        />
      </View>
    )
  }
}

export default ConfigurationFormLti13

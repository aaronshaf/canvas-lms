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
import {useScope as createI18nScope} from '@canvas/i18n'
import React from 'react'

// @ts-expect-error
import {Alert} from '@instructure/ui-alerts'
// @ts-expect-error
import {View} from '@instructure/ui-view'
// @ts-expect-error
import {CheckboxGroup, Checkbox} from '@instructure/ui-checkbox'
// @ts-expect-error
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
// @ts-expect-error
import {ToggleDetails} from '@instructure/ui-toggle-details'

const I18n = createI18nScope('react_developer_keys')

interface ServicesProps {
  validScopes?: Record<string, string>
  scopes?: string[]
}

interface ServicesState {
  scopes: string[]
}

export default class Services extends React.Component<ServicesProps, ServicesState> {
  static defaultProps = {
    scopes: [],
    validScopes: {},
  }

  constructor(props: ServicesProps) {
    super(props)
    this.state = {
      scopes: this.props.scopes || [],
    }
  }

  generateToolConfigurationPart = (): string[] => {
    return this.state.scopes
  }

  valid = (): boolean => true

  handleScopesSelectionChange = (scopes: string[]) => {
    this.setState({scopes})
  }

  render() {
    const {scopes} = this.state
    const {validScopes} = this.props

    return (
      <ToggleDetails summary={I18n.t('LTI Advantage Services')} fluidWidth={true}>
        <View as="div" margin="small">
          <Alert variant="warning" margin="small">
            {I18n.t(
              'Services must be supported by the tool in order to work. Check with your Tool Vendor to ensure service capabilities.',
            )}
          </Alert>
          <CheckboxGroup
            name="services"
            onChange={this.handleScopesSelectionChange}
            value={scopes}
            description={
              <ScreenReaderContent>{I18n.t('Check Services to enable')}</ScreenReaderContent>
            }
          >
            {Object.keys(validScopes || {}).map(key => {
              return (
                <Checkbox key={key} label={validScopes![key]} value={key} variant="toggle" />
              )
            })}
          </CheckboxGroup>
        </View>
      </ToggleDetails>
    )
  }
}

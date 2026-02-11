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
import {get} from 'es-toolkit/compat'

// @ts-expect-error
import {View} from '@instructure/ui-view'
// @ts-expect-error
import {FormFieldGroup} from '@instructure/ui-form-field'
// @ts-expect-error
import {ScreenReaderContent} from '@instructure/ui-a11y-content'

import RequiredValues from './RequiredValues'
import Services from './Services'
import AdditionalSettings from './AdditionalSettings'
import Placements from './Placements'
import type {ToolConfiguration} from '../types'

const I18n = createI18nScope('react_developer_keys')

interface ManualConfigurationFormProps {
  toolConfiguration?: ToolConfiguration
  validScopes: Record<string, string>
}

interface ManualConfigurationFormState {
  showMessages: boolean
}

export default class ManualConfigurationForm extends React.Component<
  ManualConfigurationFormProps,
  ManualConfigurationFormState
> {
  static defaultProps = {
    toolConfiguration: {},
  }

  private requiredRef?: RequiredValues
  private servicesRef?: Services
  private additionalRef?: AdditionalSettings
  private placementsRef?: Placements

  constructor(props: ManualConfigurationFormProps) {
    super(props)
    this.state = {
      showMessages: false,
    }
  }

  generateToolConfiguration = (): ToolConfiguration => {
    const toolConfig: ToolConfiguration = {
      ...this.requiredRef!.generateToolConfigurationPart(),
      scopes: this.servicesRef!.generateToolConfigurationPart(),
      ...this.additionalRef!.generateToolConfigurationPart(),
    }
    if (toolConfig.extensions && toolConfig.extensions[0]) {
      toolConfig.extensions[0].settings = toolConfig.extensions[0].settings || {}
      toolConfig.extensions[0].settings.placements =
        this.placementsRef!.generateToolConfigurationPart()
    }
    return toolConfig
  }

  valid = (): boolean => {
    this.setState({showMessages: true})
    return (
      this.requiredRef!.valid() &&
      this.servicesRef!.valid() &&
      this.additionalRef!.valid() &&
      this.placementsRef!.valid()
    )
  }

  setRequiredRef = (node: RequiredValues | null) => {
    if (node) this.requiredRef = node
  }

  setServicesRef = (node: Services | null) => {
    if (node) this.servicesRef = node
  }

  setAdditionalRef = (node: AdditionalSettings | null) => {
    if (node) this.additionalRef = node
  }

  setPlacementsRef = (node: Placements | null) => {
    if (node) this.placementsRef = node
  }

  additionalSettings = () => {
    const {toolConfiguration} = this.props
    return get(toolConfiguration, ['extensions', '0'])
  }

  customFields = () => {
    const {toolConfiguration} = this.props
    return get(toolConfiguration, ['custom_fields'])
  }

  placements = () => {
    const {toolConfiguration} = this.props
    return get(toolConfiguration, ['extensions', '0', 'settings', 'placements'])
  }

  render() {
    const {toolConfiguration, validScopes} = this.props

    return (
      <View>
        <FormFieldGroup
          description={<ScreenReaderContent>{I18n.t('Manual Configuration')}</ScreenReaderContent>}
          layout="stacked"
        >
          <RequiredValues
            ref={this.setRequiredRef}
            toolConfiguration={toolConfiguration || {}}
            showMessages={this.state.showMessages}
          />
          <Services
            ref={this.setServicesRef}
            validScopes={validScopes}
            scopes={toolConfiguration?.scopes}
          />
          <AdditionalSettings
            ref={this.setAdditionalRef}
            additionalSettings={this.additionalSettings()}
            custom_fields={this.customFields()}
            showMessages={this.state.showMessages}
          />
          <Placements ref={this.setPlacementsRef} placements={this.placements()} />
        </FormFieldGroup>
      </View>
    )
  }
}

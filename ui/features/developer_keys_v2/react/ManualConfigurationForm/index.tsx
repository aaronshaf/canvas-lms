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
import PropTypes from 'prop-types'
import React from 'react'
import {get} from 'es-toolkit/compat'

import {View} from '@instructure/ui-view'
import {FormFieldGroup} from '@instructure/ui-form-field'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'

import RequiredValues from './RequiredValues'
import Services from './Services'
import AdditionalSettings from './AdditionalSettings'
import Placements from './Placements'

const I18n = createI18nScope('react_developer_keys')

type ToolConfiguration = Record<string, unknown> & {scopes?: unknown}
type ValidScopes = Record<string, unknown>

type ConfigSectionRef = {
  generateToolConfigurationPart: () => Record<string, unknown>
  valid: () => boolean
}

const RequiredValuesUntyped = RequiredValues as unknown as React.ComponentClass<
  Record<string, unknown>
>
const ServicesUntyped = Services as unknown as React.ComponentClass<Record<string, unknown>>
const AdditionalSettingsUntyped = AdditionalSettings as unknown as React.ComponentClass<
  Record<string, unknown>
>
const PlacementsUntyped = Placements as unknown as React.ComponentClass<Record<string, unknown>>

export default class ManualConfigurationForm extends React.Component<{
  toolConfiguration?: ToolConfiguration
  validScopes: ValidScopes
}> {
  state = {
    showMessages: false,
  }

  requiredRef: ConfigSectionRef | null = null
  servicesRef: ConfigSectionRef | null = null
  additionalRef: ConfigSectionRef | null = null
  placementsRef: ConfigSectionRef | null = null

  generateToolConfiguration = () => {
    const toolConfig = {
      ...(this.requiredRef?.generateToolConfigurationPart() ?? {}),
      scopes: this.servicesRef?.generateToolConfigurationPart() ?? {},
      ...(this.additionalRef?.generateToolConfigurationPart() ?? {}),
    }
    // @ts-expect-error TS migration: toolConfig extensions shape isn't typed.
    toolConfig.extensions[0].settings.placements =
      this.placementsRef?.generateToolConfigurationPart()
    return toolConfig
  }

  valid = () => {
    this.setState({showMessages: true})
    return (
      !!this.requiredRef?.valid?.() &&
      !!this.servicesRef?.valid?.() &&
      !!this.additionalRef?.valid?.() &&
      !!this.placementsRef?.valid?.()
    )
  }

  setRequiredRef = (node: unknown) => {
    this.requiredRef = node as ConfigSectionRef | null
  }

  setServicesRef = (node: unknown) => {
    this.servicesRef = node as ConfigSectionRef | null
  }

  setAdditionalRef = (node: unknown) => {
    this.additionalRef = node as ConfigSectionRef | null
  }

  setPlacementsRef = (node: unknown) => {
    this.placementsRef = node as ConfigSectionRef | null
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
    const {toolConfiguration = {}, validScopes} = this.props

    return (
      <View>
        <FormFieldGroup
          description={<ScreenReaderContent>{I18n.t('Manual Configuration')}</ScreenReaderContent>}
          layout="stacked"
        >
          <RequiredValuesUntyped
            ref={this.setRequiredRef}
            toolConfiguration={toolConfiguration}
            showMessages={this.state.showMessages}
          />
          <ServicesUntyped
            ref={this.setServicesRef}
            validScopes={validScopes}
            scopes={toolConfiguration.scopes}
          />
          <AdditionalSettingsUntyped
            ref={this.setAdditionalRef}
            additionalSettings={this.additionalSettings()}
            custom_fields={this.customFields() as unknown as Record<string, string> | undefined}
            showMessages={this.state.showMessages}
          />
          <PlacementsUntyped ref={this.setPlacementsRef} placements={this.placements()} />
        </FormFieldGroup>
      </View>
    )
  }
}

// @ts-expect-error TS migration: react class static propTypes not typed.
ManualConfigurationForm.propTypes = {
  toolConfiguration: PropTypes.object,
  validScopes: PropTypes.object.isRequired,
}

// @ts-expect-error TS migration: react class static defaultProps not typed.
ManualConfigurationForm.defaultProps = {
  toolConfiguration: {},
}

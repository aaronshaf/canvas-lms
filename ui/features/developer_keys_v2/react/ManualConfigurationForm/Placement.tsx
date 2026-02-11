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
import React, {createRef, RefObject} from 'react'

// @ts-expect-error
import {Alert} from '@instructure/ui-alerts'
// @ts-expect-error
import {View} from '@instructure/ui-view'
// @ts-expect-error
import {FormFieldGroup} from '@instructure/ui-form-field'
// @ts-expect-error
import {RadioInputGroup, RadioInput} from '@instructure/ui-radio-input'
// @ts-expect-error
import {TextInput} from '@instructure/ui-text-input'
// @ts-expect-error
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
// @ts-expect-error
import {ToggleDetails} from '@instructure/ui-toggle-details'
// @ts-expect-error
import {NumberInput} from '@instructure/ui-number-input'

const I18n = createI18nScope('react_developer_keys')

const validationMessage = {
  url: [{text: I18n.t('Please enter a valid URL (e.g. https://example.com)'), type: 'error'}],
}

interface PlacementData {
  placement?: string
  message_type?: string
  target_link_uri?: string
  icon_url?: string
  text?: string
  selection_height?: number
  selection_width?: number
  launch_height?: number
  launch_width?: number
  [key: string]: any
}

interface PlacementProps {
  displayName: string
  placement?: PlacementData
  placementName: string
}

interface PlacementState {
  placement: PlacementData
  width: string
  height: string
  isTargetLinkUriValid: boolean
  isIconUrlValid: boolean
  showMessages: boolean
}

export default class Placement extends React.Component<PlacementProps, PlacementState> {
  private isValid = true
  private targetLinkUriRef: RefObject<HTMLInputElement> = createRef()
  private iconUrlRef: RefObject<HTMLInputElement> = createRef()

  private alwaysDeeplinking = [
    'editor_button',
    'migration_selection',
    'homework_submission',
    'conference_selection',
    'submission_type_selection',
    'ActivityAssetProcessor',
    'ActivityAssetProcessorContribution',
  ]

  private canBeEither = [
    'assignment_selection',
    'link_selection',
    'collaboration',
    'course_assignments_menu',
    'module_index_menu_modal',
    'module_menu_modal',
  ]

  // Placements that use launch_height/width instead of selection_height/width
  private launchPlacements = ['assignment_edit']

  constructor(props: PlacementProps) {
    super(props)
    let placement: PlacementData
    const {placement: propsPlacement = {}} = props
    if (this.alwaysDeeplinking.includes(props.placementName)) {
      placement = {...propsPlacement, message_type: 'LtiDeepLinkingRequest'}
    } else if (!propsPlacement.message_type) {
      placement = {...propsPlacement, message_type: 'LtiResourceLinkRequest'}
    } else {
      placement = propsPlacement
    }

    this.state = {
      placement,
      width: '',
      height: '',
      isTargetLinkUriValid: true,
      isIconUrlValid: true,
      showMessages: false,
    }
  }

  isLaunchPlacementType(placementName: string) {
    return this.launchPlacements.includes(placementName)
  }

  isAlwaysDeeplinking(placementName: string) {
    return this.alwaysDeeplinking.includes(placementName)
  }

  messageTypeSelectable(placementName: string) {
    return this.canBeEither.includes(placementName)
  }

  isSpecialType(placementName: string) {
    return (
      this.isAlwaysDeeplinking(placementName) ||
      (this.state.placement.message_type === 'LtiDeepLinkingRequest' &&
        this.messageTypeSelectable(placementName))
    )
  }

  generateToolConfigurationPart = (): PlacementData => {
    return this.state.placement
  }

  validateUrlField = (
    fieldValue: string | undefined,
    fieldStateKey: keyof PlacementState,
    fieldRef: RefObject<HTMLInputElement>,
  ) => {
    if (fieldValue && !URL.canParse(fieldValue)) {
      this.setState({[fieldStateKey]: false} as Pick<PlacementState, keyof PlacementState>)
      if (this.isValid) {
        fieldRef.current?.focus()
        this.isValid = false
        this.setState({showMessages: true})
      }
    } else {
      this.setState({[fieldStateKey]: true} as Pick<PlacementState, keyof PlacementState>)
    }
  }

  valid = (): boolean => {
    const {icon_url, target_link_uri} = this.state.placement
    this.isValid = true

    this.validateUrlField(target_link_uri, 'isTargetLinkUriValid', this.targetLinkUriRef)
    this.validateUrlField(icon_url, 'isIconUrlValid', this.iconUrlRef)

    return this.isValid
  }

  setOrDeletePlacementField = (key: string, value: string | number | undefined) => {
    this.setState(state => {
      const newPlacement = {...state.placement, [key]: value}
      if (value === '' || value === undefined) {
        delete newPlacement[key]
      }
      return {placement: newPlacement}
    })
  }

  handleTargetLinkUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    this.setOrDeletePlacementField('target_link_uri', value)
    this.validateUrlField(value, 'isTargetLinkUriValid', this.targetLinkUriRef)
  }

  handleMessageTypeChange = (_: React.SyntheticEvent, value: string) =>
    this.setState(state => ({placement: {...state.placement, message_type: value}}))

  handleIconUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    this.setOrDeletePlacementField('icon_url', value)
    this.validateUrlField(value, 'isIconUrlValid', this.iconUrlRef)
  }

  iconUrlText = (placementName: string) => {
    if (placementName === 'editor_button') {
      return I18n.t('Icon Url (required unless present in Additional Settings)')
    } else {
      return I18n.t('Icon Url')
    }
  }

  handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    this.setState(state => ({placement: {...state.placement, text: value}}))
  }

  handleHeightChange = (e: React.SyntheticEvent, value: string) => {
    const numVal = Number.parseInt(value, 10)
    const fieldName = (e.target as HTMLInputElement).name.includes('launch')
      ? 'launch_height'
      : 'selection_height'
    this.setOrDeletePlacementField(fieldName, !Number.isNaN(numVal) ? numVal : '')
  }

  handleWidthChange = (e: React.SyntheticEvent, value: string) => {
    const numVal = Number.parseInt(value, 10)
    const fieldName = (e.target as HTMLInputElement).name.includes('launch')
      ? 'launch_width'
      : 'selection_width'
    this.setOrDeletePlacementField(fieldName, !Number.isNaN(numVal) ? numVal : '')
  }

  render() {
    const {placement, showMessages} = this.state
    const {placementName, displayName} = this.props

    return (
      <View as="div" margin="medium 0">
        <ToggleDetails summary={displayName} fluidWidth={true}>
          <View as="div" margin="small">
            <FormFieldGroup
              description={<ScreenReaderContent>{I18n.t('Placement Values')}</ScreenReaderContent>}
            >
              {this.isSpecialType(placementName) ? (
                <Alert variant="warning" margin="small">
                  {I18n.t(
                    'This placement requires Deep Link support by the vendor. Check with your tool vendor to ensure they support this functionality',
                  )}
                </Alert>
              ) : null}
              <FormFieldGroup
                description={<ScreenReaderContent>{I18n.t('Request Values')}</ScreenReaderContent>}
                layout="columns"
              >
                <TextInput
                  name={`${placementName}_target_link_uri`}
                  value={placement.target_link_uri}
                  renderLabel={I18n.t('Target Link URI')}
                  inputRef={ref => {
                    ;(this.targetLinkUriRef as any).current = ref
                  }}
                  onChange={this.handleTargetLinkUriChange}
                  messages={
                    showMessages && !this.state.isTargetLinkUriValid ? validationMessage.url : []
                  }
                />
                <RadioInputGroup
                  name={`${placementName}_message_type`}
                  value={placement.message_type}
                  description={I18n.t('Select Message Type')}
                  required={true}
                  onChange={this.handleMessageTypeChange}
                  disabled={!this.messageTypeSelectable(placementName)}
                >
                  <RadioInput value="LtiDeepLinkingRequest" label="LtiDeepLinkingRequest" />
                  <RadioInput value="LtiResourceLinkRequest" label="LtiResourceLinkRequest" />
                </RadioInputGroup>
              </FormFieldGroup>
              <FormFieldGroup
                description={<ScreenReaderContent>{I18n.t('Label Values')}</ScreenReaderContent>}
                layout="columns"
              >
                <TextInput
                  name={`${placementName}_icon_url`}
                  value={placement.icon_url}
                  renderLabel={this.iconUrlText(placementName)}
                  inputRef={ref => {
                    ;(this.iconUrlRef as any).current = ref
                  }}
                  onChange={this.handleIconUrlChange}
                  isRequired={placementName === 'editor_button'}
                  messages={showMessages && !this.state.isIconUrlValid ? validationMessage.url : []}
                />
                <TextInput
                  name={`${placementName}_text`}
                  value={placement.text}
                  renderLabel={I18n.t('Text')}
                  onChange={this.handleTextChange}
                />
              </FormFieldGroup>
              <FormFieldGroup
                description={<ScreenReaderContent>{I18n.t('Display Values')}</ScreenReaderContent>}
                layout="columns"
              >
                {this.isLaunchPlacementType(placementName) ? (
                  <NumberInput
                    name={`${placementName}_launch_height`}
                    value={placement.launch_height?.toString()}
                    renderLabel={I18n.t('Launch Height')}
                    onChange={this.handleHeightChange}
                    showArrows={false}
                  />
                ) : (
                  <NumberInput
                    name={`${placementName}_selection_height`}
                    value={placement.selection_height?.toString()}
                    renderLabel={I18n.t('Selection Height')}
                    onChange={this.handleHeightChange}
                    showArrows={false}
                  />
                )}
                {this.isLaunchPlacementType(placementName) ? (
                  <NumberInput
                    name={`${placementName}_launch_width`}
                    value={placement.launch_width?.toString()}
                    renderLabel={I18n.t('Launch Width')}
                    onChange={this.handleWidthChange}
                    showArrows={false}
                  />
                ) : (
                  <NumberInput
                    name={`${placementName}_selection_width`}
                    value={placement.selection_width?.toString()}
                    renderLabel={I18n.t('Selection Width')}
                    onChange={this.handleWidthChange}
                    showArrows={false}
                  />
                )}
              </FormFieldGroup>
            </FormFieldGroup>
          </View>
        </ToggleDetails>
      </View>
    )
  }
}

/*
 * Copyright (C) 2018 - present Instructure, Inc.
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
import {Heading} from '@instructure/ui-heading'
// @ts-expect-error
import {SimpleSelect} from '@instructure/ui-simple-select'
// @ts-expect-error
import {TextArea} from '@instructure/ui-text-area'
// @ts-expect-error
import {TextInput} from '@instructure/ui-text-input'
// @ts-expect-error
import {Grid} from '@instructure/ui-grid'
// @ts-expect-error
import {View} from '@instructure/ui-view'
// @ts-expect-error
import {Button} from '@instructure/ui-buttons'

import ManualConfigurationForm from './ManualConfigurationForm/index'
import type {ToolConfiguration} from './types'

const I18n = createI18nScope('react_developer_keys')

const validationMessage = {
  text: [{text: I18n.t('Field cannot be blank.'), type: 'error'}],
  url: [{text: I18n.t('Please enter a valid URL (e.g. https://example.com)'), type: 'error'}],
  json: [
    {text: I18n.t('Json is not valid. Please submit properly formatted json.'), type: 'error'},
  ],
}

interface ToolConfigurationFormProps {
  toolConfiguration: ToolConfiguration
  toolConfigurationUrl?: string
  validScopes: Record<string, string>
  editing: boolean
  showRequiredMessages: boolean
  updateToolConfigurationUrl: (url: string) => void
  configurationMethod: string
  updateConfigurationMethod: (method: string) => void
  prettifyPastedJson: () => void
  invalidJson?: string | null
  jsonString?: string
  updatePastedJson?: (json: string, cursorAtEnd: boolean) => void
  canPrettify?: boolean
}

interface ToolConfigurationFormState {
  isUrlValid: boolean
  jsonUrl: string
  showMessages: boolean
}

export default class ToolConfigurationForm extends React.Component<
  ToolConfigurationFormProps,
  ToolConfigurationFormState
> {
  private isValid = true
  private jsonRef: RefObject<HTMLTextAreaElement> = createRef()
  private urlRef: RefObject<HTMLInputElement> = createRef()
  private manualConfigRef?: ManualConfigurationForm

  constructor(props: ToolConfigurationFormProps) {
    super(props)
    this.state = {
      isUrlValid: true,
      jsonUrl: this.props.toolConfigurationUrl || '',
      showMessages: false,
    }
  }

  get toolConfiguration() {
    if (this.props.invalidJson !== null && this.props.invalidJson !== undefined) {
      return this.props.invalidJson
    }
    if (this.props.jsonString) {
      return this.props.jsonString
    }
    const {toolConfiguration} = this.props
    return toolConfiguration ? JSON.stringify(toolConfiguration, null, 4) : ''
  }

  generateToolConfiguration = (): ToolConfiguration => {
    return this.manualConfigRef!.generateToolConfiguration()
  }

  validateUrlField = (
    fieldValue: string,
    fieldStateKey: keyof ToolConfigurationFormState,
    fieldRef: RefObject<HTMLInputElement>,
  ) => {
    if (!fieldValue || (fieldValue && !URL.canParse(fieldValue))) {
      this.setState({[fieldStateKey]: false} as Pick<
        ToolConfigurationFormState,
        keyof ToolConfigurationFormState
      >)
      if (this.isValid) {
        fieldRef.current?.focus()
        this.isValid = false
      }
    } else {
      this.setState({[fieldStateKey]: true} as Pick<
        ToolConfigurationFormState,
        keyof ToolConfigurationFormState
      >)
    }
  }

  valid = (): boolean => {
    this.isValid = true

    if (this.isManual()) {
      return this.manualConfigRef!.valid()
    } else if (this.isJson()) {
      if (this.props.invalidJson || this.toolConfiguration === '{}') {
        this.jsonRef.current?.focus()
        this.isValid = false
        this.setState({showMessages: true})
      }
    } else if (this.isUrl()) {
      this.validateUrlField(this.state.jsonUrl, 'isUrlValid', this.urlRef)
    }

    return this.isValid
  }

  isManual = () => {
    return this.props.configurationMethod === 'manual'
  }

  isJson = () => {
    return this.props.configurationMethod === 'json'
  }

  isUrl = () => {
    return this.props.configurationMethod === 'url'
  }

  updatePastedJson = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target
    this.props.updatePastedJson?.(target.value, target.selectionEnd === target.value.length)
  }

  handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    try {
      JSON.parse(e.target.value)
      this.setState({showMessages: false})
      this.updatePastedJson(e)
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.setState({showMessages: true})
        this.updatePastedJson(e)
      }
    }
  }

  handleToolConfigUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    this.setState({jsonUrl: value})
    this.validateUrlField(value, 'isUrlValid', this.urlRef)
    this.props.updateToolConfigurationUrl(value)
  }

  handleConfigTypeChange = (_e: React.SyntheticEvent, option: {value: string}) => {
    this.props.updateConfigurationMethod(option.value)
    if (option.value === 'json') {
      this.props.updatePastedJson?.(this.toolConfiguration, true)
    }
  }

  setManualConfigRef = (node: ManualConfigurationForm | null) => {
    if (node) this.manualConfigRef = node
  }

  jsonConfigurationInput = () => (
    <Grid>
      <Grid.Row>
        <Grid.Col>
          <TextArea
            name="tool_configuration"
            value={this.toolConfiguration}
            onChange={this.handleJsonChange}
            label={I18n.t('LTI 1.3 Configuration')}
            textareaRef={ref => {
              ;(this.jsonRef as any).current = ref
            }}
            maxHeight="20rem"
            required={this.props.configurationMethod === 'json'}
            messages={this.state.showMessages ? validationMessage.json : []}
          />
        </Grid.Col>
      </Grid.Row>
      <Grid.Row>
        <Grid.Col>
          <Button
            onClick={this.props.prettifyPastedJson}
            interaction={this.props.canPrettify ? 'enabled' : 'disabled'}
          >
            {I18n.t('Prettify JSON')}
          </Button>
        </Grid.Col>
      </Grid.Row>
    </Grid>
  )

  urlConfigurationInput = () => (
    <TextInput
      name="tool_configuration_url"
      value={this.state.jsonUrl}
      isRequired={this.props.configurationMethod === 'url'}
      inputRef={ref => {
        ;(this.urlRef as any).current = ref
      }}
      onChange={this.handleToolConfigUrlChange}
      renderLabel={I18n.t('JSON URL')}
      messages={
        this.props.showRequiredMessages && !this.state.isUrlValid ? validationMessage.url : []
      }
    />
  )

  manualConfigurationInput = (visible: boolean) => (
    <div style={{display: visible ? undefined : 'none'}}>
      <ManualConfigurationForm
        ref={this.setManualConfigRef}
        toolConfiguration={this.props.toolConfiguration}
        validScopes={this.props.validScopes}
      />
    </div>
  )

  renderOptions() {
    return [
      <SimpleSelect.Option id="manual" key="manual" value="manual">
        {I18n.t('Manual Entry')}
      </SimpleSelect.Option>,
      <SimpleSelect.Option id="json" key="json" value="json">
        {I18n.t('Paste JSON')}
      </SimpleSelect.Option>,
      this.props.editing ? null : (
        <SimpleSelect.Option id="url" key="url" value="url">
          {I18n.t('Enter URL')}
        </SimpleSelect.Option>
      ),
    ].filter(o => o !== null)
  }

  renderBody() {
    const {configurationMethod} = this.props

    return (
      <View>
        <Heading level="h2" as="h2" margin="0 0 x-small">
          {I18n.t('Configure')}
        </Heading>
        <SimpleSelect
          renderLabel={I18n.t('Method')}
          onChange={this.handleConfigTypeChange}
          value={this.props.configurationMethod}
        >
          {this.renderOptions()}
        </SimpleSelect>
        <br />
        {configurationMethod === 'json' && this.jsonConfigurationInput()}
        {configurationMethod === 'url' && this.urlConfigurationInput()}
        {
          this.manualConfigurationInput(
            configurationMethod === 'manual',
          ) /* show invisible to preserve state */
        }
      </View>
    )
  }

  render() {
    return (
      <Grid.Row>
        <Grid.Col>{this.renderBody()}</Grid.Col>
      </Grid.Row>
    )
  }
}

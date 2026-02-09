/*
 * Copyright (C) 2014 - present Instructure, Inc.
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
import {map, each, isEmpty, compact} from 'es-toolkit/compat'
import $ from 'jquery'
import React from 'react'
import createReactClass from 'create-react-class'
import PropTypes from 'prop-types'
import Modal from '@canvas/instui-bindings/react/InstuiModal'
import ConfigOptionField from './ConfigOptionField'
import ExternalTool from '@canvas/external-tools/backbone/models/ExternalTool'
import '@canvas/jquery/jquery.disableWhileLoading'
import '@canvas/rails-flash-notifications'
import {Button} from '@instructure/ui-buttons'

const I18n = createI18nScope('external_tools')

type AppConfigOption = {
  name: string
  param_type: string
  default_value: unknown
  is_required?: boolean | 1
  description: string
}

type App = {
  name: string
  short_name: string
  requires_secret?: boolean
  config_options: AppConfigOption[]
}

type Field = {
  type: string
  value: unknown
  required: boolean
  description: string
}

type AddAppProps = {
  handleToolInstalled: () => void
  app: App
}

type AddAppState = {
  modalIsOpen: boolean
  errorMessage: string | null
  fields: Record<string, Field>
  invalidFields?: string[]
  _isMounted: boolean
}

type MutableRef<T> = {current: T}

type ExternalToolModel = {
  on: (...args: unknown[]) => unknown
  off: (...args: unknown[]) => unknown
  set: (...args: unknown[]) => unknown
  save: (...args: unknown[]) => unknown
}

export default createReactClass<AddAppProps, AddAppState>({
  displayName: 'AddApp',

  addToolRef: React.createRef<HTMLAnchorElement>(),
  addButtonRef: {current: null} as MutableRef<unknown>,

  propTypes: {
    handleToolInstalled: PropTypes.func.isRequired,
    app: PropTypes.object.isRequired,
  },

  getInitialState() {
    return {
      modalIsOpen: false,
      errorMessage: null,
      fields: {},
      _isMounted: false,
    }
  },

  componentDidMount() {
    this.setState({_isMounted: true})
    const fields: Record<string, Field> = {}

    fields.name = {
      type: 'text',
      value: this.props.app.name,
      required: true,
      description: I18n.t('Name'),
    }

    if (this.props.app.requires_secret) {
      fields.consumer_key = {
        type: 'text',
        value: '',
        required: true,
        description: I18n.t('Consumer Key'),
      }
      fields.shared_secret = {
        type: 'text',
        value: '',
        required: true,
        description: I18n.t('Shared Secret'),
      }
    }

    this.props.app.config_options.forEach((opt: AppConfigOption) => {
      fields[opt.name] = {
        type: opt.param_type,
        value: opt.default_value,
        required: opt.is_required === 1 || opt.is_required === true,
        description: opt.description,
      }
    })

    try {
      this.setState({fields}, this.validateConfig as unknown as (() => void) | undefined)
      ;(this.addToolRef as unknown as React.RefObject<HTMLAnchorElement>).current?.focus()
    } catch (err) {
      console.error(err)
    }
  },

  componentWillUnmount() {
    this.setState({_isMounted: false})
  },

  handleChange(e: {target: {value: string; type: string; checked: boolean}}) {
    const target = e.target
    let value: unknown = target.value
    const name = $(target).data('rel')
    const fields = this.state.fields

    if (target.type === 'checkbox') {
      value = target.checked
    }

    fields[name as string].value = value
    this.setState({fields}, this.validateConfig as unknown as (() => void) | undefined)
  },

  validateConfig() {
    const invalidFields = compact(
      map(this.state.fields, (v: Field, k: string) => {
        if (v.required && isEmpty(v.value)) {
          return k
        }
      }),
    )
    this.setState({invalidFields})
  },

  openModal(e: {preventDefault: () => void}) {
    e.preventDefault()
    if (this.state._isMounted) {
      this.setState({modalIsOpen: true})
    }
  },

  closeModal(cb?: unknown) {
    if (typeof cb === 'function') {
      this.setState({modalIsOpen: false}, cb as () => void)
    } else {
      this.setState({modalIsOpen: false})
    }
  },

  configSettings() {
    const queryParams: Record<string, string> = {}
    each(this.state.fields, (v: Field, k: string) => {
      if (v.type === 'checkbox') {
        if (!v.value) return
        queryParams[k] = '1'
      } else queryParams[k] = encodeURIComponent(String(v.value))
    })
    delete queryParams.consumer_key
    delete queryParams.shared_secret

    return queryParams
  },

  submit(e: {target: unknown}) {
    const newTool = new ExternalTool() as unknown as ExternalToolModel
    newTool.on('sync', this.onSaveSuccess as unknown as (...args: unknown[]) => void, this)
    newTool.on('error', this.onSaveFail as unknown as (...args: unknown[]) => void, this)
    if (!isEmpty(this.state.invalidFields)) {
      const fields = this.state.fields
      const invalidFieldNames = map(this.state.invalidFields, k => fields[k].description).join(', ')
      this.setState({
        errorMessage: I18n.t('The following fields are invalid: %{fields}', {
          fields: invalidFieldNames,
        }),
      })
      return
    }
    if (this.props.app.requires_secret) {
      newTool.set('consumer_key', this.state.fields.consumer_key.value)
      newTool.set('shared_secret', this.state.fields.shared_secret.value)
    } else {
      newTool.set('consumer_key', 'N/A')
      newTool.set('shared_secret', 'N/A')
    }

    newTool.set('name', this.state.fields.name.value)
    newTool.set('app_center_id', this.props.app.short_name)
    newTool.set(
      'config_settings',
      (this.configSettings as unknown as () => Record<string, string>)(),
    )

    $(e.target as unknown as Element).prop('disabled', true)
    ;(this.addButtonRef as unknown as MutableRef<unknown>).current = e.target

    newTool.save()
  },

  onSaveSuccess(tool: ExternalToolModel) {
    $(
      ((this.addButtonRef as unknown as MutableRef<unknown>).current as unknown as Element) ?? null,
    ).removeAttr('disabled')
    tool.off('sync', this.onSaveSuccess as unknown as (...args: unknown[]) => void)
    this.setState({errorMessage: null})
    ;(this.closeModal as unknown as (cb?: unknown) => void)(this.props.handleToolInstalled)
  },

  onSaveFail(_tool: unknown) {
    $(
      ((this.addButtonRef as unknown as MutableRef<unknown>).current as unknown as Element) ?? null,
    ).removeAttr('disabled')
    this.setState({
      errorMessage: I18n.t('There was an error in processing your request'),
    })
  },

  configOptions() {
    return map(this.state.fields, (v: Field, k: string) => (
      <ConfigOptionField
        name={k}
        type={v.type}
        ref={'option_' + k}
        key={'option_' + k}
        value={v.value}
        required={v.required}
        aria-required={v.required}
        description={v.description}
        handleChange={this.handleChange}
      />
    ))
  },

  errorMessage() {
    if (this.state.errorMessage) {
      $.screenReaderFlashMessage(this.state.errorMessage)
      return <div className="alert alert-error">{this.state.errorMessage}</div>
    }
  },

  render() {
    return (
      <div className="AddApp">
        {/* TODO: use InstUI button */}
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a
          href="#"
          ref={this.addToolRef as unknown as React.RefObject<HTMLAnchorElement>}
          className="btn btn-primary btn-block add_app icon-add"
          onClick={this.openModal as unknown as React.MouseEventHandler<HTMLAnchorElement>}
        >
          {I18n.t('Add App')}
        </a>

        <Modal
          open={this.state.modalIsOpen}
          onDismiss={this.closeModal as unknown as () => void}
          label={I18n.t('Add App')}
          shouldCloseOnDocumentClick={false}
        >
          <Modal.Body>
            {(this.errorMessage as unknown as () => React.ReactNode)()}
            <form>{(this.configOptions as unknown as () => React.ReactNode)()}</form>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.closeModal as unknown as (() => void) | undefined}>
              {I18n.t('Close')}
            </Button>
            &nbsp;
            <Button onClick={this.submit as unknown as (() => void) | undefined} color="primary">
              {I18n.t('Add App')}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    )
  },
})

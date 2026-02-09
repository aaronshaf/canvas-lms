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
import PropTypes from 'prop-types'
import React from 'react'
import {RadioInputGroup, RadioInput} from '@instructure/ui-radio-input'
import {Checkbox} from '@instructure/ui-checkbox'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {confirm} from '@canvas/instui-bindings/react/Confirm'

const I18n = createI18nScope('react_developer_keys')

type DeveloperKeyData = {
  id: string
  inherited_to?: string
  name?: string
  tool_configuration?: {title?: string} | null
  developer_key_account_binding?: {
    workflow_state?: string
    account_owns_binding?: boolean
  } | null
}

type DeveloperKeyState = 'on' | 'off' | 'allow'

type DeveloperKeyStateControlProps = {
  store: {dispatch: (action: unknown) => unknown}
  actions: {
    setBindingWorkflowState: (
      developerKey: DeveloperKeyData,
      contextId: string,
      newState: DeveloperKeyState,
    ) => unknown
  }
  developerKey: DeveloperKeyData
  ctx: {params: {contextId: string}}
}

type FocusableHandle = {focus?: () => void} | null

export default class DeveloperKeyStateControl extends React.Component<DeveloperKeyStateControlProps> {
  onToggle: FocusableHandle = null
  offToggle: FocusableHandle = null
  allowToggle: FocusableHandle = null

  confirmStateChange = (developerKey: DeveloperKeyData, newState: DeveloperKeyState) => {
    const keyName = developerKey?.name || developerKey?.tool_configuration?.title

    const title =
      newState === 'on'
        ? I18n.t('Turn On Developer Key')
        : newState === 'off'
          ? I18n.t('Turn Off Developer Key')
          : I18n.t('Set Developer Key to "Allow"')

    return confirm({
      title,
      confirmButtonLabel:
        newState === 'on'
          ? I18n.t('Switch to On')
          : newState === 'off'
            ? I18n.t('Switch to Off')
            : newState === 'allow'
              ? I18n.t('Switch to Allow')
              : I18n.t('Confirm'),
      message: keyName
        ? I18n.t('Are you sure you want to change the state of the developer key "%{keyName}"?', {
            keyName,
          })
        : I18n.t('Are you sure you want to change the state of this developer key?'),
    })
  }

  setBindingState = async (newValue: DeveloperKeyState) => {
    const confirmation = await this.confirmStateChange(this.props.developerKey, newValue)
    if (!confirmation) {
      return
    }

    this.props.store.dispatch(
      this.props.actions.setBindingWorkflowState(
        this.props.developerKey,
        this.props.ctx.params.contextId,
        newValue,
      ),
    )
  }

  isDisabled() {
    if (this.props.developerKey.inherited_to === 'child_account') {
      return true
    }
    const devKeyBinding = this.props.developerKey.developer_key_account_binding
    if (!devKeyBinding || this.radioGroupValue() === 'allow') {
      return false
    }
    return !devKeyBinding.account_owns_binding
  }

  radioGroupValue() {
    const devKeyBinding = this.props.developerKey.developer_key_account_binding
    if (devKeyBinding) {
      return devKeyBinding.workflow_state || 'allow'
    } else if (!this.isSiteAdmin()) {
      return 'off'
    } else {
      return 'allow'
    }
  }

  isSiteAdmin() {
    return this.props.ctx.params.contextId === 'site_admin'
  }

  getDefaultValue() {
    return this.radioGroupValue() === 'allow' && !this.isSiteAdmin()
      ? 'off'
      : this.radioGroupValue()
  }

  focusToggleGroup = () => {
    const defaultValue = this.getDefaultValue()
    const toggle =
      defaultValue === 'on'
        ? this.onToggle
        : defaultValue === 'off'
          ? this.offToggle
          : this.allowToggle
    toggle?.focus?.()
  }

  refOnToggle = (node: FocusableHandle) => {
    this.onToggle = node
  }

  refOffToggle = (node: FocusableHandle) => {
    this.offToggle = node
  }

  refCheckboxToggle = (node: FocusableHandle) => {
    // Only onToggle and offToggle are set, since a checkbox should only
    // be used for non-siteadmin keys, so the allowToggle function *shouldn't*
    // ever get called.
    this.onToggle = node
    this.offToggle = node
  }

  getKeyName() {
    return this.props.developerKey.name || I18n.t('Unnamed Key')
  }

  render() {
    if (this.isSiteAdmin()) {
      return (
        <RadioInputGroup
          size="medium"
          variant="toggle"
          defaultValue={this.getDefaultValue()}
          description={
            <ScreenReaderContent>{I18n.t('Key state for the current account')}</ScreenReaderContent>
          }
          onChange={(_e, val) => void this.setBindingState(val as DeveloperKeyState)}
          disabled={this.isDisabled() || ENV.devKeysReadOnly}
          name={this.props.developerKey.id}
          value={this.radioGroupValue()}
        >
          <RadioInput
            ref={this.refOnToggle}
            label={
              <div>
                {I18n.t('On')}
                <ScreenReaderContent>
                  {I18n.t('On for key: %{keyName}', {keyName: this.getKeyName()})}
                </ScreenReaderContent>
              </div>
            }
            value="on"
            context="success"
          />
          {this.isSiteAdmin() && (
            <RadioInput
              ref={(node: FocusableHandle) => {
                this.allowToggle = node
              }}
              label={
                <div>
                  {I18n.t('Allow')}
                  <ScreenReaderContent>
                    {I18n.t('Allow for key: %{keyName}', {keyName: this.getKeyName()})}
                  </ScreenReaderContent>
                </div>
              }
              value="allow"
              context="off"
            />
          )}
          <RadioInput
            ref={this.refOffToggle}
            label={
              <div>
                {I18n.t('Off')}
                <ScreenReaderContent>
                  {I18n.t('Off for key: %{keyName}', {keyName: this.getKeyName()})}
                </ScreenReaderContent>
              </div>
            }
            value="off"
            context="danger"
          />
        </RadioInputGroup>
      )
    } else {
      return (
        <Checkbox
          ref={this.refCheckboxToggle}
          label={
            <ScreenReaderContent>
              {I18n.t('%{status} for key: %{keyName}', {
                status: this.radioGroupValue(),
                keyName: this.getKeyName(),
              })}
            </ScreenReaderContent>
          }
          variant="toggle"
          checked={this.radioGroupValue() === 'on'}
          disabled={this.isDisabled()}
          name={this.props.developerKey.id}
          onChange={(e: {target: {checked: boolean}}) => {
            const newValue = e.target.checked ? 'on' : 'off'
            this.setBindingState(newValue)
          }}
        />
      )
    }
  }
}

// @ts-expect-error TS migration: react class static propTypes not typed.
DeveloperKeyStateControl.propTypes = {
  store: PropTypes.shape({
    dispatch: PropTypes.func.isRequired,
  }).isRequired,
  actions: PropTypes.shape({
    setBindingWorkflowState: PropTypes.func.isRequired,
  }).isRequired,
  developerKey: PropTypes.shape({
    id: PropTypes.string.isRequired,
    inherited_to: PropTypes.string,
    workflow_state: PropTypes.string,
    name: PropTypes.string,
    developer_key_account_binding: PropTypes.shape({
      workflow_state: PropTypes.string.isRequired,
      account_owns_binding: PropTypes.bool,
    }),
  }),
  ctx: PropTypes.shape({
    params: PropTypes.shape({
      contextId: PropTypes.string.isRequired,
    }),
  }).isRequired,
}

// @ts-expect-error TS migration: react class static defaultProps not typed.
DeveloperKeyStateControl.defaultProps = {
  developerKey: {id: ''},
}

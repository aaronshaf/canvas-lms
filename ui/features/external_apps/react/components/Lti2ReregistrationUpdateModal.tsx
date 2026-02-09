/*
 * Copyright (C) 2015 - present Instructure, Inc.
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
import PropTypes from 'prop-types'
import Modal from '@canvas/instui-bindings/react/InstuiModal'
import store from '../lib/ExternalAppsStore'
import {Button} from '@instructure/ui-buttons'

const I18n = createI18nScope('external_tools')

type Tool = Record<string, unknown> & {name?: string}

type Lti2ReregistrationUpdateModalProps = {
  tool: Tool
  returnFocus?: () => void
}

type Lti2ReregistrationUpdateModalState = {
  modalIsOpen: boolean
}

type ExternalAppsStore = {
  acceptUpdate: (tool: Tool) => void
  dismissUpdate: (tool: Tool) => void
}

const extAppStore = store as unknown as ExternalAppsStore

export default class Lti2ReregistrationUpdateModal extends React.Component<
  Lti2ReregistrationUpdateModalProps,
  Lti2ReregistrationUpdateModalState
> {
  static propTypes = {
    tool: PropTypes.object.isRequired,
    returnFocus: PropTypes.func,
  }

  state: Lti2ReregistrationUpdateModalState = {
    modalIsOpen: false,
  }

  // Not currently used by this component directly, but kept for backwards compatibility
  // with callers that toggle the modal via a ref.
  openModal = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    this.setState({modalIsOpen: true})
  }

  closeModal = () => {
    this.setState({modalIsOpen: false})
    this.props.returnFocus?.()
  }

  closeModalAndThen = (cb: () => void) => {
    this.setState({modalIsOpen: false}, cb)
    this.props.returnFocus?.()
  }

  acceptUpdate = () => {
    this.closeModalAndThen(() => {
      extAppStore.acceptUpdate(this.props.tool)
    })
  }

  dismissUpdate = () => {
    this.closeModalAndThen(() => {
      extAppStore.dismissUpdate(this.props.tool)
    })
  }

  render() {
    return (
      <Modal
        open={this.state.modalIsOpen}
        onDismiss={this.closeModal}
        label={I18n.t('Update %{tool}', {tool: this.props.tool.name})}
      >
        <Modal.Body>{I18n.t('Would you like to accept or dismiss this update?')}</Modal.Body>
        <Modal.Footer>
          <Button onClick={this.closeModal}>{I18n.t('Close')}</Button>
          &nbsp;
          <Button onClick={this.dismissUpdate} color="danger">
            {I18n.t('Dismiss')}
          </Button>
          &nbsp;
          <Button onClick={this.acceptUpdate} color="primary">
            {I18n.t('Accept')}
          </Button>
        </Modal.Footer>
      </Modal>
    )
  }
}

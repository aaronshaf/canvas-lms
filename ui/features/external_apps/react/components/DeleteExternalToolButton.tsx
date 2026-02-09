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
import React from 'react'
import PropTypes from 'prop-types'
import {Button} from '@instructure/ui-buttons'
import Modal from '@canvas/instui-bindings/react/InstuiModal'
import store from '../lib/ExternalAppsStore'

const I18n = createI18nScope('external_tools')

type Tool = {name?: string} & Record<string, unknown>

type DeleteExternalToolButtonProps = {
  tool: Tool
  returnFocus: (opts?: {passFocusUp?: boolean}) => void
  canDelete: boolean
}

type DeleteExternalToolButtonState = {
  modalIsOpen: boolean
}

type ExternalAppsStore = {
  delete: (...args: unknown[]) => unknown
}

const extAppStore = store as unknown as ExternalAppsStore

export default class DeleteExternalToolButton extends React.Component<
  DeleteExternalToolButtonProps,
  DeleteExternalToolButtonState
> {
  static propTypes = {
    tool: PropTypes.shape({name: PropTypes.string}).isRequired,
    returnFocus: PropTypes.func.isRequired,
    canDelete: PropTypes.bool.isRequired,
  }

  state: DeleteExternalToolButtonState = {
    modalIsOpen: false,
  }

  isDeleting = false
  btnTriggerDelete = React.createRef<HTMLAnchorElement>()

  shouldComponentUpdate() {
    return !this.isDeleting
  }

  openModal = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    this.setState({modalIsOpen: true})
  }

  closeModal = (cb?: unknown) => {
    if (typeof cb === 'function') {
      this.setState({modalIsOpen: false}, cb as () => void)
    } else {
      this.setState({modalIsOpen: false})
      this.props.returnFocus()
    }
  }

  deleteTool = () => {
    this.isDeleting = true
    this.closeModal(() => {
      extAppStore.delete(this.props.tool)
      this.isDeleting = false
      this.props.returnFocus({passFocusUp: true})
    })
  }

  render() {
    if (this.props.canDelete) {
      return (
        <li role="presentation" className="DeleteExternalToolButton">
          {/* TODO: use InstUI button */}
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a
            href="#"
            tabIndex={-1}
            role="button"
            ref={this.btnTriggerDelete}
            aria-label={I18n.t('Delete %{toolName} App', {toolName: this.props.tool.name})}
            className="icon-trash"
            onClick={this.openModal}
          >
            {I18n.t('Delete')}
          </a>
          <Modal
            open={this.state.modalIsOpen}
            onDismiss={() => this.closeModal()}
            label={I18n.t('Delete %{tool} App?', {tool: this.props.tool.name})}
          >
            <Modal.Body>{I18n.t('Are you sure you want to remove this tool?')}</Modal.Body>
            <Modal.Footer>
              <Button onClick={() => this.closeModal()}>{I18n.t('Close')}</Button>
              &nbsp;
              <Button onClick={this.deleteTool} color="danger" data-testid="modal-delete-button">
                {I18n.t('Delete')}
              </Button>
            </Modal.Footer>
          </Modal>
        </li>
      )
    }
    return false
  }
}

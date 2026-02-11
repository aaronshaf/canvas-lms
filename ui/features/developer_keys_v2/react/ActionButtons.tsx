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
import React from 'react'

// @ts-expect-error
import {IconButton} from '@instructure/ui-buttons'
// @ts-expect-error
import {Tooltip} from '@instructure/ui-tooltip'
// @ts-expect-error
import {IconEditLine, IconEyeLine, IconOffLine, IconTrashLine} from '@instructure/ui-icons'
import {confirmDanger} from '@canvas/instui-bindings/react/Confirm'
import type {DeveloperKey} from './types'

const I18n = createI18nScope('react_developer_keys')

interface DeveloperKeyActionButtonsProps {
  dispatch: (action: any) => void
  makeVisibleDeveloperKey: (key: DeveloperKey) => any
  makeInvisibleDeveloperKey: (key: DeveloperKey) => any
  deleteDeveloperKey: (key: DeveloperKey) => any
  editDeveloperKey: (key: DeveloperKey) => any
  developerKeysModalOpen: (type: string) => any
  ltiKeysSetLtiKey: (value: boolean) => any
  contextId: string
  developerKey: DeveloperKey
  visible: boolean
  developerName: string
  onDelete: (id: string) => void
  showVisibilityToggle?: boolean
}

class DeveloperKeyActionButtons extends React.Component<DeveloperKeyActionButtonsProps> {
  static defaultProps = {
    showVisibilityToggle: true,
  }

  private deleteLink?: HTMLButtonElement

  makeVisibleLinkHandler = (event: React.MouseEvent) => {
    const {dispatch, makeVisibleDeveloperKey, developerKey} = this.props
    event.preventDefault()
    dispatch(makeVisibleDeveloperKey(developerKey))
  }

  makeInvisibleLinkHandler = (event: React.MouseEvent) => {
    const {dispatch, makeInvisibleDeveloperKey, developerKey} = this.props
    event.preventDefault()
    dispatch(makeInvisibleDeveloperKey(developerKey))
  }

  confirmDeletion = (developerKey: DeveloperKey) => {
    const isLtiKey = developerKey?.is_lti_key
    const keyName = developerKey?.name || developerKey?.tool_configuration?.title

    return confirmDanger({
      title: isLtiKey ? I18n.t('Delete LTI Developer Key') : I18n.t('Delete Developer Key'),
      heading: keyName ? I18n.t('You are about to delete "%{keyName}".', {keyName}) : undefined,
      message: isLtiKey
        ? I18n.t(
            'Are you sure you want to delete this developer key? This action will also delete all tools associated with the developer key in this context.',
          )
        : I18n.t('Are you sure you want to delete this developer key?'),
      confirmButtonLabel: I18n.t('Delete'),
    })
  }

  deleteLinkHandler = async (event: React.MouseEvent) => {
    const {dispatch, deleteDeveloperKey, developerKey, onDelete} = this.props
    event.preventDefault()

    if (await this.confirmDeletion(developerKey)) {
      onDelete(developerKey.id)
      dispatch(deleteDeveloperKey(developerKey))
    }
  }

  editLinkHandler = (event: React.MouseEvent) => {
    const {
      dispatch,
      editDeveloperKey,
      developerKeysModalOpen,
      developerKey,
      ltiKeysSetLtiKey,
      developerKey: {is_lti_key},
    } = this.props

    event.preventDefault()
    if (is_lti_key) {
      dispatch(ltiKeysSetLtiKey(true))
    }
    dispatch(editDeveloperKey(developerKey))
    dispatch(developerKeysModalOpen(is_lti_key ? 'lti' : 'api'))
  }

  focusDeleteLink = () => {
    this.deleteLink?.focus()
  }

  refDeleteLink = (link: HTMLButtonElement | null) => {
    if (link) {
      this.deleteLink = link
    }
  }

  renderVisibilityIcon() {
    const {developerName, visible, showVisibilityToggle} = this.props
    if (!showVisibilityToggle) {
      return null
    }
    if (visible) {
      return (
        <Tooltip
          renderTip={
            !ENV.devKeysReadOnly
              ? I18n.t('Make key invisible')
              : I18n.t(
                  'Key is visible. You do not have permission to modify key visibility in this account',
                )
          }
        >
          <IconButton
            withBackground={false}
            withBorder={false}
            margin="0"
            size="small"
            onClick={this.makeInvisibleLinkHandler}
            screenReaderLabel={I18n.t('Make key %{developerName} invisible', {developerName})}
            disabled={ENV.devKeysReadOnly}
          >
            <IconEyeLine />
          </IconButton>
        </Tooltip>
      )
    }

    return (
      <Tooltip
        renderTip={
          !ENV.devKeysReadOnly
            ? I18n.t('Make key visible')
            : I18n.t(
                'Key is invisible. You do not have permission to modify key visibility in this account',
              )
        }
      >
        <IconButton
          withBackground={false}
          withBorder={false}
          screenReaderLabel={I18n.t('Make key %{developerName} visible', {developerName})}
          margin="0"
          size="small"
          onClick={this.makeVisibleLinkHandler}
          disabled={ENV.devKeysReadOnly}
        >
          <IconOffLine />
        </IconButton>
      </Tooltip>
    )
  }

  renderEditButton() {
    const {developerName, developerKey} = this.props
    const editKeyTooltip = ENV.devKeysReadOnly
      ? I18n.t('View key details')
      : I18n.t('Edit this key')
    const editKeyLabel = ENV.devKeysReadOnly
      ? I18n.t('View details for key %{developerName}', {developerName})
      : I18n.t('Edit key %{developerName}', {developerName})

    return developerKey.is_lti_registration ? (
      <Tooltip renderTip={editKeyTooltip}>
        <IconButton
          id={`edit-developer-key-button-${developerKey.id}`}
          as="a"
          href={`/accounts/${this.props.contextId}/developer_keys/${developerKey.id}`}
          withBackground={false}
          withBorder={false}
          screenReaderLabel={editKeyLabel}
          margin="0"
          size="small"
        >
          <IconEditLine />
        </IconButton>
      </Tooltip>
    ) : (
      <Tooltip renderTip={editKeyTooltip}>
        <IconButton
          id={`edit-developer-key-button-${developerKey.id}`}
          withBackground={false}
          withBorder={false}
          screenReaderLabel={editKeyLabel}
          margin="0"
          size="small"
          onClick={this.editLinkHandler}
        >
          <IconEditLine />
        </IconButton>
      </Tooltip>
    )
  }

  render() {
    const {developerName} = this.props

    const tooltipText = ENV.devKeysReadOnly
      ? I18n.t('You do not have permission to modify keys in this account')
      : I18n.t('Delete this key')
    const screenReaderLabel = ENV.devKeysReadOnly
      ? I18n.t(
          'Key %{developerName} &mdash; you do not have permission to modify keys in this account',
          {developerName},
        )
      : I18n.t('Delete key %{developerName}', {developerName})
    return (
      <div>
        {this.renderEditButton()}
        {this.renderVisibilityIcon()}
        <Tooltip renderTip={tooltipText}>
          <IconButton
            id="delete-developer-key-button"
            withBackground={false}
            withBorder={false}
            screenReaderLabel={screenReaderLabel}
            margin="0"
            size="small"
            onClick={this.deleteLinkHandler}
            elementRef={this.refDeleteLink}
            disabled={ENV.devKeysReadOnly}
          >
            <IconTrashLine />
          </IconButton>
        </Tooltip>
      </div>
    )
  }
}

export default DeveloperKeyActionButtons

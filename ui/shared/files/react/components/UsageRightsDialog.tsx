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

import React from 'react'
// @ts-expect-error TS7016 -- TypeScriptify (no 'any')
import createReactClass from 'create-react-class'
import UsageRightsDialog from './LegacyUsageRightsDialog'
import {useScope as createI18nScope} from '@canvas/i18n'
import UsageRightsSelectBox from './UsageRightsSelectBox'
import RestrictedRadioButtons from './RestrictedRadioButtons'
import DialogPreview from './DialogPreview'
import Folder from '../../backbone/models/Folder'
import {Modal} from '@instructure/ui-modal'
import {CloseButton, Button} from '@instructure/ui-buttons'
import {Heading} from '@instructure/ui-heading'
import htmlEscape from '@instructure/html-escape'

const I18n = createI18nScope('usage_rights_modal')

const MAX_FOLDERS_TO_SHOW = 2

// @ts-expect-error TS2339 -- TypeScriptify (no 'any')
UsageRightsDialog.renderFileName = function () {
  const textToShow =
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.props.itemsToManage.length > 1
      ? // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        I18n.t('%{items} items selected', {items: this.props.itemsToManage.length})
      : // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.props.itemsToManage[0].displayName()

  return (
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    <span ref={e => (this.fileName = e)} className="UsageRightsDialog__fileName">
      {textToShow}
    </span>
  )
}

// @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
UsageRightsDialog.renderFolderList = function (folders) {
  if (folders.length) {
    const foldersToShow = folders.slice(0, MAX_FOLDERS_TO_SHOW)
    return (
      <div>
        <span>{I18n.t('Usage rights will be set for all of the files contained in:')}</span>
        <ul
          ref={e => {
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            this.folderBulletList = e
          }}
          className="UsageRightsDialog__folderBulletList"
        >
          {
            // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
            foldersToShow.map(item => (
              <li key={item.cid}>{item.displayName()}</li>
            ))
          }
        </ul>
      </div>
    )
  } else {
    return null
  }
}

// @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
UsageRightsDialog.renderFolderTooltip = function (folders) {
  const toolTipFolders = folders.slice(MAX_FOLDERS_TO_SHOW)

  if (toolTipFolders.length) {
    // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
    const renderItems = toolTipFolders.map(item => ({
      cid: item.cid,
      displayName: htmlEscape(item.displayName()).toString(),
    }))
    // Doing it this way so commas, don't show up when rendering the list out in the tooltip.
    // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
    const renderedNames = renderItems.map(item => item.displayName).join('<br />')

    return (
      <span
        className="UsageRightsDialog__andMore"
        role="button"
        tabIndex={0}
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        ref={e => (this.folderTooltip = e)}
        data-html-tooltip-title={renderedNames}
        data-tooltip="right"
        data-tooltip-class="UsageRightsDialog__tooltip"
      >
        {I18n.t('and %{count} more…', {count: toolTipFolders.length})}
        <span className="screenreader-only">
          <ul>
            {
              // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
              renderItems.map((item, i) => (
                <li
                  key={item.cid}
                  ref={e => {
                    // @ts-expect-error TS7053 -- TypeScriptify (no 'any')
                    this[`displayNameTooltip${i}-screenreader`] = e
                  }}
                >
                  {' '}
                  {item.displayName}
                </li>
              ))
            }
          </ul>
        </span>
      </span>
    )
  } else {
    return null
  }
}

// @ts-expect-error TS2339 -- TypeScriptify (no 'any')
UsageRightsDialog.renderFolderMessage = function () {
  // @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
  const folders = this.props.itemsToManage.filter(item => item instanceof Folder)

  return (
    <div>
      {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.renderFolderList(folders)
      }
      {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.renderFolderTooltip(folders)
      }
      <hr aria-hidden="true" />
    </div>
  )
}

// @ts-expect-error TS2339 -- TypeScriptify (no 'any')
UsageRightsDialog.renderDifferentRightsMessage = function () {
  if (
    (this.copyright == null || this.use_justification === 'choose') &&
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.props.itemsToManage.length > 1
  ) {
    return (
      <span
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        ref={e => (this.differentRightsMessage = e)}
        className="UsageRightsDialog__differentRightsMessage alert"
      >
        <i className="icon-warning UsageRightsDialog__warning" />
        {I18n.t('Items selected have different usage rights.')}
      </span>
    )
  }
}

// @ts-expect-error TS2339 -- TypeScriptify (no 'any')
UsageRightsDialog.renderAccessManagement = function () {
  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
  if (this.props.userCanRestrictFilesForContext) {
    return (
      <div>
        <hr aria-hidden="true" />
        <div className="form-horizontal">
          <p className="manage-access">{I18n.t('You can also manage access at this time:')}</p>
          <RestrictedRadioButtons
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            ref={e => (this.restrictedSelection = e)}
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            models={this.props.itemsToManage}
          />
        </div>
      </div>
    )
  }
}

// @ts-expect-error TS2339 -- TypeScriptify (no 'any')
UsageRightsDialog.render = function () {
  return (
    <Modal
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      ref={e => (this.usageRightsDialog = e)}
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      open={this.props.isOpen}
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      onDismiss={this.props.closeModal}
      label={I18n.t('Manage Usage Rights')}
      shouldCloseOnDocumentClick={false} // otherwise clicking in the datepicker will dismiss the modal underneath it
    >
      <Modal.Header>
        <CloseButton
          // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
          elementRef={e => (this.cancelXButton = e)}
          className="Button Button--icon-action"
          placement="end"
          offset="medium"
          // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
          onClick={this.props.closeModal}
          screenReaderLabel={I18n.t('Close')}
        />
        <Heading level="h4">{I18n.t('Manage Usage Rights')}</Heading>
      </Modal.Header>
      <Modal.Body>
        <div
          ref={e => {
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            this.form = e
          }}
          className="UsageRightsDialog__Content"
        >
          <div>
            <div className="UsageRightsDialog__paddingFix grid-row">
              {
                // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                !this.props.hidePreview && (
                  <div className="UsageRightsDialog__previewColumn col-xs-3">
                    <DialogPreview
                      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                      itemsToShow={this.props.itemsToManage}
                    />
                  </div>
                )
              }
              <div className="UsageRightsDialog__contentColumn off-xs-1 col-xs-8">
                {
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  this.renderDifferentRightsMessage()
                }
                {
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  this.renderFileName()
                }
                {
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  this.renderFolderMessage()
                }
                <UsageRightsSelectBox
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  ref={e => (this.usageSelection = e)}
                  use_justification={this.use_justification}
                  copyright={this.copyright || ''}
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  cc_value={this.cc_value}
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  contextType={this.props.contextType}
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  contextId={this.props.contextId}
                />
                {
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  this.renderAccessManagement()
                }
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <span className="UsageRightsDialog__Footer-Actions">
          <Button
            elementRef={e => {
              // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
              this.cancelButton = e
            }}
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            onClick={this.props.closeModal}
          >
            {I18n.t('Cancel')}
          </Button>
          &nbsp;
          <Button
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            elementRef={e => (this.saveButton = e)}
            color="primary"
            type="submit"
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            onClick={() => this.submit(this.props.deferSave)}
          >
            {I18n.t('Save')}
          </Button>
        </span>
      </Modal.Footer>
    </Modal>
  )
}

export default createReactClass(UsageRightsDialog)

/*
 * Copyright (C) 2017 - present Instructure, Inc.
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
import React, {Component} from 'react'
import PropTypes from 'prop-types'
import cx from 'classnames'

import Modal from '@canvas/instui-bindings/react/InstuiModal'
import {Button} from '@instructure/ui-buttons'
import {Checkbox} from '@instructure/ui-checkbox'
import {Flex} from '@instructure/ui-flex'

const I18n = createI18nScope('BlueprintModal')

export default class BlueprintModal extends Component {
  static propTypes = {
    isOpen: PropTypes.bool.isRequired,
    title: PropTypes.string,
    onCancel: PropTypes.func,
    onSave: PropTypes.func,
    children: PropTypes.element.isRequired,
    hasChanges: PropTypes.bool,
    isSaving: PropTypes.bool,
    saveButton: PropTypes.element,
    wide: PropTypes.bool,
    canAutoPublishCourses: PropTypes.bool,
    willAddAssociations: PropTypes.bool,
    willPublishCourses: PropTypes.bool,
    enablePublishCourses: PropTypes.func,
  }

  static defaultProps = {
    title: I18n.t('Blueprint'),
    hasChanges: false,
    isSaving: false,
    onSave: () => {},
    onCancel: () => {},
    saveButton: null,
    wide: false,
  }

  componentDidMount() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.fixBodyScroll(this.props.isOpen)
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  UNSAFE_componentWillReceiveProps(nextProps) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (nextProps.isOpen !== this.props.isOpen) {
      this.fixBodyScroll(nextProps.isOpen)
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  componentDidUpdate(prevProps) {
    // if just started saving, then the save button was just clicked
    // and it is about to disappear, so focus on the done button
    // that replaces it
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (!prevProps.isSaving && this.props.isSaving) {
      // set timeout so we queue this after the render, to ensure done button is mounted
      setTimeout(() => {
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.doneBtn.focus()
      }, 0)
    }
  }

  bodyOverflow = ''

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  fixBodyScroll(isOpen) {
    if (isOpen) {
      this.bodyOverflow = document.body.style.overflowY
      document.body.style.overflowY = 'hidden'
    } else {
      document.body.style.overflowY = this.bodyOverflow
    }
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  publishCoursesChange = event => {
    const enabled = event.target.checked
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.props.enablePublishCourses(enabled)
  }

  render() {
    const classes = cx('bcs__modal-content-wrapper', {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      'bcs__modal-content-wrapper__wide': this.props.wide,
    })

    return (
      <Modal
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        open={this.props.isOpen}
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        onDismiss={this.props.onCancel}
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        onClose={this.handleModalClose}
        size="fullscreen"
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        label={this.props.title}
      >
        <>
          <Modal.Body>
            <div className={classes}>
              {
                // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                this.props.children
              }
            </div>
          </Modal.Body>
          <Modal.Footer
            ref={c => {
              // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
              this.footer = c
            }}
          >
            {
              // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
              this.props.hasChanges && !this.props.isSaving ? (
                <Flex alignItems="center">
                  {
                    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                    this.props.canAutoPublishCourses && this.props.willAddAssociations && (
                      <Flex.Item margin="0 x-small 0 0">
                        <Checkbox
                          data-testid="publish-courses-checkbox"
                          label={I18n.t('Publish upon association')}
                          // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                          checked={this.props.willPublishCourses}
                          onChange={this.publishCoursesChange}
                        />
                      </Flex.Item>
                    )
                  }
                  <Flex.Item margin="0 x-small 0 0">
                    <Button
                      data-testid="cancel-button"
                      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                      onClick={this.props.onCancel}
                    >
                      {I18n.t('Cancel')}
                    </Button>
                  </Flex.Item>
                  {
                    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                    this.props.saveButton ? (
                      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                      this.props.saveButton
                    ) : (
                      <Flex.Item margin="0 x-small 0 0">
                        <Button
                          data-testid="save-button"
                          // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                          onClick={this.props.onSave}
                          color="primary"
                        >
                          {I18n.t('Save')}
                        </Button>
                      </Flex.Item>
                    )
                  }
                </Flex>
              ) : (
                <Button
                  data-testid="done-button"
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  ref={c => (this.doneBtn = c)}
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  onClick={this.props.onCancel}
                  color="primary"
                >
                  {I18n.t('Done')}
                </Button>
              )
            }
          </Modal.Footer>
        </>
      </Modal>
    )
  }
}

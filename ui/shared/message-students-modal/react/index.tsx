/*
 * Copyright (C) 2016 - present Instructure, Inc.
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
import PropTypes from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import axios from '@canvas/axios'
import {Button} from '@instructure/ui-buttons'
import {TextArea} from '@instructure/ui-text-area'
import {TextInput} from '@instructure/ui-text-input'
import Modal from '@canvas/instui-bindings/react/InstuiModal'
import {FormField} from '@instructure/ui-form-field'
import {Alert} from '@instructure/ui-alerts'
import {htmlDecode} from '@canvas/util/TextHelper'

const I18n = createI18nScope('shared_message_students')

class MessageStudents extends React.Component {
  static propTypes = {
    // Data for endpoint
    body: PropTypes.string,
    bulkMessage: PropTypes.bool,
    contextCode: PropTypes.string.isRequired,
    groupConversation: PropTypes.bool,
    mode: PropTypes.string,
    recipients: PropTypes.array,
    subject: PropTypes.string,

    // Form display
    title: PropTypes.string,
    children: PropTypes.element,

    // Callbacks
    onExited: PropTypes.func,
    onRequestClose: PropTypes.func.isRequired,
  }

  static defaultProps = {
    bulkMessage: true,
    groupConversation: true,
    mode: 'async',
    recipients: [],
  }

  /* @ts-expect-error -- TODO: TSify */
  constructor(props) {
    super(props)
    this.state = this.initialState
  }

  // Utility

  get initialState() {
    return {
      data: {
        body: '',
        /* @ts-expect-error -- TODO: TSify */
        recipients: this.props.recipients,
        subject: '',
      },
      errors: {},
      hideAlert: false,
      open: true,
      sending: false,
      success: false,
    }
  }

  composeRequestData() {
    return {
      /* @ts-expect-error -- TODO: TSify */
      ...this.state.data,
      /* @ts-expect-error -- TODO: TSify */
      recipients: this.state.data.recipients.map(recipient => recipient.id),
      /* @ts-expect-error -- TODO: TSify */
      bulk_message: this.props.bulkMessage,
      /* @ts-expect-error -- TODO: TSify */
      context_code: this.props.contextCode,
      /* @ts-expect-error -- TODO: TSify */
      group_conversation: this.props.groupConversation,
      /* @ts-expect-error -- TODO: TSify */
      mode: this.props.mode,
    }
  }

  /* @ts-expect-error -- TODO: TSify */
  errorMessagesFor(field) {
    /* @ts-expect-error -- TODO: TSify */
    return this.state.errors[field]
      ? [
          {
            /* @ts-expect-error -- TODO: TSify */
            text: this.state.errors[field],
            type: 'newError',
          },
        ]
      : null
  }

  /* @ts-expect-error -- TODO: TSify */
  sendMessage(data) {
    const config = {
      headers: {
        Accept: 'application/json',
      },
    }

    this.setState({
      hideAlert: false,
      sending: true,
    })

    axios
      .post('/api/v1/conversations', data, config)
      .then(this.handleResponseSuccess)
      .catch(this.handleResponseError)
  }

  /* @ts-expect-error -- TODO: TSify */
  validationErrors(data) {
    const fields = ['subject', 'body']
    const errors = {}
    fields.forEach(field => {
      if (data[field].trim().length === 0) {
        /* @ts-expect-error -- TODO: TSify */
        errors[field] = I18n.t('Please provide a %{field}', {
          field,
        })
      }
    })

    /* @ts-expect-error -- TODO: TSify */
    if (typeof errors.subject === 'undefined' && data.subject.length > 255) {
      /* @ts-expect-error -- TODO: TSify */
      errors.subject = I18n.t('Subject must contain fewer than 255 characters.')
    }

    return errors
  }

  // Event & pseudo-event handlers

  /* @ts-expect-error -- TODO: TSify */
  handleAlertClose = _e => {
    this.setState({
      hideAlert: true,
    })
  }

  /* @ts-expect-error -- TODO: TSify */
  handleChange(field, value) {
    /* @ts-expect-error -- TODO: TSify */
    let {data} = this.state
    /* @ts-expect-error -- TODO: TSify */
    const {errors} = this.state
    const newData = {}
    /* @ts-expect-error -- TODO: TSify */
    newData[field] = value
    data = {...data, ...newData}
    delete errors[field]
    this.setState({data, errors})
  }

  /* @ts-expect-error -- TODO: TSify */
  handleClose = e => {
    if (e) {
      e.preventDefault()
    }

    this.setState(
      {
        open: false,
      },
      () => {
        /* @ts-expect-error -- TODO: TSify */
        this.props.onRequestClose()
      },
    )
  }

  /* @ts-expect-error -- TODO: TSify */
  handleSubmit = e => {
    e.preventDefault()
    const data = this.composeRequestData()
    const errors = this.validationErrors(data)
    if (Object.keys(errors).length > 0) {
      this.setState(
        {
          errors,
          hideAlert: false,
        },
        () => {
          // Focus the topmost errored input for screen reader users
          /* @ts-expect-error -- TODO: TSify */
          if (errors.subject && this._subjectInput) {
            /* @ts-expect-error -- TODO: TSify */
            this._subjectInput.focus()
            /* @ts-expect-error -- TODO: TSify */
          } else if (errors.body && this._bodyInput) {
            /* @ts-expect-error -- TODO: TSify */
            this._bodyInput.focus()
          }
        },
      )
    } else {
      this.sendMessage(data)
    }
  }

  // Request handlers

  /* @ts-expect-error -- TODO: TSify */
  handleResponseError = error => {
    const serverErrors = {}
    if (error.response) {
      const errorData = error.response.data
      /* @ts-expect-error -- TODO: TSify */
      errorData.forEach(error => {
        /* @ts-expect-error -- TODO: TSify */
        serverErrors[error.attribute] = error.message
      })
    } else {
      /* @ts-expect-error -- TODO: TSify */
      serverErrors.request = error.message
    }
    this.setState({
      errors: serverErrors,
      sending: false,
    })
  }

  handleResponseSuccess = () => {
    setTimeout(() => {
      this.setState(
        {
          ...this.initialState,
          open: false,
        },
        () => {
          /* @ts-expect-error -- TODO: TSify */
          this.props.onRequestClose()
        },
      )
    }, 2500)
    this.setState({
      hideAlert: false,
      success: true,
      sending: false,
    })
  }

  // Render & render helpers

  /* @ts-expect-error -- TODO: TSify */
  renderAlert(message, variant, shouldRender) {
    /* @ts-expect-error -- TODO: TSify */
    if (shouldRender() && !this.state.hideAlert) {
      return (
        <div className="MessageStudents__Alert">
          <Alert
            variant={variant}
            renderCloseButtonLabel={I18n.t('Close')}
            /* @ts-expect-error -- TODO: TSify */
            onDismiss={this.handleAlertClose}
            transition="none"
          >
            {message}
          </Alert>
        </div>
      )
    } else {
      return null
    }
  }

  render() {
    /* @ts-expect-error -- TODO: TSify */
    if (!this.state.open) {
      return null
    }

    /* @ts-expect-error -- TODO: TSify */
    const onTextChange = field => e => this.handleChange(field, e.target.value)

    /* @ts-expect-error -- TODO: TSify */
    const tokens = this.state.data.recipients.map(recipient => {
      const displayName = recipient.displayName || recipient.email
      return (
        <li key={recipient.id} className="ac-token">
          {htmlDecode(displayName)}
        </li>
      )
    })

    return (
      <div className="MessageStudents">
        <Modal
          /* @ts-expect-error -- TODO: TSify */
          open={this.state.open}
          transition="fade"
          /* @ts-expect-error -- TODO: TSify */
          label={this.props.title}
          /* @ts-expect-error -- TODO: TSify */
          onDismiss={this.props.onRequestClose}
          size="medium"
          /* @ts-expect-error -- TODO: TSify */
          onExited={this.props.onExited}
          shouldCloseOnDocumentClick={false}
        >
          <Modal.Body>
            {this.renderAlert(
              I18n.t('Your message was sent!'),
              'success',
              /* @ts-expect-error -- TODO: TSify */
              () => this.state.success,
            )}
            {this.renderAlert(
              I18n.t("We're sending your message..."),
              'info',
              /* @ts-expect-error -- TODO: TSify */
              () => this.state.sending,
            )}
            <form onSubmit={this.handleSubmit} className="MessageStudents__Form">
              <div className="MessageStudents__FormField">
                <div className="ac">
                  <FormField id="recipients" label={I18n.t('To')}>
                    <ul className="ac-token-list">{tokens}</ul>
                  </FormField>
                </div>
              </div>
              <div className="MessageStudents__FormField">
                <TextInput
                  isRequired={true}
                  renderLabel={I18n.t('Subject')}
                  /* @ts-expect-error -- TODO: TSify */
                  defaultValue={this.props.subject}
                  onChange={onTextChange('subject')}
                  /* @ts-expect-error -- TODO: TSify */
                  messages={this.errorMessagesFor('subject')}
                  /* @ts-expect-error -- TODO: TSify */
                  interaction={this.state.sending || this.state.success ? 'disabled' : 'enabled'}
                  ref={el => {
                    /* @ts-expect-error -- TODO: TSify */
                    this._subjectInput = el
                  }}
                />
              </div>
              <div className="MessageStudents__FormField">
                <TextArea
                  required={true}
                  label={I18n.t('Body')}
                  /* @ts-expect-error -- TODO: TSify */
                  defaultValue={this.props.body}
                  onChange={onTextChange('body')}
                  /* @ts-expect-error -- TODO: TSify */
                  messages={this.errorMessagesFor('body')}
                  /* @ts-expect-error -- TODO: TSify */
                  disabled={this.state.sending || this.state.success}
                  ref={el => {
                    /* @ts-expect-error -- TODO: TSify */
                    this._bodyInput = el
                  }}
                />
              </div>
            </form>
          </Modal.Body>
          <Modal.Footer>
            <Button
              data-testid="message-students-cancel"
              /* @ts-expect-error -- TODO: TSify */
              disabled={this.state.sending || this.state.success}
              onClick={this.handleClose}
            >
              {I18n.t('Close')}
            </Button>
            &nbsp;
            <Button
              data-testid="message-students-submit"
              color="primary"
              onClick={this.handleSubmit}
              /* @ts-expect-error -- TODO: TSify */
              disabled={this.state.sending || this.state.success}
            >
              {I18n.t('Send Message')}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    )
  }
}

export default MessageStudents

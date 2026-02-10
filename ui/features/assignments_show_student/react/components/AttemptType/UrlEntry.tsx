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

import {AlertManagerContext} from '@canvas/alerts/react/AlertManager'
import {Assignment} from '@canvas/assignments/graphql/student/Assignment'
import {bool, func, object} from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import {isSubmitted} from '../../helpers/SubmissionHelpers'
import MoreOptions from './MoreOptions/index'
import {Submission} from '@canvas/assignments/graphql/student/Submission'
import React, {createRef} from 'react'

import {Billboard} from '@instructure/ui-billboard'
import {Button} from '@instructure/ui-buttons'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {IconEyeLine} from '@instructure/ui-icons'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import StudentViewContext from '@canvas/assignments/react/StudentViewContext'
import {TextInput} from '@instructure/ui-text-input'
import UrlSubmissionDisplay from '@canvas/assignments/react/UrlSubmissionDisplay'

const I18n = createI18nScope('assignments_2_url_entry')

const ERROR_MESSAGE = [
  {text: I18n.t('Please enter a valid url (e.g. https://example.com)'), type: 'newError'},
]

class UrlEntry extends React.Component {
  state = {
    messages: [],
    typingTimeout: 0,
    url: '',
    valid: false,
  }

  _urlInputRef = createRef()

  // @ts-expect-error
  componentDidUpdate(prevProps) {
    // @ts-expect-error
    const {submission, submitButtonRef, newAttemptButtonRef} = this.props
    if (
      submission?.submissionDraft?.url &&
      submission.submissionDraft.url !== prevProps.submission?.submissionDraft?.url
    ) {
      this.updateInputState()
    }

    submitButtonRef?.current?.addEventListener('click', this.handleSubmitClick)
    newAttemptButtonRef?.current?.addEventListener('click', this.handleNewAttemptClick)
  }

  componentDidMount() {
    // @ts-expect-error
    const {submission, focusOnInit, submitButtonRef, newAttemptButtonRef} = this.props
    window.addEventListener('beforeunload', this.beforeunload)
    if (submission?.submissionDraft?.url) {
      this.updateInputState()
    }
    window.addEventListener('message', this.handleLTIURLs)

    submitButtonRef?.current?.addEventListener('click', this.handleSubmitClick)
    newAttemptButtonRef?.current?.addEventListener('click', this.handleNewAttemptClick)

    if (focusOnInit && !isSubmitted(submission)) {
      // @ts-expect-error
      this._urlInputRef.current.focus()
    }
  }

  handleSubmitClick = () => {
    // @ts-expect-error
    if (!this.props.submission.submissionDraft?.meetsUrlCriteria) {
      // @ts-expect-error
      this._urlInputRef.current.focus()
      this.setState({messages: ERROR_MESSAGE})
    }
  }

  handleNewAttemptClick = () => {
    if (this.state.messages.length > 0) {
      this.setState({messages: []})
    }
  }

  updateInputState = () => {
    // @ts-expect-error
    const url = this.props.submission.submissionDraft.url
    // @ts-expect-error
    const valid = this.props.submission.submissionDraft.meetsUrlCriteria
    this.setState({
      messages: valid ? [] : ERROR_MESSAGE,
      url,
      valid,
    })
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.beforeunload)
    window.removeEventListener('message', this.handleLTIURLs)
    // @ts-expect-error
    this.props.submitButtonRef?.current?.removeEventListener('click', this.handleSubmitClick)
    // @ts-expect-error
    this.props.newAttemptButtonRef?.current?.removeEventListener(
      'click',
      this.handleNewAttemptClick,
    )
  }

  // @ts-expect-error
  handleLTIURLs = async e => {
    if (e.data.subject === 'LtiDeepLinkingResponse') {
      if (e.data.errormsg) {
        // @ts-expect-error
        this.context.setOnFailure(e.data.errormsg)
        return
      }
      if (e.data.content_items.length) {
        const url = e.data.content_items[0].url
        this.createSubmissionDraft(url)
      }
    }

    // Since LTI 1.0 handles its own message alerting we don't have to
    if (e.data.subject === 'A2ExternalContentReady') {
      if (!e.data.errormsg && e.data.content_items.length) {
        const url = e.data.content_items[0].url
        this.createSubmissionDraft(url)
      }
    }
  }

  // Warn the user if they are attempting to leave the page with an unsubmitted url entry
  // @ts-expect-error
  beforeunload = e => {
    // @ts-expect-error
    if (this.state.url && this.state.url !== this.props.submission?.submissionDraft?.url) {
      e.preventDefault()
      e.returnValue = true
    }
  }

  // @ts-expect-error
  handleBlur = e => {
    // @ts-expect-error
    this.props.updateEditingDraft(false)
    if (this.state.typingTimeout) {
      clearTimeout(this.state.typingTimeout)
    }

    // @ts-expect-error
    if (e.target.value || this.props.submission?.submissionDraft?.url) {
      this.createSubmissionDraft(e.target.value)
    }
  }

  // @ts-expect-error
  handleChange = e => {
    // clear errors
    this.setState({messages: []})
    // @ts-expect-error
    this.props.updateEditingDraft(true)
    if (this.state.typingTimeout) {
      clearTimeout(this.state.typingTimeout)
    }
    const url = e.target.value

    this.setState({
      typingTimeout: setTimeout(async () => {
        await this.createSubmissionDraft(url)
        // @ts-expect-error
        this.props.updateEditingDraft(false)
      }, 1000), // set a timeout of 1 second
      url,
    })
  }

  // @ts-expect-error
  createSubmissionDraft = async url => {
    // @ts-expect-error
    await this.props.createSubmissionDraft({
      variables: {
        // @ts-expect-error
        id: this.props.submission.id,
        activeSubmissionType: 'online_url',
        // @ts-expect-error
        attempt: this.props.submission.attempt || 1,
        url,
      },
    })
  }

  renderURLInput = () => {
    const inputStyle = {
      maxWidth: '700px',
      marginLeft: 'auto',
      marginRight: 'auto',
    }

    return (
      <StudentViewContext.Consumer>
        {context => (
          <Flex direction="column">
            <Flex.Item overflowY="visible">
              <div style={inputStyle}>
                <Flex justifyItems="center" alignItems="start">
                  <Flex.Item shouldGrow={true}>
                    <TextInput
                      renderLabel={
                        <ScreenReaderContent>{I18n.t('Website url input')}</ScreenReaderContent>
                      }
                      type="url"
                      placeholder={I18n.t('https://')}
                      value={this.state.url}
                      onBlur={this.handleBlur}
                      onChange={this.handleChange}
                      messages={this.state.messages}
                      // @ts-expect-error
                      ref={this._urlInputRef}
                      data-testid="url-input"
                      interaction={!context.allowChangesToSubmission ? 'readonly' : 'enabled'}
                    />
                  </Flex.Item>
                  <Flex.Item>
                    {this.state.valid && (
                      <Button
                        // @ts-expect-error
                        renderIcon={IconEyeLine}
                        margin="0 0 0 x-small"
                        onClick={() => window.open(this.state.url)}
                        data-testid="preview-button"
                      >
                        <ScreenReaderContent>{I18n.t('Preview website url')}</ScreenReaderContent>
                      </Button>
                    )}
                  </Flex.Item>
                </Flex>
              </div>
            </Flex.Item>
            <Flex.Item margin="small 0" overflowY="visible">
              <MoreOptions
                // @ts-expect-error
                assignmentID={this.props.assignment._id}
                // @ts-expect-error
                courseID={this.props.assignment.env.courseId}
                // @ts-expect-error
                userID={this.props.assignment.env.currentUser.id}
              />
            </Flex.Item>
          </Flex>
        )}
      </StudentViewContext.Consumer>
    )
  }

  renderAttempt = () => (
    <View as="div" data-testid="url-entry" margin="0 0 medium 0">
      <Billboard
        heading={I18n.t('Enter Web URL')}
        headingAs="span"
        headingLevel="h4"
        message={this.renderURLInput()}
        themeOverride={{backgroundColor: 'transparent'}}
      />
    </View>
  )

  renderSubmission = () => {
    // @ts-expect-error
    return <UrlSubmissionDisplay url={this.props.submission.url} />
  }

  render() {
    // @ts-expect-error
    if (isSubmitted(this.props.submission)) {
      return this.renderSubmission()
    } else {
      return this.renderAttempt()
    }
  }
}

// @ts-expect-error
UrlEntry.propTypes = {
  assignment: Assignment.shape,
  createSubmissionDraft: func,
  focusOnInit: bool.isRequired,
  submission: Submission.shape,
  updateEditingDraft: func,
  submitButtonRef: object,
  newAttemptButtonRef: object,
}

UrlEntry.contextType = AlertManagerContext

export default UrlEntry

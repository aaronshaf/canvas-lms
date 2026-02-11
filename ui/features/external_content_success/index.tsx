//
// Copyright (C) 2014 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import $ from 'jquery'

import {useScope as createI18nScope} from '@canvas/i18n'
import '@canvas/jquery/jquery.ajaxJSON'
import '@canvas/jquery/jquery.instructure_misc_helpers'
import '@canvas/rails-flash-notifications'
import React from 'react'
import {createRoot} from 'react-dom/client'
import {Alert} from '@instructure/ui-alerts'
import replaceTags from '@canvas/util/replaceTags'
import {postMessageExternalContentReady} from '@canvas/external-tools/messages'
import ready from '@instructure/ready'

const I18n = createI18nScope('external_content.success')

interface LtiResponseMessages {
  lti_errormsg?: string
  lti_msg?: string
}

interface ExternalContentSuccessType {
  dataReady: (contentItems: any, service_id: string) => void
  a2DataReady: (data: any) => void
  processLtiMessages: (messages: LtiResponseMessages, target: Element | null) => Promise<void>
  start: () => Promise<void>
}

const ExternalContentSuccess: Partial<ExternalContentSuccessType> = {}

ready(() => {
  // @ts-expect-error - ENV properties not in GlobalEnv type
  const {lti_response_messages, service_id, retrieved_data: data, service} = ENV
  const parentWindow = window.parent || window.opener

  ExternalContentSuccess.dataReady = function (contentItems: any, service_id: string) {
    postMessageExternalContentReady(parentWindow, {contentItems, service_id, service})

    setTimeout(() => {
      $('#dialog_message').text(
        I18n.t('popup_success', 'Success! This popup should close on its own...'),
      )
    }, 1000)
  }

  // Handles lti 1.0 responses for Assignments 2 which expects a
  // vanilla JS event from LTI tools in the following form.
  ExternalContentSuccess.a2DataReady = function (data: any) {
    parentWindow.postMessage(
      {
        subject: 'A2ExternalContentReady',
        content_items: data,
        // @ts-expect-error - ENV properties not in GlobalEnv type
        msg: ENV.message,
        // @ts-expect-error - ENV properties not in GlobalEnv type
        log: ENV.log,
        // @ts-expect-error - ENV properties not in GlobalEnv type
        errormsg: ENV.error_message,
        // @ts-expect-error - ENV properties not in GlobalEnv type
        errorlog: ENV.error_log,
        // @ts-expect-error - ENV properties not in GlobalEnv type
        ltiEndpoint: ENV.lti_endpoint,
      },
      ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN,
    )
  }

  ExternalContentSuccess.processLtiMessages = async (
    messages: LtiResponseMessages,
    target: Element | null,
  ) => {
    const errorMessage = messages?.lti_errormsg
    const message = messages?.lti_msg

    if (errorMessage || message) {
      const wrapper = document.createElement('div')
      wrapper.setAttribute('id', 'lti_messages_wrapper')
      target?.parentNode?.insertBefore(wrapper, target)

      const root = createRoot(wrapper)
      await new Promise<void>(resolve => {
        root.render(
          <>
            {[
              [errorMessage, true],
              [message, false],
            ]
              .filter(([msg, _]) => msg !== undefined)
              .map(([msg, isError], index) => {
                return (
                  <Alert
                    key={index}
                    variant={isError ? 'error' : 'info'}
                    renderCloseButtonLabel="Close"
                    onDismiss={() => resolve()}
                    timeout={5000}
                  >
                    <span id={isError ? 'lti_error_message' : 'lti_message'}>{msg}</span>
                  </Alert>
                )
              })}
          </>,
        )
      })
      root.unmount()
    }
  }

  ExternalContentSuccess.start = async function () {
    await this.processLtiMessages?.(lti_response_messages, document.querySelector('.ic-app'))

    // @ts-expect-error - ENV properties not in GlobalEnv type
    if (ENV.oembed) {
      const url = replaceTags(
        replaceTags(
          $('#oembed_retrieve_url').attr('href') ?? '',
          'endpoint',
          // @ts-expect-error - ENV properties not in GlobalEnv type
          encodeURIComponent(ENV.oembed.endpoint),
        ),
        'url',
        // @ts-expect-error - ENV properties not in GlobalEnv type
        encodeURIComponent(ENV.oembed.url),
      )
      $.ajaxJSON(
        url,
        'GET',
        {},
        (data: any) => ExternalContentSuccess.dataReady?.(data, service_id),
        () =>
          $('#dialog_message').text(
            I18n.t(
              'oembed_failure',
              'Content retrieval failed, please try again or notify your system administrator of the error.',
            ),
          ),
      )
    } else {
      ExternalContentSuccess.dataReady?.(data, service_id)
      ExternalContentSuccess.a2DataReady?.(data)
    }
  }

  ExternalContentSuccess.start?.()
})

export default ExternalContentSuccess

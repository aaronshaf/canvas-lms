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
import {type GlobalEnv} from '@canvas/global/env/GlobalEnv'

const I18n = createI18nScope('external_content.success')

declare const ENV: GlobalEnv & {
  lti_response_messages?: Record<string, unknown>
  service_id?: string
  retrieved_data?: unknown
  service?: unknown

  message?: string
  log?: unknown
  error_message?: string
  error_log?: unknown
  lti_endpoint?: string
  DEEP_LINKING_POST_MESSAGE_ORIGIN: string

  oembed?: {
    endpoint: string
    url: string
  }
}

const ExternalContentSuccess = {} as {
  dataReady: (contentItems: unknown, service_id?: string) => void
  a2DataReady: (data: unknown) => void
  processLtiMessages: (
    messages: Record<string, unknown> | undefined,
    target: Element,
  ) => Promise<void>
  start: () => Promise<void>
}

ready(() => {
  const {lti_response_messages, service_id, retrieved_data: data, service} = ENV
  const parentWindow = window.parent || window.opener

  ExternalContentSuccess.dataReady = function (contentItems: unknown, service_id?: string) {
    // @ts-expect-error TS migration: postMessageExternalContentReady expects stricter types than we have here.
    postMessageExternalContentReady(parentWindow, {contentItems, service_id, service})

    setTimeout(() => {
      $('#dialog_message').text(
        I18n.t('popup_success', 'Success! This popup should close on its own...'),
      )
    }, 1000)
  }

  // Handles lti 1.0 responses for Assignments 2 which expects a
  // vanilla JS event from LTI tools in the following form.
  ExternalContentSuccess.a2DataReady = function (data: unknown) {
    parentWindow.postMessage(
      {
        subject: 'A2ExternalContentReady',
        content_items: data,
        msg: ENV.message,
        log: ENV.log,
        errormsg: ENV.error_message,
        errorlog: ENV.error_log,
        ltiEndpoint: ENV.lti_endpoint,
      },
      ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN,
    )
  }

  ExternalContentSuccess.processLtiMessages = async (
    messages: Record<string, unknown> | undefined,
    target: Element,
  ) => {
    const errorMessage = messages?.lti_errormsg as string | undefined
    const message = messages?.lti_msg as string | undefined

    if (errorMessage || message) {
      const wrapper = document.createElement('div')
      wrapper.setAttribute('id', 'lti_messages_wrapper')
      const parent = target.parentNode
      if (!parent) return
      parent.insertBefore(wrapper, target)

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
    const app = document.querySelector('.ic-app')
    if (!app) return
    await this.processLtiMessages(lti_response_messages, app)

    if (ENV.oembed) {
      const oembed = ENV.oembed
      const href = $('#oembed_retrieve_url').attr('href') ?? ''
      const url = replaceTags(
        replaceTags(href, 'endpoint', encodeURIComponent(oembed.endpoint)),
        'url',
        encodeURIComponent(oembed.url),
      )
      $.ajaxJSON(
        url,
        'GET',
        {},
        (data: unknown) => ExternalContentSuccess.dataReady(data),
        () =>
          $('#dialog_message').text(
            I18n.t(
              'oembed_failure',
              'Content retrieval failed, please try again or notify your system administrator of the error.',
            ),
          ),
      )
    } else {
      ExternalContentSuccess.dataReady(data, service_id)
      ExternalContentSuccess.a2DataReady(data)
    }
  }

  ExternalContentSuccess.start()
})

export default ExternalContentSuccess

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
import {render} from '@canvas/react'
import {Alert} from '@instructure/ui-alerts'
import replaceTags from '@canvas/util/replaceTags'
import {postMessageExternalContentReady} from '@canvas/external-tools/messages'
import ready from '@instructure/ready'

const I18n = createI18nScope('external_content.success')

type MessageValue = string | null | undefined

interface LtiResponseMessages {
  lti_errormsg?: MessageValue
  lti_msg?: MessageValue
}

type ExternalContentReadyPayload = Parameters<typeof postMessageExternalContentReady>[1]
type ContentItems = ExternalContentReadyPayload['contentItems']
type ServiceId = ExternalContentReadyPayload['service_id']

interface ExternalContentSuccessType {
  dataReady: (contentItems: ContentItems, serviceId?: ServiceId) => void
  a2DataReady: (data: unknown) => void
  processLtiMessages: (
    messages: LtiResponseMessages | undefined,
    target: HTMLElement,
  ) => Promise<void>
  start: (this: ExternalContentSuccessType) => Promise<void>
}

const ExternalContentSuccess: ExternalContentSuccessType = {
  dataReady: () => {
    throw new Error('ExternalContentSuccess not initialized')
  },
  a2DataReady: () => {
    throw new Error('ExternalContentSuccess not initialized')
  },
  processLtiMessages: async () => {
    throw new Error('ExternalContentSuccess not initialized')
  },
  start: async () => {
    throw new Error('ExternalContentSuccess not initialized')
  },
}

ready(() => {
  // @ts-expect-error - page-specific ENV property
  const ltiResponseMessages: LtiResponseMessages | undefined = ENV.lti_response_messages
  // @ts-expect-error - page-specific ENV property
  const serviceId: ServiceId = ENV.service_id
  // @ts-expect-error - page-specific ENV property
  const data: ContentItems = ENV.retrieved_data
  // @ts-expect-error - page-specific ENV property
  const service = ENV.service
  const parentWindow = window.parent || window.opener

  ExternalContentSuccess.dataReady = function (
    contentItems: ContentItems,
    currentServiceId?: ServiceId,
  ): void {
    postMessageExternalContentReady(parentWindow, {
      contentItems,
      // @ts-expect-error - legacy flow allows missing service_id
      service_id: currentServiceId,
      service,
    })

    setTimeout(() => {
      $('#dialog_message').text(
        I18n.t('popup_success', 'Success! This popup should close on its own...'),
      )
    }, 1000)
  }

  // Handles lti 1.0 responses for Assignments 2 which expects a
  // vanilla JS event from LTI tools in the following form.
  ExternalContentSuccess.a2DataReady = function (data: unknown): void {
    parentWindow.postMessage(
      {
        subject: 'A2ExternalContentReady',
        content_items: data,
        // @ts-expect-error - page-specific ENV property
        msg: ENV.message,
        // @ts-expect-error - page-specific ENV property
        log: ENV.log,
        // @ts-expect-error - page-specific ENV property
        errormsg: ENV.error_message,
        // @ts-expect-error - page-specific ENV property
        errorlog: ENV.error_log,
        // @ts-expect-error - page-specific ENV property
        ltiEndpoint: ENV.lti_endpoint,
      },
      ENV.DEEP_LINKING_POST_MESSAGE_ORIGIN,
    )
  }

  ExternalContentSuccess.processLtiMessages = async (
    messages: LtiResponseMessages | undefined,
    target: HTMLElement,
  ): Promise<void> => {
    const errorMessage = messages?.lti_errormsg
    const message = messages?.lti_msg

    if (errorMessage || message) {
      const wrapper = document.createElement('div')
      wrapper.setAttribute('id', 'lti_messages_wrapper')
      // @ts-expect-error - target parent exists on this page
      target.parentNode.insertBefore(wrapper, target)

      let root: ReturnType<typeof render> | undefined
      await new Promise<void>(resolve => {
        root = render(
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
          wrapper,
        )
      })
      root?.unmount()
    }
  }

  ExternalContentSuccess.start = async function (): Promise<void> {
    // @ts-expect-error - .ic-app is an HTMLElement on this page
    await this.processLtiMessages(ltiResponseMessages, document.querySelector('.ic-app'))

    // @ts-expect-error - page-specific ENV property
    const oembed = ENV.oembed
    if (oembed) {
      const oembedRetrieveUrl = $('#oembed_retrieve_url').attr('href')
      const endpointUrl = replaceTags(
        // @ts-expect-error - oEmbed retrieval anchor always has href on this page
        oembedRetrieveUrl,
        'endpoint',
        encodeURIComponent(oembed.endpoint),
      )
      const url = replaceTags(endpointUrl, 'url', encodeURIComponent(oembed.url))
      // @ts-expect-error - legacy jQuery ajaxJSON plugin method typing is too loose
      const _ajaxJsonMethod: never = $.ajaxJSON
      $.ajaxJSON(
        url,
        'GET',
        {},
        (retrievedData: ContentItems) => ExternalContentSuccess.dataReady(retrievedData),
        () =>
          $('#dialog_message').text(
            I18n.t(
              'oembed_failure',
              'Content retrieval failed, please try again or notify your system administrator of the error.',
            ),
          ),
      )
    } else {
      ExternalContentSuccess.dataReady(data, serviceId)
      ExternalContentSuccess.a2DataReady(data)
    }
  }

  ExternalContentSuccess.start()
})

export default ExternalContentSuccess

/*
 * Copyright (C) 2026 - present Instructure, Inc.
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
import {QueryClientProvider} from '@tanstack/react-query'
import {
  MessageStudents,
  MessageStudentsTranslationsProvider,
  type MessageStudentsTranslations,
} from '@instructure/platform-message-students-modal'
import {queryClient} from '@instructure/platform-query'
import type {RenderMessageModalArgs} from '@instructure/platform-widget-dashboard'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('widget_dashboard')

function buildMessageStudentsTranslations(): MessageStudentsTranslations {
  return {
    close: I18n.t('Close'),
    sendMessage: I18n.t('Send Message'),
    to: I18n.t('To'),
    subjectLabel: I18n.t('Subject'),
    bodyLabel: I18n.t('Body'),
    messageSent: I18n.t('Your message was sent!'),
    sending: I18n.t("We're sending your message..."),
    subjectRequired: I18n.t('Please provide a %{field}', {field: I18n.t('Subject')}),
    bodyRequired: I18n.t('Please provide a %{field}', {field: I18n.t('Body')}),
    subjectTooLong: I18n.t('Subject must contain fewer than 255 characters.'),
  }
}

export const renderPeopleMessageModal = ({
  key,
  contextCode,
  recipients,
  title,
  onRequestClose,
}: RenderMessageModalArgs) => (
  <QueryClientProvider client={queryClient}>
    <MessageStudentsTranslationsProvider translations={buildMessageStudentsTranslations()}>
      <MessageStudents
        key={key}
        contextCode={contextCode}
        recipients={recipients}
        title={title}
        onRequestClose={onRequestClose}
      />
    </MessageStudentsTranslationsProvider>
  </QueryClientProvider>
)

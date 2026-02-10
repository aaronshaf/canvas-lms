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

import React from 'react'
import {Alert} from '@instructure/ui-alerts'
import {useScope as createI18nScope} from '@canvas/i18n'

const I18n = createI18nScope('account_course_user_search')

const errorLoadingMessage = I18n.t(
  'There was an error with your query; please try a different search',
)
const noCoursesFoundMessage = I18n.t('No courses found')
const noUsersFoundMessage = I18n.t('No users found')
const userResultsUpdatedMessage = I18n.t('User results updated.')
const courseResultsUpdatedMessage = I18n.t('Course results updated.')

const TIMEOUT = 5000

type Link = {
  url: string
  page: string
}

type SRSearchMessageProps = {
  collection: {
    data: unknown[]
    loading?: boolean
    error?: boolean
    links?: {
      current?: Link
    }
  }
  dataType: 'Course' | 'User'
  getLiveAlertRegion?: () => HTMLElement | null
}

/**
 * This component handles reading the updated message only when rendered and
 * only when the collection has finished loading
 */
export default function SRSearchMessage({
  collection,
  dataType,
  getLiveAlertRegion = () => document.getElementById('flash_screenreader_holder'),
}: SRSearchMessageProps) {
  if (collection.loading) {
    return <noscript />
  }

  if (collection.error) {
    return (
      // @ts-expect-error
      <Alert screenReaderOnly={true} liveRegion={getLiveAlertRegion} timeout={TIMEOUT}>
        {errorLoadingMessage}
      </Alert>
    )
  }
  if (!collection.data.length) {
    if (dataType === 'Course') {
      return (
        // @ts-expect-error
        <Alert screenReaderOnly={true} liveRegion={getLiveAlertRegion} timeout={TIMEOUT}>
          {noCoursesFoundMessage}
        </Alert>
      )
    }
    if (dataType === 'User') {
      return (
        // @ts-expect-error
        <Alert screenReaderOnly={true} liveRegion={getLiveAlertRegion} timeout={TIMEOUT}>
          {noUsersFoundMessage}
        </Alert>
      )
    }
  }

  if (dataType === 'Course') {
    return (
      // @ts-expect-error
      <Alert screenReaderOnly={true} liveRegion={getLiveAlertRegion} timeout={TIMEOUT}>
        {courseResultsUpdatedMessage}
      </Alert>
    )
  }
  if (dataType === 'User') {
    return (
      // @ts-expect-error
      <Alert screenReaderOnly={true} liveRegion={getLiveAlertRegion} timeout={TIMEOUT}>
        {userResultsUpdatedMessage}
      </Alert>
    )
  }

  return <noscript />
}

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

// XSS regression tests for notification preferences Table.
// categoryDescription is rendered via dangerouslySetInnerHTML after
// a <p>→<span> string replacement. Wrap with sanitizeHTML() for
// defense-in-depth at the React sink.

import React from 'react'
import {render} from '@testing-library/react'
import NotificationPreferencesTable from '../Table'
import fakeENV from '@canvas/test-utils/fakeENV'

function makePreferences(categoryDescription) {
  return {
    sendScoresInEmails: false,
    channels: [
      {
        _id: '1',
        path: 'test@test.com',
        pathType: 'email',
        notificationPolicies: [
          {
            communicationChannelId: '1',
            frequency: 'daily',
            notification: {
              category: 'Grading',
              categoryDisplayName: 'Grading',
              categoryDescription,
              name: 'Quiz Regrade Finished',
              _id: '5',
            },
          },
        ],
      },
    ],
  }
}

describe('NotificationPreferencesTable XSS hardening', () => {
  beforeEach(() => {
    fakeENV.setup({
      NOTIFICATION_PREFERENCES_OPTIONS: {
        send_scores_in_emails_text: {label: 'Send scores'},
        allowed_push_categories: [],
      },
      current_user_roles: [],
      discussions_reporting: false,
    })
  })

  afterEach(() => {
    fakeENV.teardown()
  })

  it('strips onerror from img in categoryDescription', () => {
    const xss = '<p><img src="x" onerror="window.__xss986=1"></p>'
    render(
      <NotificationPreferencesTable
        preferences={makePreferences(xss)}
        updatePreference={() => {}}
      />,
    )
    const img = document.querySelector('[data-testid="grading_description"] img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('onerror')).toBeNull()
    expect(window.__xss986).toBeUndefined()
  })

  it('strips javascript: href from anchor in categoryDescription', () => {
    const xss = '<p><a href="javascript:window.__xss986b=1">x</a></p>'
    render(
      <NotificationPreferencesTable
        preferences={makePreferences(xss)}
        updatePreference={() => {}}
      />,
    )
    const anchor = document.querySelector('[data-testid="grading_description"] a')
    expect(anchor).not.toBeNull()
    const href = anchor.getAttribute('href') ?? ''
    expect(href).not.toMatch(/^javascript:/i)
  })

  it('preserves safe description text', () => {
    const safe = '<p>Submit assignments on time.</p>'
    render(
      <NotificationPreferencesTable
        preferences={makePreferences(safe)}
        updatePreference={() => {}}
      />,
    )
    const desc = document.querySelector('[data-testid="grading_description"]')
    expect(desc).not.toBeNull()
    expect(desc.textContent).toContain('Submit assignments on time.')
  })
})

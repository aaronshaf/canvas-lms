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
import {render, screen} from '@testing-library/react'

vi.mock('@instructure/platform-query', () => ({
  queryClient: {},
}))

vi.mock('@tanstack/react-query', () => ({
  QueryClientProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}))

vi.mock('@instructure/platform-message-students-modal', () => ({
  MessageStudents: ({
    contextCode,
    recipients,
    title,
    onRequestClose,
  }: {
    contextCode: string
    recipients: Array<{id: string; displayName?: string}>
    title: string
    onRequestClose: () => void
  }) => (
    <div data-testid="mock-message-students">
      <span data-testid="ctx">{contextCode}</span>
      <span data-testid="title">{title}</span>
      <span data-testid="recipients">{recipients.map(r => r.displayName).join(',')}</span>
      <button data-testid="close" onClick={onRequestClose}>
        close
      </button>
    </div>
  ),
  MessageStudentsTranslationsProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}))

import {renderPeopleMessageModal} from '../renderMessageModal'

describe('renderPeopleMessageModal', () => {
  it('renders MessageStudents with forwarded props', () => {
    const onRequestClose = vi.fn()
    render(
      <>
        {renderPeopleMessageModal({
          key: 1,
          contextCode: 'course_42',
          recipients: [{id: '7', displayName: 'Ada', contextCode: 'course_42'}],
          title: 'Send Message to Ada',
          onRequestClose,
        })}
      </>,
    )

    expect(screen.getByTestId('mock-message-students')).toBeInTheDocument()
    expect(screen.getByTestId('ctx')).toHaveTextContent('course_42')
    expect(screen.getByTestId('title')).toHaveTextContent('Send Message to Ada')
    expect(screen.getByTestId('recipients')).toHaveTextContent('Ada')
  })
})

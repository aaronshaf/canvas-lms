/*
 * Copyright (C) 2025 - present Instructure, Inc.
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

import {render, screen, waitFor} from '@testing-library/react'
import {userEvent} from '@testing-library/user-event'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import CourseDifferentiationTagConverterMessage from '../CourseDifferentiationTagConverterMessage'

const server = setupServer(
  http.put('/api/v1/courses/1/convert_tag_overrides', () => new HttpResponse(null, {status: 204})),
  http.get('/api/v1/courses/1/convert_tag_overrides/status', () =>
    HttpResponse.json({progress: 0, workflow_state: 'queued'}),
  ),
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('CourseDifferentiationTagConverterMessage', () => {
  const renderComponent = (props = {}) => {
    const defaultProps = {
      courseId: '1',
      activeConversionJob: false,
      ...props,
    }

    return render(<CourseDifferentiationTagConverterMessage {...defaultProps} />)
  }

  it('renders conversion message when no active conversion job', () => {
    renderComponent()
    expect(screen.getByTestId('course-differentiation-tag-converter-warning')).toBeInTheDocument()
  })

  it('renders progress bar when active conversion job', () => {
    renderComponent({activeConversionJob: true})
    expect(screen.getByTestId('course-differentiation-tag-conversion-progress')).toBeInTheDocument()
  })

  it('renders success message when conversion is complete', async () => {
    server.use(
      http.get('/api/v1/courses/1/convert_tag_overrides/status', () =>
        HttpResponse.json({progress: 100, workflow_state: 'completed'}),
      ),
    )
    const user = userEvent.setup({advanceTimers: vi.advanceTimersByTime.bind(vi)})
    vi.useFakeTimers()

    renderComponent()
    await user.click(screen.getByTestId('course-tag-conversion-button'))

    vi.advanceTimersByTime(1000)

    await waitFor(() => {
      expect(
        screen.getByTestId('course-differentiation-tag-conversion-success'),
      ).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('renders error message when conversion fails', async () => {
    server.use(http.put('/api/v1/courses/1/convert_tag_overrides', () => HttpResponse.error()))
    const user = userEvent.setup()
    renderComponent()
    await user.click(screen.getByTestId('course-tag-conversion-button'))

    await waitFor(() => {
      expect(screen.getByTestId('course-differentiation-tag-conversion-error')).toBeInTheDocument()
    })
  })
})

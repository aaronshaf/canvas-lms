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
import {render, fireEvent} from '@testing-library/react'
import VideoUrlPanel from '../VideoUrlPanel'

describe('VideoUrlPanel', () => {
  it('calls setFileUrl when the input changes', () => {
    const setFileUrl = vi.fn()
    const {getByLabelText} = render(
      <VideoUrlPanel fileUrl="" setFileUrl={setFileUrl} urlHasError={false} />,
    )
    fireEvent.change(getByLabelText('YouTube embed URL'), {
      target: {value: 'https://youtu.be/dQw4w9WgXcQ'},
    })
    expect(setFileUrl).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ')
  })

  it('shows no error message when urlHasError is false', () => {
    const {queryByText} = render(
      <VideoUrlPanel fileUrl="" setFileUrl={vi.fn()} urlHasError={false} />,
    )
    expect(queryByText(/valid video URL/)).toBeNull()
  })

  it('shows error message when urlHasError is true', () => {
    const {getByText} = render(<VideoUrlPanel fileUrl="" setFileUrl={vi.fn()} urlHasError={true} />)
    expect(getByText(/valid video URL from a supported platform/)).toBeTruthy()
  })

  it('renders with the provided fileUrl value', () => {
    const {getByLabelText} = render(
      <VideoUrlPanel fileUrl="https://youtu.be/test" setFileUrl={vi.fn()} urlHasError={false} />,
    )
    expect(getByLabelText('YouTube embed URL').value).toBe('https://youtu.be/test')
  })
})

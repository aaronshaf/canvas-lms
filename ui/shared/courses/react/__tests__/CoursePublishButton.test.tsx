/*
 * Copyright (C) 2024 - present Instructure, Inc.
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
import CoursePublishButton from '../CoursePublishButton'
import {render, waitFor} from '@testing-library/react'

describe('CoursePublishButton', () => {
  const getProps = (props: object) => {
    return {
      isPublished: false,
      courseId: '1',
      shouldRedirect: false,
      ...props,
    }
  }

  it('button text is "Unpublished" if the course is not published', () => {
    const {getByText} = render(<CoursePublishButton {...getProps({})} />)
    expect(getByText('Unpublished')).toBeInTheDocument()
  })

  it('button text is "Published" if the course is published', () => {
    const {getByText} = render(<CoursePublishButton {...getProps({isPublished: true})} />)
    expect(getByText('Published')).toBeInTheDocument()
  })

  it('opens menu and displays publish/unpublish buttons when button is clicked', async () => {
    const {getByText, findByText} = render(<CoursePublishButton {...getProps({})} />)
    getByText('Unpublished').click()
    expect(await findByText('Publish')).toBeInTheDocument()
    expect(await findByText('Unpublish')).toBeInTheDocument()
  })

  it('unpublish option is disabled if course is unpublished', async () => {
    const {getByText, findByText, findByLabelText} = render(<CoursePublishButton {...getProps({})} />)
    getByText('Unpublished').click()
    expect((await findByLabelText('Unpublish')).getAttribute('aria-disabled')).toBeTruthy()
    expect((await findByText('Publish')).getAttribute('aria-disabled')).toBeNull()
  })

  it('publish option is disabled if course is published', async () => {
    const {getByText, findByText, findByLabelText} = render(
      <CoursePublishButton {...getProps({isPublished: true})} />,
    )
    getByText('Published').click()
    expect((await findByLabelText('Publish')).getAttribute('aria-disabled')).toBeTruthy()
    expect((await findByText('Unpublish')).getAttribute('aria-disabled')).toBeNull()
  })
})

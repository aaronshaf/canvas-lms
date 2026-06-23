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
import {render} from '@testing-library/react'
import {http, HttpResponse} from 'msw'
import {setupServer} from 'msw/node'
import RubricManagement from '../RubricManagement'

const server = setupServer(
  http.get('*/api/v1/accounts/1/outcome_proficiency', () => new HttpResponse(null, {status: 404})),
)

beforeAll(() => server.listen({onUnhandledRequest: 'bypass'}))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const defaultProps = (props = {}) => ({accountId: '1', ...props})

describe('RubricManagement', () => {
  it('renders the RubricManagement component', () => {
    const wrapper = render(<RubricManagement {...defaultProps()} />)
    expect(wrapper.getByText('Account Rubrics')).toBeInTheDocument()
    expect(wrapper.getByText('Learning Mastery')).toBeInTheDocument()
  })

  it('renders both Account Rubrics and Learning Mastery tabs', () => {
    const wrapper = render(<RubricManagement {...defaultProps()} />)
    expect(wrapper.getByRole('tab', {name: 'Account Rubrics'})).toBeInTheDocument()
    expect(wrapper.getByRole('tab', {name: 'Learning Mastery'})).toBeInTheDocument()
  })
})

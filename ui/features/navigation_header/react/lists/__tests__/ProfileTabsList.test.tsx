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
import {cleanup, render as testingLibraryRender} from '@testing-library/react'
import ProfileTabsList from '../ProfileTabsList'
import {queryClient} from '@instructure/platform-query'
import {MockedQueryProvider} from '@canvas/test-utils/query'
import fakeENV from '@canvas/test-utils/fakeENV'

const render = (children: unknown) =>
  testingLibraryRender(<MockedQueryProvider>{children}</MockedQueryProvider>)

afterEach(() => {
  cleanup()
  queryClient.removeQueries()
  fakeENV.teardown()
})

describe('ProfileTabsList', () => {
  beforeEach(() => {
    fakeENV.setup()
  })

  it('renders profile tabs from the query', () => {
    queryClient.setQueryData(
      ['profile'],
      [
        {id: 'foo', label: 'Foo', html_url: '/foo'},
        {id: 'bar', label: 'Bar', html_url: '/bar'},
      ],
    )
    const {getByText} = render(<ProfileTabsList />)
    expect(getByText('Foo').closest('a')).toHaveAttribute('href', '/foo')
    expect(getByText('Bar').closest('a')).toHaveAttribute('href', '/bar')
  })

  it('sanitizes javascript: tab html_url so it does not reach the DOM', () => {
    queryClient.setQueryData(
      ['profile'],
      [{id: 'evil', label: 'Evil Tab', html_url: 'javascript:alert(1)'}],
    )
    const {getByText} = render(<ProfileTabsList />)
    const link = getByText('Evil Tab').closest('a')
    expect(link?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i)
  })
})

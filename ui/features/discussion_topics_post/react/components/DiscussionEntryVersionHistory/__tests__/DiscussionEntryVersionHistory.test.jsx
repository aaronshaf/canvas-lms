/*
 * Copyright (C) 2022 - present Instructure, Inc.
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

import {DiscussionEntryVersionHistory} from '../DiscussionEntryVersionHistory'
import {render, fireEvent} from '@testing-library/react'
import React from 'react'
import {DiscussionEntryVersion} from '../../../../graphql/DiscussionEntryVersion'

const setup = (
  discussionEntryVersions = [
    DiscussionEntryVersion.mock({version: 3, message: 'Message 3'}),
    DiscussionEntryVersion.mock({version: 2, message: 'Message 2'}),
    DiscussionEntryVersion.mock({version: 1, message: 'Message 1'}),
  ],
) =>
  render(
    <DiscussionEntryVersionHistory
      textSize="small"
      discussionEntryVersions={discussionEntryVersions}
    />,
  )

describe('DiscussionEntryVersionHistory', () => {
  it('renders', () => {
    const container = setup()
    expect(container).toBeTruthy()
  })

  it('renders View History', () => {
    const container = setup()
    expect(container.getByText('View History')).toBeInTheDocument()
  })

  it('clicking on View History opens modal', () => {
    const container = setup()
    fireEvent.click(container.getByText('View History'))
    expect(container.getByText('Edit History')).toBeVisible()
  })

  it('does not show versions text when modal opens', () => {
    const container = setup()
    fireEvent.click(container.getByText('View History'))

    expect(container.queryByText('Message 1')).toBeFalsy()
    expect(container.queryByText('Message 2')).toBeFalsy()
    expect(container.queryByText('Message 3')).toBeFalsy()
  })

  it('show versions text when expand all is clicked', () => {
    const container = setup()
    fireEvent.click(container.getByText('View History'))
    fireEvent.click(container.getByText('Expand all'))

    expect(container.queryByText('Message 1')).toBeTruthy()
    expect(container.queryByText('Message 2')).toBeTruthy()
    expect(container.queryByText('Message 3')).toBeTruthy()
  })

  it('does not show versions text when collapse all is clicked', () => {
    const container = setup()
    fireEvent.click(container.getByText('View History'))
    fireEvent.click(container.getByText('Expand all'))
    fireEvent.click(container.getByText('Collapse all'))

    expect(container.queryByText('Message 1')).toBeFalsy()
    expect(container.queryByText('Message 2')).toBeFalsy()
    expect(container.queryByText('Message 3')).toBeFalsy()
  })

  it('shows particular version when clicking on the toggle for it', () => {
    const container = setup()
    fireEvent.click(container.getByText('View History'))

    fireEvent.click(container.getByTestId('v1-toggle'))
    expect(container.queryByText('Message 1')).toBeTruthy()
    expect(container.queryByText('Message 2')).toBeFalsy()
    expect(container.queryByText('Message 3')).toBeFalsy()

    fireEvent.click(container.getByTestId('v2-toggle'))
    expect(container.queryByText('Message 1')).toBeTruthy()
    expect(container.queryByText('Message 2')).toBeTruthy()
    expect(container.queryByText('Message 3')).toBeFalsy()
  })

  it('shows only one button for Expand all or Collapse all', () => {
    const container = setup()
    fireEvent.click(container.getByText('View History'))

    expect(container.queryByText('Expand all')).toBeTruthy()
    expect(container.queryByText('Collapse all')).toBeFalsy()

    fireEvent.click(container.getByText('Expand all'))

    expect(container.queryByText('Expand all')).toBeFalsy()
    expect(container.queryByText('Collapse all')).toBeTruthy()
  })

  describe('XSS hardening', () => {
    // The version-history modal renders into a portal, so assertions must
    // look at document.body, not the render() container.
    const MALICIOUS = '<p onclick="window.__xss=1">click</p><script>window.__xss=2</script>safe'

    afterEach(() => {
      delete window.__xss
    })

    it('strips dangerous attributes/tags when expanding all versions', () => {
      const {getByText} = setup([DiscussionEntryVersion.mock({version: 1, message: MALICIOUS})])
      fireEvent.click(getByText('View History'))
      fireEvent.click(getByText('Expand all'))

      const html = document.body.innerHTML
      expect(html).not.toMatch(/\son[a-z]+\s*=/i)
      expect(html).not.toContain('<script')
      expect(window.__xss).toBeUndefined()
    })

    it('strips dangerous attributes/tags when toggling an individual version', () => {
      const {getByText, getByTestId} = setup([
        DiscussionEntryVersion.mock({version: 1, message: MALICIOUS}),
      ])
      fireEvent.click(getByText('View History'))
      fireEvent.click(getByTestId('v1-toggle'))

      const html = document.body.innerHTML
      expect(html).not.toMatch(/\son[a-z]+\s*=/i)
      expect(html).not.toContain('<script')
      expect(window.__xss).toBeUndefined()
    })
  })
})

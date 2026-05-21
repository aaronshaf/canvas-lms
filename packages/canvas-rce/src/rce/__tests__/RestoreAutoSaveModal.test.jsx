/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import {fireEvent, render} from '@testing-library/react'
import React from 'react'
import RestoreAutoSaveModal from '../RestoreAutoSaveModal'

describe('RestoreAutoSaveModal', () => {
  it('renders all its content', () => {
    const onNo = vi.fn()
    const {getByText} = render(
      <RestoreAutoSaveModal savedContent="<p>hello world</p>" open onNo={onNo} onYes={() => {}} />,
    )

    expect(getByText('Found auto-saved content')).toBeInTheDocument()
    expect(
      getByText(
        'Auto-saved content exists. Would you like to load the auto-saved content instead?',
      ),
    ).toBeInTheDocument()
    expect(getByText('Preview')).toBeInTheDocument()
    expect(getByText('Click to show preview')).toBeInTheDocument()
    expect(getByText('No')).toBeInTheDocument()
    expect(getByText('Yes')).toBeInTheDocument()
    const closeButton = getByText('Close')
    expect(closeButton).toBeInTheDocument()
    fireEvent.click(closeButton.closest('button'))
    expect(onNo).toHaveBeenCalled()
  })

  it('responds to clicking "yes"', () => {
    const onNo = vi.fn()
    const onYes = vi.fn()
    const {getByText} = render(
      <RestoreAutoSaveModal savedContent="<p>hello world</p>" open onNo={onNo} onYes={onYes} />,
    )

    const yesButton = getByText('Yes').closest('button')
    fireEvent.click(yesButton)
    expect(onYes).toHaveBeenCalled()
    expect(onNo).not.toHaveBeenCalled()
  })

  it('responds to clicking "no"', () => {
    const onNo = vi.fn()
    const onYes = vi.fn()
    const {getByText} = render(
      <RestoreAutoSaveModal savedContent="<p>hello world</p>" open onNo={onNo} onYes={onYes} />,
    )

    const noButton = getByText('No').closest('button')
    fireEvent.click(noButton)
    expect(onYes).not.toHaveBeenCalled()
    expect(onNo).toHaveBeenCalled()
  })

  it('displays the auto saved content preview', () => {
    const {getByText} = render(
      <RestoreAutoSaveModal
        savedContent="<p>hello world</p>"
        open
        onNo={() => {}}
        onYes={() => {}}
      />,
    )

    const previewButton = getByText('Click to show preview')
    expect(previewButton).toBeInTheDocument()
    fireEvent.click(previewButton.closest('button'))
    expect(getByText('hello world')).toBeInTheDocument()
    expect(getByText('Click to hide preview')).toBeInTheDocument()
  })

  it('sanitizes autosaved content before rendering preview (regression: a7ac409a29a)', () => {
    // Before fix: savedContent was passed directly to dangerouslySetInnerHTML,
    // allowing XSS if an attacker could corrupt the autosave localStorage entry.
    // After fix: sanitizeHtml (DOMPurify) strips script tags and event handlers.
    const {getByText, container} = render(
      <RestoreAutoSaveModal
        savedContent='<p>safe</p><script>window.__xss=1</script><img src="x" onerror="window.__xss=2">'
        open
        onNo={() => {}}
        onYes={() => {}}
      />,
    )

    fireEvent.click(getByText('Click to show preview').closest('button'))

    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img[onerror]')).toBeNull()
    expect(getByText('safe')).toBeInTheDocument()
  })
})

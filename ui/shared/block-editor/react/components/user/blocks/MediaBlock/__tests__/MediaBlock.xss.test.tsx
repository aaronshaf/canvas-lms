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

// Regression coverage for the user-authored MediaBlock iframe sink.
// MediaBlock renders block-editor content where the iframe src comes
// from the page author via UploadMediaModal. A javascript: src must be
// replaced with about:blank before reaching the iframe attribute.

import React from 'react'
import {render} from '@testing-library/react'
import {Editor, Frame} from '@craftjs/core'
import {MediaBlock, type MediaBlockProps} from '..'

const renderBlock = (props: Partial<MediaBlockProps> = {}) =>
  render(
    <Editor enabled={false} resolver={{MediaBlock}}>
      <Frame>
        <MediaBlock {...props} />
      </Frame>
    </Editor>,
  )

describe('MediaBlock — iframe src sanitization', () => {
  it('replaces a javascript: iframe src with about:blank', () => {
    const {container} = renderBlock({src: 'javascript:alert(1)'})
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe('about:blank')
  })

  it('passes through a legitimate https: iframe src unchanged', () => {
    const {container} = renderBlock({src: 'https://example.com/embed/abc'})
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe('https://example.com/embed/abc')
  })
})

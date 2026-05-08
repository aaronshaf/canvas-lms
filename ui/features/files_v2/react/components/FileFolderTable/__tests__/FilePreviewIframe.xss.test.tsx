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

// Regression coverage for the file-preview iframe sink. preview_url is
// supplied by the Files API; a javascript: scheme that ever leaks into
// the response must be replaced with about:blank before reaching the
// iframe attribute.

import React from 'react'
import {render} from '@testing-library/react'
import FilePreviewIframe from '../FilePreviewIframe'
import type {File} from '../../../../interfaces/File'

const baseFile = {
  id: '1',
  display_name: 'preview.html',
  mime_class: 'pdf',
  preview_url: '',
} as unknown as File

describe('FilePreviewIframe — preview_url sanitization', () => {
  it('replaces a javascript: preview_url with about:blank', () => {
    const {container} = render(
      <FilePreviewIframe item={{...baseFile, preview_url: 'javascript:alert(1)'} as File} />,
    )
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('about:blank')
  })

  it('passes through a legitimate https: preview_url unchanged', () => {
    const {container} = render(
      <FilePreviewIframe
        item={{...baseFile, preview_url: 'https://canvas.example.com/preview/1'} as File}
      />,
    )
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
      'https://canvas.example.com/preview/1',
    )
  })
})

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

import {loadDocPreview, isPreviewable, previewableMimeTypes} from '../doc_previews'

describe('isPreviewable', () => {
  it('returns true for previewable MIME types', () => {
    expect(isPreviewable('application/pdf')).toBe(true)
    expect(isPreviewable('application/msword')).toBe(true)
    expect(isPreviewable('text/plain')).toBe(true)
  })

  it('returns false for non-previewable MIME types', () => {
    expect(isPreviewable('image/png')).toBe(false)
    expect(isPreviewable('video/mp4')).toBe(false)
    expect(isPreviewable('application/octet-stream')).toBe(false)
  })

  it('includes all expected office document types', () => {
    expect(previewableMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    expect(previewableMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(previewableMimeTypes).toContain(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    )
  })
})

describe('loadDocPreview', () => {
  describe('fallback message (regression: 838037bbbcb)', () => {
    // Before fix: $container.empty().append(paragraph) used jQuery methods
    // on a native DOM element, throwing "empty is not a function".
    // After fix: uses replaceChildren() + appendChild() native DOM APIs.

    it('does not throw when no preview option is available', () => {
      const container = document.createElement('div')
      expect(() => loadDocPreview(container, {})).not.toThrow()
    })

    it('replaces existing children with fallback message paragraph', () => {
      const container = document.createElement('div')
      const existing = document.createElement('span')
      existing.textContent = 'old content'
      container.appendChild(existing)

      loadDocPreview(container, {})

      expect(container.querySelector('span')).toBeNull()
      expect(container.querySelector('p')).not.toBeNull()
      expect(container.querySelector('p').textContent).toMatch(/cannot be displayed within Canvas/)
    })

    it('shows processing message when attachment_preview_processing is true', () => {
      const container = document.createElement('div')
      loadDocPreview(container, {attachment_preview_processing: true})

      const p = container.querySelector('p')
      expect(p).not.toBeNull()
      expect(p.textContent).toMatch(/currently being processed/i)
    })
  })

  describe('canvadoc preview', () => {
    it('renders an iframe with the canvadoc session url', () => {
      const container = document.createElement('div')
      const sessionUrl = 'https://canvadocs.example.com/session/123'
      loadDocPreview(container, {canvadoc_session_url: sessionUrl})

      const iframe = container.querySelector('iframe')
      expect(iframe).not.toBeNull()
      expect(iframe.getAttribute('src')).toBe(sessionUrl)
    })

    it('sets a valid CSS min-height on the iframe style (regression: 3005d65b21b)', () => {
      // Bug: style had "min-height': 800px" (stray single quote) so the iframe was not
      // constrained to 800px in browsers that rejected the malformed property.
      // Fix: corrected to "min-height: 800px".
      const container = document.createElement('div')
      loadDocPreview(container, {canvadoc_session_url: 'https://canvadocs.example.com/s/1'})
      const iframe = container.querySelector('iframe')
      expect(iframe.getAttribute('style')).toMatch(/min-height: 800px/)
      expect(iframe.getAttribute('style')).not.toMatch(/min-height':/)
    })

    describe('aria-label on canvadoc iframe (regression: 7118c7a01ec)', () => {
      // Before fix: no aria-label on the iframe, making it inaccessible to screen readers.
      // After fix: aria-label set to "File preview for {name}" or "File preview".

      it('uses generic label when no attachment_name provided', () => {
        const container = document.createElement('div')
        loadDocPreview(container, {canvadoc_session_url: 'https://canvadocs.example.com/s/1'})

        const iframe = container.querySelector('iframe')
        expect(iframe.getAttribute('aria-label')).toBe('File preview')
      })

      it('includes file name in label when attachment_name provided', () => {
        const container = document.createElement('div')
        loadDocPreview(container, {
          canvadoc_session_url: 'https://canvadocs.example.com/s/1',
          attachment_name: 'report.pdf',
        })

        const iframe = container.querySelector('iframe')
        expect(iframe.getAttribute('aria-label')).toMatch(/report\.pdf/)
      })
    })
  })
})

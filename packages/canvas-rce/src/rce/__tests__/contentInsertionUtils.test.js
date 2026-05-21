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

import {isOnlyTextSelected, isOKToLink, isImageFigure, cleanUrl} from '../contentInsertionUtils'

describe('isOnlyTextSelected (regression: e9a50f42290)', () => {
  // Before fix: d.innerHTML = html — direct innerHTML assignment, blocked by
  // Trusted Types Phase 2 enforcement.
  // After fix: setRceHTML(d, html) — routes through the named 'canvas-rce' TT
  // policy, falling back to direct assignment in environments without TT.
  // Behavior is unchanged: returns true iff html contains no media elements.

  it('returns true for plain text', () => {
    expect(isOnlyTextSelected('hello world')).toBe(true)
  })

  it('returns true for plain html text with inline formatting', () => {
    expect(isOnlyTextSelected('<strong>bold</strong> and <em>italic</em>')).toBe(true)
  })

  it('returns true for anchor tags (links are allowed with text selection)', () => {
    expect(isOnlyTextSelected('<a href="https://example.com">link</a>')).toBe(true)
  })

  it('returns false when html contains an img', () => {
    expect(isOnlyTextSelected('<img src="photo.jpg" />')).toBe(false)
  })

  it('returns false when html contains an iframe', () => {
    expect(isOnlyTextSelected('<iframe src="https://example.com"></iframe>')).toBe(false)
  })

  it('returns false when html contains a video', () => {
    expect(isOnlyTextSelected('<video src="clip.mp4"></video>')).toBe(false)
  })

  it('returns false when html contains an audio', () => {
    expect(isOnlyTextSelected('<audio src="sound.mp3"></audio>')).toBe(false)
  })

  it('returns false when a media element is nested inside other markup', () => {
    expect(isOnlyTextSelected('<p>text <img src="x.png" /> more</p>')).toBe(false)
  })
})

describe('isOKToLink', () => {
  it('returns true for plain text html', () => {
    expect(isOKToLink('<p>some text</p>')).toBe(true)
  })

  it('returns false when html contains an iframe', () => {
    expect(isOKToLink('<iframe src="https://example.com"></iframe>')).toBe(false)
  })

  it('returns false when html contains an audio element', () => {
    expect(isOKToLink('<audio src="clip.mp3"></audio>')).toBe(false)
  })

  it('returns false when html contains a video element', () => {
    expect(isOKToLink('<video src="clip.mp4"></video>')).toBe(false)
  })

  it('returns false when html contains a placeholder for media upload', () => {
    expect(isOKToLink('<span data-placeholder-for="file.mp4"></span>')).toBe(false)
  })

  it('returns true for img tags (images can be wrapped in links)', () => {
    expect(isOKToLink('<img src="photo.jpg" />')).toBe(true)
  })
})

describe('isImageFigure', () => {
  it('returns true for a FIGURE element with class "image"', () => {
    const fig = document.createElement('figure')
    fig.className = 'image'
    expect(isImageFigure(fig)).toBe(true)
  })

  it('returns true when "image" class is mixed with other classes', () => {
    const fig = document.createElement('figure')
    fig.className = 'image fullscreen'
    expect(isImageFigure(fig)).toBe(true)
  })

  it('returns false for a FIGURE without the image class', () => {
    const fig = document.createElement('figure')
    fig.className = 'video'
    expect(isImageFigure(fig)).toBe(false)
  })

  it('returns false for a non-FIGURE element with image class', () => {
    const div = document.createElement('div')
    div.className = 'image'
    expect(isImageFigure(div)).toBe(false)
  })

  it('returns falsy for null', () => {
    expect(isImageFigure(null)).toBeFalsy()
  })
})

describe('cleanUrl', () => {
  it('passes through an already-correct http URL', () => {
    expect(cleanUrl('http://www.example.com')).toBe('http://www.example.com')
  })

  it('passes through an https URL', () => {
    expect(cleanUrl('https://example.com/path')).toBe('https://example.com/path')
  })

  it('prepends http:// to a bare domain', () => {
    expect(cleanUrl('www.example.com')).toBe('http://www.example.com')
  })

  it('converts an email address to a mailto: link', () => {
    expect(cleanUrl('user@example.com')).toBe('mailto:user@example.com')
  })

  it('leaves an existing mailto: link alone', () => {
    expect(cleanUrl('mailto:user@example.com')).toBe('mailto:user@example.com')
  })

  it('returns undefined for undefined input', () => {
    expect(cleanUrl(undefined)).toBeUndefined()
  })

  it('passes through absolute paths (starting with /)', () => {
    expect(cleanUrl('/courses/1/files/2')).toBe('/courses/1/files/2')
  })

  it('passes through tel: links', () => {
    expect(cleanUrl('tel:+15551234567')).toBe('tel:+15551234567')
  })
})

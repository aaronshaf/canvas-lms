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

import {validateVideoUrl} from '../videoValidationUtils'

const VALID_VIDEO_ID = 'dQw4w9WgXcQ'
const EMBED_URL = `https://www.youtube.com/embed/${VALID_VIDEO_ID}`

describe('validateVideoUrl', () => {
  describe('invalid inputs', () => {
    it('returns invalid for null', () => {
      expect(validateVideoUrl(null)).toEqual({isValid: false, embedUrl: null})
    })

    it('returns invalid for undefined', () => {
      expect(validateVideoUrl(undefined)).toEqual({isValid: false, embedUrl: null})
    })

    it('returns invalid for empty string', () => {
      expect(validateVideoUrl('')).toEqual({isValid: false, embedUrl: null})
    })

    it('returns invalid for a non-YouTube URL', () => {
      expect(validateVideoUrl('https://vimeo.com/12345')).toEqual({isValid: false, embedUrl: null})
    })

    it('returns invalid for a plain string with no URL', () => {
      expect(validateVideoUrl('not a url')).toEqual({isValid: false, embedUrl: null})
    })
  })

  describe('watch URLs', () => {
    it('validates a standard https watch URL', () => {
      const result = validateVideoUrl(`https://www.youtube.com/watch?v=${VALID_VIDEO_ID}`)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })

    it('validates a watch URL without https scheme', () => {
      const result = validateVideoUrl(`www.youtube.com/watch?v=${VALID_VIDEO_ID}`)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })

    it('validates a watch URL with additional query parameters', () => {
      const result = validateVideoUrl(
        `https://www.youtube.com/watch?v=${VALID_VIDEO_ID}&t=30s&list=PL123`,
      )
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })
  })

  describe('short youtu.be URLs', () => {
    it('validates a youtu.be short URL with https', () => {
      const result = validateVideoUrl(`https://youtu.be/${VALID_VIDEO_ID}`)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })

    it('validates a youtu.be short URL without scheme', () => {
      const result = validateVideoUrl(`youtu.be/${VALID_VIDEO_ID}`)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })
  })

  describe('mobile YouTube URLs', () => {
    it('validates a mobile (m.youtube.com) watch URL', () => {
      const result = validateVideoUrl(`https://m.youtube.com/watch?v=${VALID_VIDEO_ID}`)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })
  })

  describe('embed URLs', () => {
    it('validates a youtube.com/embed/ URL', () => {
      const result = validateVideoUrl(`https://www.youtube.com/embed/${VALID_VIDEO_ID}`)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })

    it('validates an embed URL with query parameters', () => {
      const result = validateVideoUrl(`https://www.youtube.com/embed/${VALID_VIDEO_ID}?autoplay=1`)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })
  })

  describe('iframe embed HTML', () => {
    it('extracts video id from an iframe embed snippet', () => {
      const iframe = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${VALID_VIDEO_ID}" frameborder="0" allowfullscreen></iframe>`
      const result = validateVideoUrl(iframe)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })

    it('handles iframe with single-quoted src attribute', () => {
      const iframe = `<iframe src='https://www.youtube.com/embed/${VALID_VIDEO_ID}'></iframe>`
      const result = validateVideoUrl(iframe)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })
  })

  describe('whitespace handling', () => {
    it('trims leading and trailing whitespace before matching', () => {
      const result = validateVideoUrl(`  https://youtu.be/${VALID_VIDEO_ID}  `)
      expect(result.isValid).toBe(true)
      expect(result.embedUrl).toBe(EMBED_URL)
    })
  })

  describe('non-YouTube domains that look similar', () => {
    it('returns invalid for a domain that contains youtube but is not youtube', () => {
      const result = validateVideoUrl(`https://www.notyoutube.com/watch?v=${VALID_VIDEO_ID}`)
      expect(result).toEqual({isValid: false, embedUrl: null})
    })
  })
})

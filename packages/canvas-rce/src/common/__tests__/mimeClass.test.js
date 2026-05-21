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

import {mimeClass, fileEmbed} from '../mimeClass'

describe('mimeClass', () => {
  describe('when file has mime_class set', () => {
    it('returns it directly without inspecting content_type', () => {
      expect(mimeClass({mime_class: 'image', content_type: 'text/plain'})).toBe('image')
    })
  })

  describe('when file has content_type without MIME parameters', () => {
    it('returns text for text/plain', () => {
      expect(mimeClass({content_type: 'text/plain'})).toBe('text')
    })

    it('returns image for image/png', () => {
      expect(mimeClass({content_type: 'image/png'})).toBe('image')
    })

    it('returns audio for audio/mp3', () => {
      expect(mimeClass({content_type: 'audio/mp3'})).toBe('audio')
    })

    it('returns video for video/mp4', () => {
      expect(mimeClass({content_type: 'video/mp4'})).toBe('video')
    })

    it('returns pdf for application/pdf', () => {
      expect(mimeClass({content_type: 'application/pdf'})).toBe('pdf')
    })
  })

  describe('when content_type includes MIME parameters (regression: b9c021791c7)', () => {
    it('strips charset parameter and returns correct class for text/plain', () => {
      expect(mimeClass({content_type: 'text/plain; charset=UTF-8'})).toBe('text')
    })

    it('strips charset parameter with different encodings', () => {
      expect(mimeClass({content_type: 'text/plain; charset=ISO-8859-1'})).toBe('text')
      expect(mimeClass({content_type: 'text/plain;charset=utf-8'})).toBe('text')
    })

    it('strips boundary parameter from multipart types', () => {
      expect(mimeClass({content_type: 'text/html; boundary=something'})).toBe('html')
    })

    it('strips multiple parameters', () => {
      expect(mimeClass({content_type: 'text/plain; charset=UTF-8; format=flowed'})).toBe('text')
    })

    it('returns file for unknown types with parameters', () => {
      expect(mimeClass({content_type: 'application/octet-stream; name=file.bin'})).toBe('file')
    })
  })

  describe('fallback behavior', () => {
    it('returns file when content_type is unrecognized', () => {
      expect(mimeClass({content_type: 'application/octet-stream'})).toBe('file')
    })

    it('returns file when no type information is available', () => {
      expect(mimeClass({})).toBe('file')
    })

    it('uses content-type field (hyphenated) when available', () => {
      expect(mimeClass({'content-type': 'image/jpeg'})).toBe('image')
    })

    it('uses type field when available', () => {
      expect(mimeClass({type: 'video/webm'})).toBe('video')
    })
  })
})

describe('fileEmbed', () => {
  it('returns image type for image files', () => {
    expect(fileEmbed({content_type: 'image/png'})).toEqual({type: 'image'})
  })

  it('returns video type for video files', () => {
    expect(fileEmbed({content_type: 'video/mp4'})).toEqual({type: 'video'})
  })

  it('returns audio type for audio files', () => {
    expect(fileEmbed({content_type: 'audio/mp3'})).toEqual({type: 'audio'})
  })

  it('returns scribd type when preview_url is present', () => {
    expect(fileEmbed({content_type: 'application/pdf', preview_url: '/preview'})).toEqual({
      type: 'scribd',
    })
  })

  it('returns file type as fallback', () => {
    expect(fileEmbed({content_type: 'application/octet-stream'})).toEqual({type: 'file'})
  })

  it('handles text/plain with charset parameter correctly (regression)', () => {
    // Before fix: text/plain; charset=UTF-8 was unrecognized → returned 'file' embed
    // After fix: strips params → recognized as 'text' → no preview_url → 'file' embed
    // The key regression was word_count_supported? returning false; fileEmbed behavior
    // for text is to return file type (no direct embed), which is correct
    expect(fileEmbed({content_type: 'text/plain; charset=UTF-8'})).toEqual({type: 'file'})
  })
})

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

import {sanitizeCaption} from '../captionSanitizer'

describe('caption sanitizer', () => {
  it('strips <link> elements to prevent stylesheet injection', () => {
    const html =
      '<link rel="stylesheet" href="https://attacker.example.com/evil.css"><b>caption</b>'
    const result = sanitizeCaption(html)
    expect(result).not.toContain('<link')
    expect(result).toContain('<b>caption</b>')
  })

  it('strips <style> elements', () => {
    const result = sanitizeCaption('<style>body{display:none}</style><b>ok</b>')
    expect(result).not.toContain('<style')
    expect(result).not.toContain('display:none')
    expect(result).toContain('<b>ok</b>')
  })

  it('strips <meta> elements', () => {
    const result = sanitizeCaption('<meta http-equiv="refresh" content="0;url=//evil"><b>ok</b>')
    expect(result).not.toContain('<meta')
    expect(result).toContain('<b>ok</b>')
  })

  it('strips <base> elements', () => {
    const result = sanitizeCaption('<base href="https://attacker.example.com/"><b>ok</b>')
    expect(result).not.toContain('<base')
    expect(result).toContain('<b>ok</b>')
  })

  it('strips <script> elements', () => {
    const result = sanitizeCaption('<script>alert(1)</script><b>ok</b>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert(1)')
    expect(result).toContain('<b>ok</b>')
  })

  it('strips <iframe> elements', () => {
    const result = sanitizeCaption('<iframe src="https://attacker.example.com/"></iframe><b>ok</b>')
    expect(result).not.toContain('<iframe')
    expect(result).toContain('<b>ok</b>')
  })

  it('strips <img onerror> payloads', () => {
    const result = sanitizeCaption('<img src=x onerror="alert(1)"><b>ok</b>')
    expect(result).not.toContain('<img')
    expect(result).not.toContain('onerror')
    expect(result).toContain('<b>ok</b>')
  })

  it('strips on* event handler attributes on allowed elements', () => {
    const result = sanitizeCaption('<b onclick="alert(1)">caption</b>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('<b>caption</b>')
  })

  it('strips style attributes on allowed elements', () => {
    const result = sanitizeCaption('<b style="position:fixed;top:0">caption</b>')
    expect(result).not.toContain('style=')
    expect(result).toContain('<b>caption</b>')
  })

  it('strips data-* attributes on allowed elements', () => {
    const result = sanitizeCaption('<b data-foo="bar">caption</b>')
    expect(result).not.toContain('data-foo')
    expect(result).toContain('<b>caption</b>')
  })

  it('strips javascript: URLs nested in allowed elements', () => {
    const result = sanitizeCaption('<b><a href="javascript:alert(1)">click</a>caption</b>')
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('<a')
    expect(result).toContain('caption')
  })

  it('strips disallowed elements nested inside allowed ones', () => {
    const result = sanitizeCaption('<b><script>alert(1)</script>caption</b>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert(1)')
    expect(result).toContain('caption')
  })

  it('preserves allowed inline caption elements', () => {
    const html = '<b>bold</b> <i>italic</i> <u>underline</u>'
    const result = sanitizeCaption(html)
    expect(result).toContain('<b>bold</b>')
    expect(result).toContain('<i>italic</i>')
    expect(result).toContain('<u>underline</u>')
  })

  it('preserves nested allowed elements', () => {
    const result = sanitizeCaption('<i><b>nested</b></i>')
    expect(result).toContain('<b>nested</b>')
    expect(result).toContain('<i>')
  })

  it('preserves plain text', () => {
    const result = sanitizeCaption('just plain caption text')
    expect(result).toContain('just plain caption text')
  })

  it('preserves <v> (voice) WebVTT tag', () => {
    const result = sanitizeCaption('<v>speaker text</v>')
    expect(result).toContain('<v>')
    expect(result).toContain('speaker text')
  })

  it('preserves <c> (class) WebVTT tag', () => {
    const result = sanitizeCaption('<c>styled text</c>')
    expect(result).toContain('<c>')
    expect(result).toContain('styled text')
  })

  it('preserves <ruby> and <rt> WebVTT tags', () => {
    const result = sanitizeCaption('<ruby>漢字<rt>かんじ</rt></ruby>')
    expect(result).toContain('<ruby>')
    expect(result).toContain('<rt>')
    expect(result).toContain('漢字')
    expect(result).toContain('かんじ')
  })

  it('preserves <lang> WebVTT tag', () => {
    const result = sanitizeCaption('<lang>localized text</lang>')
    expect(result).toContain('<lang>')
    expect(result).toContain('localized text')
  })

  it('strips disallowed tags while keeping content from all allowed tags', () => {
    const html = '<v>voice</v><c>class</c><ruby>rb<rt>rt</rt></ruby><lang>lang</lang>'
    const result = sanitizeCaption(html)
    expect(result).toContain('<v>')
    expect(result).toContain('<c>')
    expect(result).toContain('<ruby>')
    expect(result).toContain('<rt>')
    expect(result).toContain('<lang>')
  })

  // MEP renders cue text as raw HTML via jQuery .html() and never reads
  // WebVTT speaker/language annotations from the DOM, so stripping them
  // is consistent with how captions are actually displayed.
  it('strips <v> speaker annotation, preserves element and text', () => {
    const result = sanitizeCaption('<v Speaker>hi</v>')
    expect(result).toBe('<v>hi</v>')
  })

  it('strips <lang> language annotation, preserves element and text', () => {
    const result = sanitizeCaption('<lang en>localized</lang>')
    expect(result).toBe('<lang>localized</lang>')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeCaption('')).toBe('')
  })

  it('returns empty string for null input', () => {
    expect(sanitizeCaption(null)).toBe('')
  })
})

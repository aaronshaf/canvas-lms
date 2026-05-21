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

import {patchAutosavedContent, isElementWithinTable} from '../RCEWrapper.utils'

describe('patchAutosavedContent', () => {
  it('returns content unchanged when there are no placeholder elements', () => {
    const html = '<p>Hello world</p>'
    expect(patchAutosavedContent(html)).toBe('<p>Hello world</p>')
  })

  it('removes elements with data-placeholder-for attribute', () => {
    const html = '<p>text</p><span data-placeholder-for="upload.mp4"></span>'
    expect(patchAutosavedContent(html)).toBe('<p>text</p>')
  })

  it('removes multiple placeholder elements', () => {
    const html =
      '<div>' +
      '<p>before</p>' +
      '<span data-placeholder-for="a.mp4"></span>' +
      '<span data-placeholder-for="b.jpg"></span>' +
      '<p>after</p>' +
      '</div>'
    const result = patchAutosavedContent(html)
    expect(result).not.toContain('data-placeholder-for')
    expect(result).toContain('before')
    expect(result).toContain('after')
  })

  it('returns textContent when asText is true', () => {
    const html = '<p>Hello <strong>world</strong></p>'
    expect(patchAutosavedContent(html, true)).toBe('Hello world')
  })

  it('strips placeholder elements from text output too', () => {
    const html = '<p>keep</p><span data-placeholder-for="file.mp4">placeholder</span>'
    const text = patchAutosavedContent(html, true)
    expect(text).not.toContain('placeholder')
    expect(text).toContain('keep')
  })
})

describe('isElementWithinTable', () => {
  it('returns true when element is a TD', () => {
    const td = document.createElement('td')
    expect(isElementWithinTable(td)).toBe(true)
  })

  it('returns true when element is a TH', () => {
    const th = document.createElement('th')
    expect(isElementWithinTable(th)).toBe(true)
  })

  it('returns true when element is a TABLE', () => {
    const table = document.createElement('table')
    expect(isElementWithinTable(table)).toBe(true)
  })

  it('returns true when element is nested inside a TD', () => {
    const table = document.createElement('table')
    const tr = table.insertRow()
    const td = tr.insertCell()
    const span = document.createElement('span')
    td.appendChild(span)
    expect(isElementWithinTable(span)).toBe(true)
  })

  it('returns false for a plain div not inside a table', () => {
    const div = document.createElement('div')
    expect(isElementWithinTable(div)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isElementWithinTable(null)).toBe(false)
  })
})

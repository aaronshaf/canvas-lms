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

// Regression coverage for the central $.fn.fillTemplateData href sink.
// fillTemplateData rewrites href attributes on rendered anchor elements from
// a template's data object. A javascript:-scheme URL flowing through the
// template (whether due to a server bug or a malicious template author) must
// not reach the live <a href> attribute.

import $ from 'jquery'
import '../templateData'

describe('$.fn.fillTemplateData href sanitization', () => {
  it('replaces a javascript: href with about:blank when the template substitutes', () => {
    // Template href carries a javascript: prefix; substitution makes
    // newHref !== oldHref so the wrap branch fires.
    const $template = $('<div><a class="link" href="javascript:alert({{token}})">x</a></div>')
    $template.fillTemplateData({
      data: {token: '1'},
      hrefValues: ['token'],
    })
    expect($template.find('a').attr('href')).toBe('about:blank')
  })

  it('passes through a legitimate relative path unchanged', () => {
    const $template = $('<div><a class="link" href="/courses/{{id}}">x</a></div>')
    $template.fillTemplateData({
      data: {id: '42'},
      hrefValues: ['id'],
    })
    expect($template.find('a').attr('href')).toBe('/courses/42')
  })
})

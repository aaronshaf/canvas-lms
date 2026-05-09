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

// WebVTT caption element allowlist — no <link>, <style>, <meta>, or <base>
const CAPTION_ELEMENT_ALLOWLIST = ['i', 'b', 'u', 'v', 'c', 'ruby', 'rt', 'lang']

export function sanitizeCaption(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  let elements = Array.from(doc.body.children || [])
  while (elements.length) {
    const node = elements.shift()
    if (CAPTION_ELEMENT_ALLOWLIST.includes(node.tagName.toLowerCase())) {
      elements = elements.concat(Array.from(node.children || []))
    } else {
      node.parentNode.removeChild(node)
    }
  }

  const allElements = doc.body.getElementsByTagName('*')
  for (let i = 0, n = allElements.length; i < n; i++) {
    const attributesObj = allElements[i].attributes,
      attributes = Array.prototype.slice.call(attributesObj)
    for (let j = 0, total = attributes.length; j < total; j++) {
      if (attributes[j].name.startsWith('on') || attributes[j].value.startsWith('javascript')) {
        allElements[i].parentNode.removeChild(allElements[i])
      } else if (attributes[j].name === 'style' || attributes[j].name.startsWith('data-')) {
        allElements[i].removeAttribute(attributes[j].name)
      }
    }
  }

  return doc.body.innerHTML
}

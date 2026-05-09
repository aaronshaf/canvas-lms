/*
 * Copyright (C) 2021 - present Instructure, Inc.
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
import {insert, insertMentionFor, removeTriggerChar, replace} from '../edit'
import {MARKER_ID, TRIGGER_CHAR} from '../constants'
import FakeEditor from './FakeEditor'

let editor

beforeEach(() => {
  editor = new FakeEditor()

  editor.execCommand = vi.fn()
  editor.execCommand.mockImplementation(function (command, _ui, value) {
    const newElement = document.createElement('span')
    newElement.innerHTML = value
    this._$container.appendChild(newElement)
    return true
  })
})

afterEach(() => {
  vi.resetAllMocks()
})

const returnValueExamples = subject => {
  describe('when the insert succeeds', () => {
    beforeEach(() => editor.execCommand.mockReturnValueOnce(true))

    it('returns true', () => {
      expect(subject()).toEqual(true)
    })
  })

  describe('when the insert fails', () => {
    beforeEach(() => editor.execCommand.mockReturnValueOnce(false))

    it('returns false', () => {
      expect(subject()).toEqual(false)
    })
  })
}

describe('insert()', () => {
  const html = '<p id="new">hello!</p>'

  const subject = () => insert(html, editor)

  it('inserts the content into the editor', () => {
    subject()
    expect(editor.getContainer().querySelector('#new').innerHTML).toEqual('hello!')
  })

  returnValueExamples(subject)
})

describe('replace()', () => {
  const html = '<p id="new">new html!</p>'

  const subject = () => replace('#test', html, editor)

  beforeEach(() => {
    editor.setContent('<div id="test"></div>')
  })

  it('deletes the element that should be replaced', () => {
    expect(editor.getContainer().querySelector('#test')).not.toBeNull()
    subject()
    expect(editor.getContainer().querySelector('#test')).toBeNull()
  })

  it('inserts the new html', () => {
    subject()
    expect(editor.getContainer().querySelector('#new').innerHTML).toEqual('new html!')
  })

  returnValueExamples(subject)
})

describe('insertMentionFor()', () => {
  const user = {
    id: '123',
    shortName: 'Test User',
  }

  const subject = () => insertMentionFor(user, editor)

  beforeEach(() => {
    editor.setContent('<span id="mentions-marker"></div>')
  })

  it('inserts the content into the editor with correct username', () => {
    subject()
    expect(editor.getContainer().querySelector('.mention').innerHTML).toEqual('@Test User')
  })

  it('inserts the content into the editor with correct mentions user id', () => {
    subject()
    expect(editor.getContainer().querySelector('.mention').getAttribute('data-mention')).toEqual(
      '123',
    )
  })

  it('removes the trigger char from the editor body', () => {
    subject()
    expect(editor.getContent()).not.toContain('@<')
    expect(editor.getContent().match(/@/g)).toHaveLength(1)
  })
})

describe('removeTriggerChar() — sanitization round-trip', () => {
  // The function reads parentElem.innerHTML, drops the trigger char by
  // string-slicing, then writes the result back. The surrounding content
  // is assumed already-sanitized at original insertion, but the parse->
  // serialize round-trip can re-arm an mxss bypass — sanitize on the
  // way out closes that path.
  it('strips event handler attributes that survive the round-trip', () => {
    // Build a parent element containing:
    //   - a benign sibling carrying an onerror payload (the mxss surface)
    //   - the trigger char + marker span (what the function targets)
    const parent = document.createElement('div')
    parent.innerHTML =
      `<img src="x" onerror="window.__pwned=1">` + `${TRIGGER_CHAR}<span id="${MARKER_ID}"></span>`
    document.body.appendChild(parent)
    // Sanity: the onerror is in DOM before the function runs.
    expect(parent.querySelector('img').getAttribute('onerror')).toBe('window.__pwned=1')

    const editorMock = {
      dom: {
        select: selector => Array.from(parent.querySelectorAll(selector)),
      },
    }
    removeTriggerChar(editorMock)

    const img = parent.querySelector('img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('onerror')).toBeNull()
    document.body.removeChild(parent)
  })

  it('strips inline <script> tags from the round-trip', () => {
    const parent = document.createElement('div')
    parent.innerHTML =
      `<script>window.__pwned=1</script>` + `${TRIGGER_CHAR}<span id="${MARKER_ID}"></span>`
    document.body.appendChild(parent)
    expect(parent.querySelector('script')).not.toBeNull()

    const editorMock = {
      dom: {
        select: selector => Array.from(parent.querySelectorAll(selector)),
      },
    }
    removeTriggerChar(editorMock)

    expect(parent.querySelector('script')).toBeNull()
    document.body.removeChild(parent)
  })
})

//
// Copyright (C) 2012 - present Instructure, Inc.
//
// This file is part of Canvas.
//
// Canvas is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, version 3 of the License.
//
// Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
// A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
// details.
//
// You should have received a copy of the GNU Affero General Public License along
// with this program. If not, see <http://www.gnu.org/licenses/>.

import $ from 'jquery'
import htmlEscape from '@instructure/html-escape'
import EditorToggle from '@canvas/editor-toggle'
import {send} from '@canvas/rce-command-shim'
import {extend} from '@canvas/backbone/utils'

extend(MultipleChoiceToggle, EditorToggle)
// #
// Toggles a multiple choice quiz answer between an editor and an element

// #
// @param {jQuery} @editButton - the edit button to trigger the toggle
// @param {Object} options - options for EditorToggle
// @api public
export default function MultipleChoiceToggle(
  this: any,
  editButton: JQuery,
  options: any
): MultipleChoiceToggle {
  this.editButton = editButton
  this.cacheElements()

  return EditorToggle.call(this, this.answer.find('.answer_html'), options) || this
}

interface MultipleChoiceToggle {
  editButton: JQuery
  answer: JQuery
  answerText: JQuery
  input: JQuery
  content: string
  el: JQuery
  textArea: HTMLElement
  cacheElements(): void
  display(): void
  edit(): void
  showAnswerText(): void
  showEl(): void
  toggleIfEmpty(): void
  isEmpty(): boolean
}

Object.assign(MultipleChoiceToggle.prototype, {
  // #
  // Finds all the relevant elements from the perspective of the edit button
  // that toggles the element between itself and an editor
  // @api private
  cacheElements(this: MultipleChoiceToggle): void {
    this.answer = this.editButton.parents('.answer')
    this.answerText = this.answer.find('input[name=answer_text]')
    this.answerText.hide()
    this.input = this.answer.find('input[name=answer_html]')
  },

  // #
  // Extends EditorToggle::display to @toggleIfEmpty and sets the hidden
  // input's value to the content from the editor
  // @api public
  display(this: MultipleChoiceToggle): void {
    EditorToggle.prototype.display.apply(this, arguments as any)
    this.toggleIfEmpty()
    this.input.val(this.content)
    if (this.content === '') return this.answerText.val('')
  },

  // #
  // Extends EditorToggle::edit to always hide the original input
  // in case it was shown because the editor content was empty
  // @api public
  edit(this: MultipleChoiceToggle): void {
    EditorToggle.prototype.edit.apply(this, arguments as any)
    this.answerText.hide()
    if (this.content === '') {
      return send(this.textArea, 'set_code', htmlEscape(this.answerText.val() as string))
    } else {
      return send(this.textArea, 'set_code', this.content)
    }
  },

  // #
  // Shows the original <input type=text> that the editor replaces and hides
  // the HTML display element, also sets @input value to '' so the quizzes.js
  // hooks don't think its an html answer
  // @api public
  showAnswerText(this: MultipleChoiceToggle): void {
    this.answerText.show()
    this.el.hide()
    this.input.val('')
  },

  // #
  // Shows the HTML element and hides the origina input
  // @api public
  showEl(this: MultipleChoiceToggle): void {
    this.answerText.hide()
    this.el.show()
  },

  // #
  // If the editor has no content, it will show the original input
  // @api public
  toggleIfEmpty(this: MultipleChoiceToggle): void {
    if (this.isEmpty()) {
      return this.showAnswerText()
    } else {
      return this.showEl()
    }
  },

  // #
  // Determines if the editor has any content
  // @returns {Boolean}
  // @api private
  isEmpty(this: MultipleChoiceToggle): boolean {
    return $.trim(this.content) === ''
  },
})

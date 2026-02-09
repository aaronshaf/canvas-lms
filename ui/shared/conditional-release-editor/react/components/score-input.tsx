/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import React from 'react'
import classNames from 'classnames'
import PropTypes from 'prop-types'
import shortid from '@canvas/shortid'

import {useScope as createI18nScope} from '@canvas/i18n'
import GradingTypes from '../grading-types'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import {TextInput} from '@instructure/ui-text-input'
import {Text} from '@instructure/ui-text'

import {
  scoreToPercent,
  percentToScore,
  transformScore,
  getGradingType,
  isNumeric,
} from '../score-helpers'

const I18n = createI18nScope('conditional_release')

const {string, func, object, number, bool} = PropTypes

export default class ScoreInput extends React.Component {
  static get propTypes() {
    return {
      score: number.isRequired,
      triggerAssignment: object.isRequired,
      label: string,
      error: string,
      onScoreChanged: func.isRequired,
      readOnly: bool,
    }
  }

  constructor() {
    // @ts-expect-error -- legacy untyped React component
    super()
    this.state = {
      focused: false,
      editingValue: null,
    }

    // @ts-expect-error -- legacy untyped React component
    this.shortid = shortid()

    this.focused = this.focused.bind(this)
    this.blurred = this.blurred.bind(this)
    this.changed = this.changed.bind(this)
  }

  // @ts-expect-error -- legacy untyped React component
  focused(e) {
    // Makes sure cursor appears at the end
    this.setState({focused: true})
    this.moveCursorToEnd(e.target)
  }

  // @ts-expect-error -- legacy untyped React component
  blurred(_e) {
    this.setState({focused: false})
    this.setState({editingValue: null})
  }

  // @ts-expect-error -- legacy untyped React component
  changed(e) {
    // @ts-expect-error -- legacy untyped React component
    const {onScoreChanged, triggerAssignment} = this.props
    this.setState({editingValue: e.target.value})
    onScoreChanged(scoreToPercent(e.target.value, triggerAssignment))
  }

  // @ts-expect-error -- legacy untyped React component
  moveCursorToEnd(element) {
    const strLength = element.value.length
    element.selectionStart = element.selectionEnd = strLength
  }

  value() {
    // @ts-expect-error -- legacy untyped React component
    const {focused, editingValue} = this.state
    // @ts-expect-error -- legacy untyped React component
    const {score, triggerAssignment} = this.props
    if (!focused) {
      if (score === '') {
        return ''
      }
      return transformScore(score, triggerAssignment, false)
    } else if (editingValue) {
      return editingValue
    } else {
      const currentScore = percentToScore(score, triggerAssignment)
      return isNumeric(currentScore) ? I18n.n(currentScore) : currentScore
    }
  }

  hasError() {
    // @ts-expect-error -- legacy untyped React component
    return !!this.props.error
  }

  errorMessage() {
    // @ts-expect-error -- legacy untyped React component
    const {error} = this.props
    return (
      <span data-testid="cr-score-input-error" style={{whiteSpace: 'nowrap'}}>
        {error}
      </span>
    )
  }

  errorMessageId() {
    // @ts-expect-error -- legacy untyped React component
    return 'error-' + this.shortid
  }

  render() {
    // @ts-expect-error -- legacy untyped React component
    const {label, triggerAssignment, readOnly, error} = this.props
    // @ts-expect-error -- legacy untyped React component
    const inputId = this.shortid

    const topClasses = {
      'cr-percent-input': true,
      'cr-percent-input--error': this.hasError(),
      'ic-Form-control': true,
      'ic-Form-control--has-error': this.hasError(),
    }

    const optionalProps = {}
    if (this.hasError()) {
      // @ts-expect-error -- legacy untyped React component
      optionalProps['aria-invalid'] = true
      // @ts-expect-error -- legacy untyped React component
      optionalProps['aria-describedby'] = this.errorMessageId()
    }

    let srLabel = label
    const gradingType = getGradingType(triggerAssignment)
    // @ts-expect-error -- legacy untyped grading type indexing
    const gradingTypeDef = gradingType ? GradingTypes[gradingType] : null
    if (gradingType && gradingTypeDef) {
      srLabel = I18n.t('%{label}, as %{gradingType}', {
        label,
        gradingType: gradingTypeDef.label(),
      })
    }

    const messages = this.hasError()
      ? [{text: this.errorMessage(), type: 'error' as const}]
      : undefined

    const textInput = (
      <TextInput
        className="cr-input cr-percent-input__input"
        id={inputId}
        type="text"
        value={this.value()}
        title={label}
        onChange={this.changed}
        onFocus={this.focused}
        onBlur={this.blurred}
        messages={messages}
        {...optionalProps}
      />
    )

    return (
      <div className={classNames(topClasses)}>
        <ScreenReaderContent>
          <label className="cr-percent-input__label" htmlFor={inputId}>
            {srLabel}
          </label>
        </ScreenReaderContent>
        {readOnly ? <Text size="medium">{this.value()}</Text> : textInput}
      </div>
    )
  }
}

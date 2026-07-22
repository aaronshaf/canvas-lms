/*
 * Copyright (C) 2016 - present Instructure, Inc.
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
import {useScope as createI18nScope} from '@canvas/i18n'
import PathOption from './path-option'
import type {Assignment} from '../shapes/assignment-shape'

const I18n = createI18nScope('choose_mastery_path')

export interface Option {
  setId: number
  assignments: Assignment[]
}

interface Props {
  options: Option[]
  selectedOption?: number | null
  selectOption: (setId: number) => void
}

export default class ChooseMasteryPath extends React.Component<Props> {
  renderHeader() {
    const selectedOption = this.props.selectedOption
    if (selectedOption !== null && selectedOption !== undefined) {
      return <h2>{I18n.t('Assignment Path Selected')}</h2>
    } else {
      return (
        <div>
          <h2>{I18n.t('Choose Assignment Path')}</h2>
          <p>
            <em>{I18n.t('Select one of the options:')}</em>
          </p>
        </div>
      )
    }
  }

  render() {
    return (
      <div className="cmp-wrapper">
        {this.renderHeader()}
        {this.props.options.map((path, i) => (
          <PathOption
            key={path.setId}
            optionIndex={i}
            setId={path.setId}
            assignments={path.assignments}
            selectOption={this.props.selectOption}
            selectedOption={this.props.selectedOption}
          />
        ))}
      </div>
    )
  }
}

/*
 * Copyright (C) 2014 - present Instructure, Inc.
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
import classnames from 'classnames'

const I18n = createI18nScope('course_wizard')

interface ChecklistItemProps {
  onClick: (stepKey: string) => void
  stepKey: string
  title: string
  complete: boolean
  isSelected: boolean
  id: string
}

interface ChecklistItemState {
  classNameString: string
}

class ChecklistItem extends React.Component<ChecklistItemProps, ChecklistItemState> {
  static displayName = 'ChecklistItem'

  state: ChecklistItemState = {classNameString: ''}

  classNameString = ''

  UNSAFE_componentWillMount() {
    this.setClassName(this.props)
  }

  UNSAFE_componentWillReceiveProps(nextProps: ChecklistItemProps) {
    this.setClassName(nextProps)
  }

  handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    this.props.onClick(this.props.stepKey)
  }

  setClassName = (props: ChecklistItemProps) => {
    this.setState({
      classNameString: classnames({
        'ic-wizard-box__content-trigger': true,
        'ic-wizard-box__content-trigger--checked': props.complete,
        'ic-wizard-box__content-trigger--active': props.isSelected,
      }),
    })
  }

  render() {
    const completionMessage = this.props.complete
      ? I18n.t('(Item Complete)')
      : I18n.t('(Item Incomplete)')

    return (
      <li>
        {/* TODO: use InstUI button */}
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a
          href="#"
          id={this.props.id}
          className={this.state.classNameString}
          onClick={this.handleClick}
          aria-label={`Select task: ${this.props.title}`}
        >
          <span>
            {this.props.title}
            <span className="screenreader-only">{completionMessage}</span>
          </span>
        </a>
      </li>
    )
  }
}

export default ChecklistItem

/*
 * Copyright (C) 2017 - present Instructure, Inc.
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
import {Checkbox} from '@instructure/ui-checkbox'
import {lockLabels} from '@canvas/blueprint-courses/react/labels'

type LockableAttribute =
  | 'points'
  | 'content'
  | 'due_dates'
  | 'availability_dates'
  | 'settings'
  | 'deleted'

interface ItemLocks {
  content?: boolean
  points?: boolean
  due_dates?: boolean
  availability_dates?: boolean
  [key: string]: boolean | undefined
}

interface LockCheckListProps {
  locks: ItemLocks
  lockableAttributes: LockableAttribute[]
  onChange?: (locks: ItemLocks) => void
  formName: string
}

interface LockCheckListState {
  locks: ItemLocks
}

export default class LockCheckList extends React.Component<LockCheckListProps, LockCheckListState> {
  static defaultProps = {
    onChange: () => {},
  }

  private onChangeFunctions: Record<string, (e: React.ChangeEvent<HTMLInputElement>) => void>

  constructor(props: LockCheckListProps) {
    super(props)
    this.state = {
      locks: props.locks,
    }
    this.onChangeFunctions = this.props.lockableAttributes.reduce(
      (object, item) => {
        object[item] = (e: React.ChangeEvent<HTMLInputElement>) => this.onChange(e, item)
        return object
      },
      {} as Record<string, (e: React.ChangeEvent<HTMLInputElement>) => void>,
    )
  }

  onChange = (e: React.ChangeEvent<HTMLInputElement>, value: string) => {
    const locks = {...this.state.locks}
    locks[value] = e.target.checked
    this.setState(
      {
        locks,
      },
      () => this.props.onChange?.(locks),
    )
  }

  render() {
    return (
      <div>
        {this.props.lockableAttributes.map(item => (
          <div key={item} className="bcs_check_box-group">
            <input type="hidden" name={`course${this.props.formName}[${item}]`} value="false" />
            <Checkbox
              name={`course${this.props.formName}[${item}]`}
              size="small"
              label={lockLabels[item as keyof typeof lockLabels]}
              value={(this.state.locks[item] || false).toString()}
              checked={this.state.locks[item]}
              onChange={this.onChangeFunctions[item]}
            />
          </div>
        ))}
      </div>
    )
  }
}

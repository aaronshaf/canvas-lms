/*
 * Copyright (C) 2018 - present Instructure, Inc.
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

import {omitProps, safeCloneElement} from '@instructure/ui-react-utils'
import React, {Component} from 'react'
import classNames from 'classnames'
import {View} from '@instructure/ui-view'

interface StepsProps {
  isCollapsed?: boolean
  children?: React.ReactNode
  margin?: any
}

class Steps extends Component<StepsProps> {
  static findInProgressChild(element: any) {
    return element.props.status === 'in-progress'
  }

  calculateProgressionScale = (children: any[]) => {
    const inProgressIndex = children.findIndex(Steps.findInProgressChild)
    if (inProgressIndex !== -1) {
      const successProgresssionX = inProgressIndex / (children.length - 1)
      return successProgresssionX
    } else {
      let completeIndex = 0
      for (let i = children.length - 1; i !== 0; i--) {
        if (children[i].props.status === 'complete') {
          completeIndex = i
          break
        }
      }
      return completeIndex / (children.length - 1)
    }
  }

  handlePlacement(numSteps: number, index: number): 'first' | 'last' | 'interior' {
    if (this.props.isCollapsed) {
      return 'interior'
    }

    const step = index + 1

    if (step === 1) {
      return 'first'
    } else if (step === numSteps) {
      return 'last'
    } else {
      return 'interior'
    }
  }

  render() {
    let progressionScale = 0

    let filteredChildren

    if (this.props.children) {
      filteredChildren = this.props.children.filter(prop => prop !== null)
      progressionScale = this.calculateProgressionScale(filteredChildren)
    }

    return (
      // @ts-expect-error - complex InstUI props
      <View
        {...omitProps(this.props, ['isCollapsed', 'children', 'margin'])}
        margin={this.props.margin}
        data-testid="assignment-2-step-index"
        as="div"
        className={this.props.isCollapsed ? 'steps-container-collapsed steps-main' : 'steps-main'}
      >
        <div
          data-testid={this.props.isCollapsed ? 'steps-container-collapsed' : 'steps-main'}
          className="progressionContainer"
          aria-hidden="true"
        >
          <span className="progression" />
          <span
            style={{transform: `scaleX(${progressionScale})`}}
            className="completeProgression"
          />
        </div>
        <ol className="steps">
          {React.Children.map(filteredChildren, (child: any, index) => (
            <li
              className={classNames('step', {'step-expanded': !this.props.isCollapsed})}
              aria-current={child.props.status === 'in-progress' ? 'true' : 'false'}
            >
              {safeCloneElement(child, {
                pinSize: '32px',
                placement: this.handlePlacement(filteredChildren.length, index),
              })}
            </li>
          ))}
        </ol>
      </View>
    )
  }
}

export default Steps

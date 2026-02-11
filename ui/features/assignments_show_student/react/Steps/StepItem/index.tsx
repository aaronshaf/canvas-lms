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

import classNames from 'classnames'
import {useScope as createI18nScope} from '@canvas/i18n'
import React, {Component} from 'react'

import {IconCheckMarkSolid, IconLockSolid} from '@instructure/ui-icons'
import {omitProps} from '@instructure/ui-react-utils'
import {px} from '@instructure/ui-utils'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'

const I18n = createI18nScope('assignments_2_shared_Steps')

type StepStatus = 'button' | 'complete' | 'incomplete' | 'in-progress' | 'unavailable'
type StepPlacement = 'first' | 'last' | 'interior'

interface StepItemProps {
  status?: StepStatus
  label: string
  icon?: React.ReactElement | (() => React.ReactElement)
  pinSize?: string
  placement?: StepPlacement
}

export const stepLabels = {
  get available() {
    return I18n.t('Available')
  },
  get graded() {
    return I18n.t('Graded')
  },
  get notGradedYet() {
    return I18n.t('Not Graded Yet')
  },
  get submit() {
    return I18n.t('Submit')
  },
  get submitted() {
    return I18n.t('Submitted')
  },
  get unavailable() {
    return I18n.t('Unavailable')
  },
  get upload() {
    return I18n.t('Upload')
  },
  get uploaded() {
    return I18n.t('Uploaded')
  },
}

class StepItem extends Component<StepItemProps> {
  static defaultProps = {
    placement: 'interior' as StepPlacement,
  }

  getStatusI18n() {
    switch (this.props.status) {
      case 'button':
        return I18n.t('button')
      case 'complete':
        return I18n.t('complete')
      case 'incomplete':
        return I18n.t('incomplete')
      case 'in-progress':
        return I18n.t('in-progress')
      case 'unavailable':
        return I18n.t('unavailable')
    }
  }

  selectIcon(Icon: StepItemProps['icon'], status?: StepStatus) {
    if (!Icon && status === 'complete') {
      return <IconCheckMarkSolid color="primary-inverse" />
    } else if (!Icon && status === 'unavailable') {
      return <IconLockSolid color="error" style={{display: 'flex'}} />
    } else if (typeof Icon === 'function') {
      return <Icon />
    } else if (Icon) {
      return Icon
    } else {
      return null
    }
  }

  pinSize = (): number => {
    // @ts-expect-error - pinSize can be undefined but px handles it
    switch (this.props.status) {
      case 'complete':
        // @ts-expect-error
        return Math.round(px(this.props.pinSize) / 1.5)
      case 'unavailable':
        // @ts-expect-error
        return Math.round(px(this.props.pinSize) / 1.2)
      case 'button':
        // @ts-expect-error
        return Math.round(px(this.props.pinSize) / 1.05)
      case 'in-progress':
        // @ts-expect-error
        return px(this.props.pinSize)
      default:
        // @ts-expect-error
        return Math.round(px(this.props.pinSize) / 2.25)
    }
  }

  render() {
    const classes = {
      'step-item-step': true,
      [this.props.status || '']: true,
      [`placement--${this.props.placement}`]: true,
    }

    return (
      <span
        className={classNames(classes)}
        data-testid="step-item-step"
        {...omitProps(this.props, ['status', 'label', 'icon', 'pinSize', 'placement'])}
      >
        <span
          className="pinLayout"
          style={{
            height: px(this.props.pinSize),
          }}
        >
          <span
            style={{
              width: `${this.pinSize()}px`,
              height: `${this.pinSize()}px`,
            }}
            className="step-item-pin"
          >
            <span aria-hidden={true}>{this.selectIcon(this.props.icon, this.props.status)}</span>
          </span>
        </span>
        <span className="step-item-label" aria-hidden={true}>
          {this.props.label}
        </span>
        <ScreenReaderContent>{`${this.props.label} ${this.getStatusI18n()}`}</ScreenReaderContent>
      </span>
    )
  }
}

export default StepItem

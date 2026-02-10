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
import PropTypes from 'prop-types'
import {each, filter, map, isEmpty} from 'es-toolkit/compat'
import $ from 'jquery'
import {Button} from '@instructure/ui-buttons'
import {Checkbox} from '@instructure/ui-checkbox'
import {useScope as createI18nScope} from '@canvas/i18n'
import EnrollmentTermInput from './EnrollmentTermInput'
import '@canvas/rails-flash-notifications'

const I18n = createI18nScope('GradingPeriodSetForm')

interface EnrollmentTerm {
  id: string
  displayName: string
  gradingPeriodGroupId?: string | null
  startAt?: Date | null
  endAt?: Date | null
}

interface GradingPeriodSet {
  id?: string | null
  title: string
  weighted: boolean
  displayTotalsForAllGradingPeriods: boolean
  enrollmentTermIDs: string[]
}

const {array, bool, func, shape, string} = PropTypes

const buildSet = function (attr: Partial<GradingPeriodSet> = {}): GradingPeriodSet {
  return {
    id: attr.id,
    title: attr.title || '',
    weighted: !!attr.weighted,
    displayTotalsForAllGradingPeriods: !!attr.displayTotalsForAllGradingPeriods,
    enrollmentTermIDs: attr.enrollmentTermIDs || [],
  }
}

const validateSet = function (set: GradingPeriodSet): string[] {
  if (!(set.title || '').trim()) {
    return [I18n.t('All grading period sets must have a title')]
  }
  return []
}

function replaceSetAttr(set: GradingPeriodSet, key: keyof GradingPeriodSet, val: unknown) {
  return {set: {...set, [key]: val} as GradingPeriodSet}
}

interface GradingPeriodSetFormProps {
  set: {
    id?: string | null
    title?: string
    displayTotalsForAllGradingPeriods?: boolean
    weighted?: boolean
    enrollmentTermIDs?: string[]
  }
  enrollmentTerms: EnrollmentTerm[]
  disabled?: boolean
  onSave: (set: GradingPeriodSet) => void
  onCancel: () => void
}

interface GradingPeriodSetFormState {
  set: GradingPeriodSet
}

class GradingPeriodSetForm extends React.Component<
  GradingPeriodSetFormProps,
  GradingPeriodSetFormState
> {
  static propTypes = {
    set: shape({
      id: string,
      title: string,
      displayTotalsForAllGradingPeriods: bool,
      weighted: bool,
      enrollmentTermIDs: array,
    }).isRequired,
    enrollmentTerms: array.isRequired,
    disabled: bool,
    onSave: func.isRequired,
    onCancel: func.isRequired,
  }

  private titleRef: React.RefObject<HTMLInputElement>
  private cancelButtonRef: React.RefObject<any>
  private saveButtonRef: React.RefObject<any>
  private weightedCheckbox?: any
  private displayTotalsCheckbox?: any

  constructor(props: GradingPeriodSetFormProps) {
    super(props)
    const associatedEnrollmentTerms = filter(props.enrollmentTerms, {
      gradingPeriodGroupId: props.set.id,
    })
    const set = {
      ...props.set,
      enrollmentTermIDs: map(associatedEnrollmentTerms, 'id'),
    }

    this.state = {set: buildSet(set as Partial<GradingPeriodSet>)}
    this.titleRef = React.createRef()
    this.cancelButtonRef = React.createRef()
    this.saveButtonRef = React.createRef()
  }

  componentDidMount() {
    this.titleRef.current?.focus()
  }

  changeTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState(replaceSetAttr(this.state.set, 'title', e.target.value))
  }

  changeWeighted = (e: any) => {
    this.setState(replaceSetAttr(this.state.set, 'weighted', e.target.checked))
  }

  changeDisplayTotals = (e: any) => {
    this.setState(
      replaceSetAttr(this.state.set, 'displayTotalsForAllGradingPeriods', e.target.checked),
    )
  }

  changeEnrollmentTermIDs = (termIDs: string[]) => {
    const set = {...this.state.set, enrollmentTermIDs: termIDs}
    this.setState({set})
  }

  triggerSave = (e: any) => {
    e.preventDefault()
    if (this.props.onSave) {
      const validations = validateSet(this.state.set)
      if (isEmpty(validations)) {
        this.props.onSave(this.state.set)
      } else {
        each(validations, message => {
          $.flashError(message)
        })
      }
    }
  }

  triggerCancel = (e: any) => {
    e.preventDefault()
    if (this.props.onCancel) {
      this.setState({set: buildSet()}, this.props.onCancel)
    }
  }

  renderSaveAndCancelButtons = () => (
    <div className="ic-Form-actions below-line">
      <Button
        ref={this.cancelButtonRef}
        disabled={this.props.disabled}
        onClick={this.triggerCancel}
      >
        {I18n.t('Cancel')}
      </Button>
      &nbsp;
      <Button
        ref={this.saveButtonRef}
        disabled={this.props.disabled}
        color="primary"
        onClick={this.triggerSave}
        margin="0 0 0 x-small"
        aria-label={I18n.t('Save Grading Period Set')}
      >
        {I18n.t('Save')}
      </Button>
    </div>
  )

  render() {
    return (
      <div className="GradingPeriodSetForm pad-box">
        <form className="ic-Form-group ic-Form-group--horizontal">
          <div className="grid-row">
            <div className="col-xs-12 col-lg-6">
              <div className="ic-Form-control">
                <label className="ic-Label" htmlFor="set-name">
                  {I18n.t('Set name')}
                </label>
                <input
                  id="set-name"
                  ref={this.titleRef}
                  type="text"
                  value={this.state.set.title}
                  onChange={this.changeTitle}
                  className="ic-Input"
                  placeholder={I18n.t('Set name...')}
                />
              </div>

              <EnrollmentTermInput
                enrollmentTerms={this.props.enrollmentTerms}
                selectedIDs={this.state.set.enrollmentTermIDs}
                setSelectedEnrollmentTermIDs={this.changeEnrollmentTermIDs}
              />

              <div className="ic-Input pad-box top-only">
                <Checkbox
                  ref={ref => {
                    this.weightedCheckbox = ref
                  }}
                  label={I18n.t('Weighted grading periods')}
                  value="weighted"
                  checked={this.state.set.weighted}
                  onChange={this.changeWeighted}
                />
              </div>
              <div className="ic-Input pad-box top-only">
                <Checkbox
                  ref={ref => {
                    this.displayTotalsCheckbox = ref
                  }}
                  label={I18n.t('Display totals for All Grading Periods option')}
                  value="totals"
                  checked={this.state.set.displayTotalsForAllGradingPeriods}
                  onChange={this.changeDisplayTotals}
                />
              </div>
            </div>
          </div>

          <div className="grid-row">
            <div className="col-xs-12 col-lg-12">{this.renderSaveAndCancelButtons()}</div>
          </div>
        </form>
      </div>
    )
  }
}

export default GradingPeriodSetForm

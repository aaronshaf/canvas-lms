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

import React, {Component} from 'react'
import {connect} from 'react-redux'
import {arrayOf, func, shape, string} from 'prop-types'
import {useScope as createI18nScope} from '@canvas/i18n'
import * as tz from '@instructure/moment-utils'
import moment from 'moment'
import {debounce} from 'es-toolkit/compat'
import {Checkbox} from '@instructure/ui-checkbox'
import CanvasAsyncSelect from '@canvas/instui-bindings/react/AsyncSelect'
import {Button} from '@instructure/ui-buttons'
import {Grid} from '@instructure/ui-grid'
import {View} from '@instructure/ui-view'
import {FormFieldGroup} from '@instructure/ui-form-field'
import {ScreenReaderContent} from '@instructure/ui-a11y-content'
import SearchFormActions from './actions/SearchFormActions'
import {showFlashAlert} from '@canvas/alerts/react/FlashAlert'
import environment from './environment'
import CanvasDateInput2 from '@canvas/datetime/react/components/DateInput2'

const I18n = createI18nScope('gradebook_history')

const DEBOUNCE_DELAY = 500 // milliseconds

const recordShape = shape({
  fetchStatus: string.isRequired,
  items: arrayOf(
    shape({
      id: string.isRequired,
      name: string.isRequired,
    }),
  ),
  nextPage: string.isRequired,
})

// @ts-expect-error -- TS migration
const formatDate = date => tz.format(date, 'date.formats.medium_with_weekday')

class SearchFormComponent extends Component {
  static propTypes = {
    fetchHistoryStatus: string.isRequired,
    assignments: recordShape.isRequired,
    graders: recordShape.isRequired,
    students: recordShape.isRequired,
    getGradebookHistory: func.isRequired,
    clearSearchOptions: func.isRequired,
    getSearchOptions: func.isRequired,
    getSearchOptionsNextPage: func.isRequired,
  }

  // @ts-expect-error -- TS migration
  constructor(props) {
    super(props)
    this.state = {
      selected: {
        assignment: '',
        grader: '',
        student: '',
        from: {value: ''},
        to: {value: ''},
        showFinalGradeOverridesOnly: false,
      },
      messages: {
        assignments: I18n.t('Type a few letters to start searching'),
        graders: I18n.t('Type a few letters to start searching'),
        students: I18n.t('Type a few letters to start searching'),
      },
    }
    // @ts-expect-error -- TS migration
    this.debouncedGetSearchOptions = debounce(props.getSearchOptions, DEBOUNCE_DELAY)
  }

  componentDidMount() {
    // @ts-expect-error -- TS migration
    this.props.getGradebookHistory(this.state.selected)
  }

  // @ts-expect-error -- TS migration
  UNSAFE_componentWillReceiveProps({fetchHistoryStatus, assignments, graders, students}) {
    // @ts-expect-error -- TS migration
    if (this.props.fetchHistoryStatus === 'started' && fetchHistoryStatus === 'failure') {
      showFlashAlert({message: I18n.t('Error loading gradebook history. Try again?')})
    }

    if (assignments.fetchStatus === 'success' && assignments.items.length === 0) {
      this.setState(prevState => ({
        messages: {
          // @ts-expect-error -- TS migration
          ...prevState.messages,
          assignments: I18n.t('No artifacts with that name found'),
        },
      }))
    }
    if (graders.fetchStatus === 'success' && !graders.items.length) {
      this.setState(prevState => ({
        messages: {
          // @ts-expect-error -- TS migration
          ...prevState.messages,
          graders: I18n.t('No graders with that name found'),
        },
      }))
    }
    if (students.fetchStatus === 'success' && !students.items.length) {
      this.setState(prevState => ({
        messages: {
          // @ts-expect-error -- TS migration
          ...prevState.messages,
          students: I18n.t('No students with that name found'),
        },
      }))
    }
    if (assignments.nextPage) {
      // @ts-expect-error -- TS migration
      this.props.getSearchOptionsNextPage('assignments', assignments.nextPage)
    }
    if (graders.nextPage) {
      // @ts-expect-error -- TS migration
      this.props.getSearchOptionsNextPage('graders', graders.nextPage)
    }
    if (students.nextPage) {
      // @ts-expect-error -- TS migration
      this.props.getSearchOptionsNextPage('students', students.nextPage)
    }
  }

  // @ts-expect-error -- TS migration
  setSelectedFrom = from => {
    const value = from == null ? null : moment(from).startOf('day').toISOString()

    this.setState(prevState => ({
      selected: {
        // @ts-expect-error -- TS migration
        ...prevState.selected,
        from: {value},
      },
    }))
  }

  // @ts-expect-error -- TS migration
  setSelectedTo = to => {
    const value = to == null ? null : moment(to).endOf('day').toISOString()

    this.setState(prevState => ({
      selected: {
        // @ts-expect-error -- TS migration
        ...prevState.selected,
        to: {value},
      },
    }))
  }

  // @ts-expect-error -- TS migration
  setSelectedAssignment = (_event, selectedOption) => {
    // @ts-expect-error -- TS migration
    const selname = this.props.assignments.items.find(e => e.id === selectedOption)?.name
    // @ts-expect-error -- TS migration
    if (selname) this.props.getSearchOptions('assignments', selname)
    this.setState(prevState => {
      const selected = {
        // @ts-expect-error -- TS migration
        ...prevState.selected,
        assignment: selectedOption || '',
      }

      // If we selected an assignment, uncheck the "show final grade overrides
      // only" checkbox
      if (selectedOption) {
        selected.showFinalGradeOverridesOnly = false
      }

      return {selected}
    })
  }

  // @ts-expect-error -- TS migration
  setSelectedGrader = (_event, selected) => {
    // @ts-expect-error -- TS migration
    const selname = this.props.graders.items.find(e => e.id === selected)?.name
    // @ts-expect-error -- TS migration
    if (selname) this.props.getSearchOptions('graders', selname)
    this.setState(prevState => ({
      selected: {
        // @ts-expect-error -- TS migration
        ...prevState.selected,
        grader: selected || '',
      },
    }))
  }

  // @ts-expect-error -- TS migration
  setSelectedStudent = (_event, selected) => {
    // @ts-expect-error -- TS migration
    const selname = this.props.students.items.find(e => e.id === selected)?.name
    // @ts-expect-error -- TS migration
    if (selname) this.props.getSearchOptions('students', selname)
    this.setState(prevState => ({
      selected: {
        // @ts-expect-error -- TS migration
        ...prevState.selected,
        student: selected || '',
      },
    }))
  }

  hasToBeforeFrom() {
    return (
      // @ts-expect-error -- TS migration
      moment(this.state.selected.from.value).diff(
        // @ts-expect-error -- TS migration
        moment(this.state.selected.to.value),
        'seconds',
      ) >= 0
    )
  }

  hasDateInputErrors() {
    return this.dateInputErrors().length > 0
  }

  dateInputErrors = () => {
    if (this.hasToBeforeFrom()) {
      return [
        {
          type: 'error',
          text: I18n.t("'From' date must be before 'To' date"),
        },
      ]
    }

    return []
  }

  promptUserEntry = () => {
    const emptyMessage = I18n.t('Type a few letters to start searching')
    this.setState({
      messages: {
        assignments: emptyMessage,
        graders: emptyMessage,
        students: emptyMessage,
      },
    })
  }

  // @ts-expect-error -- TS migration
  handleAssignmentChange = (_event, value) => {
    this.handleSearchEntry('assignments', value)
  }

  // @ts-expect-error -- TS migration
  handleGraderChange = (_event, value) => {
    this.handleSearchEntry('graders', value)
  }

  // @ts-expect-error -- TS migration
  handleStudentChange = (_event, value) => {
    this.handleSearchEntry('students', value)
  }

  // @ts-expect-error -- TS migration
  handleShowFinalGradeOverridesOnlyChange = _event => {
    // @ts-expect-error -- TS migration
    const enabled = !this.state.selected.showFinalGradeOverridesOnly

    if (enabled) {
      // If we checked the checkbox, clear any assignments we were filtering by
      // @ts-expect-error -- TS migration
      this.props.clearSearchOptions('assignments')
    }

    this.setState(prevState => ({
      selected: {
        // @ts-expect-error -- TS migration
        ...prevState.selected,
        // @ts-expect-error -- TS migration
        assignment: enabled ? '' : prevState.selected.assignment,
        showFinalGradeOverridesOnly: enabled,
      },
    }))
  }

  // @ts-expect-error -- TS migration
  handleSearchEntry = (target, searchTerm) => {
    if (searchTerm.length <= 2) {
      // @ts-expect-error -- TS migration
      if (this.props[target].items.length > 0) {
        // @ts-expect-error -- TS migration
        this.props.clearSearchOptions(target)
        this.promptUserEntry()
      }

      return
    }

    // @ts-expect-error -- TS migration
    this.debouncedGetSearchOptions(target, searchTerm)
  }

  handleSubmit = () => {
    // @ts-expect-error -- TS migration
    this.props.getGradebookHistory(this.state.selected)
  }

  // @ts-expect-error -- TS migration
  renderAsOptions = data =>
    // @ts-expect-error -- TS migration
    data.map(i => (
      <CanvasAsyncSelect.Option key={i.id} id={i.id}>
        {i.name}
      </CanvasAsyncSelect.Option>
    ))

  render() {
    return (
      <View as="div" margin="0 0 xx-large">
        <Grid>
          <Grid.Row>
            <Grid.Col>
              <View as="div">
                <FormFieldGroup
                  description={<ScreenReaderContent>{I18n.t('Search Form')}</ScreenReaderContent>}
                  as="div"
                  layout="columns"
                  colSpacing="small"
                  vAlign="top"
                  startAt="large"
                >
                  <FormFieldGroup
                    description={<ScreenReaderContent>{I18n.t('Users')}</ScreenReaderContent>}
                    as="div"
                    layout="columns"
                    vAlign="top"
                    startAt="medium"
                  >
                    <CanvasAsyncSelect
                      id="students"
                      renderLabel={I18n.t('Student')}
                      // @ts-expect-error -- TS migration
                      isLoading={this.props.students.fetchStatus === 'started'}
                      // @ts-expect-error -- TS migration
                      selectedOptionId={this.state.selected.student}
                      // @ts-expect-error -- TS migration
                      noOptionsLabel={this.state.messages.students}
                      onBlur={this.promptUserEntry}
                      onOptionSelected={this.setSelectedStudent}
                      onInputChange={this.handleStudentChange}
                    >
                      {
                        // @ts-expect-error -- TS migration
                        this.renderAsOptions(this.props.students.items)
                      }
                    </CanvasAsyncSelect>
                    <CanvasAsyncSelect
                      id="graders"
                      renderLabel={I18n.t('Grader')}
                      // @ts-expect-error -- TS migration
                      isLoading={this.props.graders.fetchStatus === 'started'}
                      // @ts-expect-error -- TS migration
                      selectedOptionId={this.state.selected.grader}
                      // @ts-expect-error -- TS migration
                      noOptionsLabel={this.state.messages.graders}
                      onBlur={this.promptUserEntry}
                      onOptionSelected={this.setSelectedGrader}
                      onInputChange={this.handleGraderChange}
                    >
                      {
                        // @ts-expect-error -- TS migration
                        this.renderAsOptions(this.props.graders.items)
                      }
                    </CanvasAsyncSelect>
                    <CanvasAsyncSelect
                      id="assignments"
                      renderLabel={I18n.t('Artifact')}
                      // @ts-expect-error -- TS migration
                      isLoading={this.props.assignments.fetchStatus === 'started'}
                      // @ts-expect-error -- TS migration
                      selectedOptionId={this.state.selected.assignment}
                      // @ts-expect-error -- TS migration
                      noOptionsLabel={this.state.messages.assignments}
                      onBlur={this.promptUserEntry}
                      onOptionSelected={this.setSelectedAssignment}
                      onInputChange={this.handleAssignmentChange}
                    >
                      {
                        // @ts-expect-error -- TS migration
                        this.renderAsOptions(this.props.assignments.items)
                      }
                    </CanvasAsyncSelect>
                  </FormFieldGroup>

                  <FormFieldGroup
                    description={<ScreenReaderContent>{I18n.t('Dates')}</ScreenReaderContent>}
                    layout="columns"
                    startAt="small"
                    vAlign="top"
                    // @ts-expect-error -- TS migration
                    messages={this.dateInputErrors()}
                    width="auto"
                  >
                    <CanvasDateInput2
                      renderLabel={I18n.t('Start Date')}
                      // @ts-expect-error -- TS migration
                      formatDate={formatDate}
                      disabledDates={isoDate =>
                        // @ts-expect-error -- TS migration
                        this.state.selected.to.value
                          ? // @ts-expect-error -- TS migration
                            isoDate >= this.state.selected.to.value
                          : false
                      }
                      // @ts-expect-error -- TS migration
                      selectedDate={this.state.selected.from.value}
                      onSelectedDateChange={this.setSelectedFrom}
                      withRunningValue={true}
                    />
                    <CanvasDateInput2
                      renderLabel={I18n.t('End Date')}
                      // @ts-expect-error -- TS migration
                      formatDate={formatDate}
                      disabledDates={isoDate =>
                        // @ts-expect-error -- TS migration
                        this.state.selected.from.value
                          ? // @ts-expect-error -- TS migration
                            isoDate <= this.state.selected.from.value
                          : false
                      }
                      // @ts-expect-error -- TS migration
                      selectedDate={this.state.selected.to.value}
                      onSelectedDateChange={this.setSelectedTo}
                      withRunningValue={true}
                    />
                  </FormFieldGroup>
                </FormFieldGroup>
              </View>

              {environment.overrideGradesEnabled() && (
                <View
                  as="div"
                  margin="medium 0"
                  data-testid="show-final-grade-overrides-only-checkbox"
                >
                  <Checkbox
                    // @ts-expect-error -- TS migration
                    checked={this.state.selected.showFinalGradeOverridesOnly}
                    id="show_final_grade_overrides_only"
                    label={I18n.t('Show Final Grade Overrides Only')}
                    onChange={this.handleShowFinalGradeOverridesOnlyChange}
                  />
                </View>
              )}
            </Grid.Col>

            <Grid.Col width="auto">
              <div style={{margin: '1.9rem 0 0 0'}}>
                <Button
                  onClick={this.handleSubmit}
                  type="submit"
                  color="primary"
                  disabled={this.hasDateInputErrors()}
                >
                  {I18n.t('Filter')}
                </Button>
              </div>
            </Grid.Col>
          </Grid.Row>
        </Grid>
      </View>
    )
  }
}

// @ts-expect-error -- TS migration
const mapStateToProps = state => ({
  fetchHistoryStatus: state.history.fetchHistoryStatus || '',
  assignments: {
    fetchStatus: state.searchForm.records.assignments.fetchStatus || '',
    items: state.searchForm.records.assignments.items || [],
    nextPage: state.searchForm.records.assignments.nextPage || '',
  },
  graders: {
    fetchStatus: state.searchForm.records.graders.fetchStatus || '',
    items: state.searchForm.records.graders.items || [],
    nextPage: state.searchForm.records.graders.nextPage || '',
  },
  students: {
    fetchStatus: state.searchForm.records.students.fetchStatus || '',
    items: state.searchForm.records.students.items || [],
    nextPage: state.searchForm.records.students.nextPage || '',
  },
})

// @ts-expect-error -- TS migration
const mapDispatchToProps = dispatch => ({
  // @ts-expect-error -- TS migration
  getGradebookHistory: input => {
    dispatch(SearchFormActions.getGradebookHistory(input))
  },
  // @ts-expect-error -- TS migration
  getSearchOptions: (recordType, searchTerm) => {
    dispatch(SearchFormActions.getSearchOptions(recordType, searchTerm))
  },
  // @ts-expect-error -- TS migration
  getSearchOptionsNextPage: (recordType, url) => {
    dispatch(SearchFormActions.getSearchOptionsNextPage(recordType, url))
  },
  // @ts-expect-error -- TS migration
  clearSearchOptions: recordType => {
    dispatch(SearchFormActions.clearSearchOptions(recordType))
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(SearchFormComponent)

export {SearchFormComponent}

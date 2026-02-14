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

import {useScope as createI18nScope} from '@canvas/i18n'
import $ from 'jquery'
import React from 'react'
import {findDOMNode} from 'react-dom'
import PropTypes from 'prop-types'
import {Text} from '@instructure/ui-text'
import {Table} from '@instructure/ui-table'
import {ScreenReaderContent, PresentationContent} from '@instructure/ui-a11y-content'
import {Checkbox} from '@instructure/ui-checkbox'
import {Pill} from '@instructure/ui-pill'
import {Flex} from '@instructure/ui-flex'
import '@canvas/rails-flash-notifications'

import propTypes from '@canvas/blueprint-courses/react/propTypes'

const I18n = createI18nScope('blueprint_settingsCoursePickerTable')

const {arrayOf, string} = PropTypes

export default class CoursePickerTable extends React.Component {
  static propTypes = {
    courses: propTypes.courseList.isRequired,
    selectedCourses: arrayOf(string).isRequired,
    onSelectedChanged: PropTypes.func,
  }

  static defaultProps = {
    onSelectedChanged: () => {},
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  constructor(props) {
    super(props)
    this.state = {
      selected: this.parseSelectedCourses(props.selectedCourses),
      selectedAll: false,
    }
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.tableRef = React.createRef()
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.tableBody = React.createRef()
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    this.selectAllCheckbox = React.createRef()
  }

  componentDidMount() {
    this.fixIcons()
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState({
      selected: this.parseSelectedCourses(nextProps.selectedCourses),
      selectedAll: nextProps.selectedCourses.length === nextProps.courses.length,
    })
  }

  componentDidUpdate() {
    this.fixIcons()
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onSelectToggle = e => {
    // @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
    const index = this.props.courses.findIndex(c => c.id === e.target.value)
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const course = this.props.courses[index]
    const srMsg = e.target.checked
      ? I18n.t('Selected course %{course}', {course: course.name})
      : I18n.t('Unselected course %{course}', {course: course.name})
    $.screenReaderFlashMessage(srMsg)

    this.updateSelected({[e.target.value]: e.target.checked}, false)

    setTimeout(() => {
      this.handleFocusLoss(index)
    }, 0)
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  onSelectAllToggle = e => {
    $.screenReaderFlashMessage(
      e.target.checked ? I18n.t('Selected all courses') : I18n.t('Unselected all courses'),
    )

    // @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
    const selected = this.props.courses.reduce((selectedMap, course) => {
      selectedMap[course.id] = e.target.checked
      return selectedMap
    }, {})
    this.updateSelected(selected, e.target.checked)
  }

  // in IE, instui icons are in the tab order and get focus, even if hidden
  // this fixes them up so that doesn't happen.
  // Eventually this should get folded into instui via INSTUI-572
  fixIcons() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.tableRef.current) {
      Array.prototype.forEach.call(
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        this.tableRef.current.querySelectorAll('svg[aria-hidden]'),
        el => {
          el.setAttribute('focusable', 'false')
        },
      )
    }
  }

  parseSelectedCourses(courses = []) {
    return courses.reduce((selected, courseId) => {
      // @ts-expect-error TS2322 -- TypeScriptify (no 'any')
      selected[courseId] = true
      return selected
    }, {})
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  updateSelected(selectedDiff, selectedAll) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const oldSelected = this.state.selected
    // @ts-expect-error TS7034 -- TypeScriptify (no 'any')
    const added = []
    // @ts-expect-error TS7034 -- TypeScriptify (no 'any')
    const removed = []

    // @ts-expect-error TS2339,TS7031 -- TypeScriptify (no 'any')
    this.props.courses.forEach(({id}) => {
      if (oldSelected[id] === true && selectedDiff[id] === false) removed.push(id)
      if (oldSelected[id] !== true && selectedDiff[id] === true) added.push(id)
    })

    // @ts-expect-error TS2339,TS7005 -- TypeScriptify (no 'any')
    this.props.onSelectedChanged({added, removed})
    this.setState({selectedAll})
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  handleFocusLoss(index) {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.props.courses.length === 0) {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      this.selectAllCheckbox.current.focus()
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    } else if (index >= this.props.courses.length) {
      this.handleFocusLoss(index - 1)
    } else {
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      const elt = findDOMNode(this.tableBody.current)
      // @ts-expect-error TS18047 -- TypeScriptify (no 'any')
      elt
        // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
        .querySelectorAll('[data-testid="bca-table__course-row"] input[type="checkbox"]')
        [index].focus()
    }
  }

  renderHeaders() {
    return (
      <Table.Row>
        <Table.ColHeader id="picker-course-selection" width="3%">
          <ScreenReaderContent>{I18n.t('Course Selection')}</ScreenReaderContent>
        </Table.ColHeader>
        <Table.ColHeader id="picker-title" width="32%">
          {I18n.t('Title')}
        </Table.ColHeader>
        <Table.ColHeader id="picker-name" width="15%">
          {I18n.t('Short Name')}
        </Table.ColHeader>
        <Table.ColHeader id="picker-term" width="15%">
          {I18n.t('Term')}
        </Table.ColHeader>
        <Table.ColHeader id="picker-sisid" width="10%">
          {I18n.t('SIS ID')}
        </Table.ColHeader>
        <Table.ColHeader id="picker-teachers" width="25%">
          {I18n.t('Teacher(s)')}
        </Table.ColHeader>
      </Table.Row>
    )
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  renderCellText(text) {
    return (
      <Text color="secondary" size="small">
        {text}
      </Text>
    )
  }

  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
  renderStatusPill(course) {
    if (course.concluded) {
      return <Pill color="info">{I18n.t('Concluded')}</Pill>
    }
    return null
  }

  renderRows() {
    const shouldRenderStatusPill = !!window.ENV.FEATURES.ux_list_concluded_courses_in_bp

    // @ts-expect-error TS2339,TS7006 -- TypeScriptify (no 'any')
    return this.props.courses.map(course => (
      <Table.Row id={`course_${course.id}`} key={course.id} data-testid="bca-table__course-row">
        <Table.Cell>
          <Checkbox
            onChange={this.onSelectToggle}
            value={course.id}
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            checked={this.state.selected[course.id] === true}
            label={
              <ScreenReaderContent>
                {I18n.t('Toggle select course %{name}', {
                  name: course.original_name || course.name,
                })}
              </ScreenReaderContent>
            }
          />
        </Table.Cell>
        <Table.Cell>
          <Flex direction="column" gap="x-small">
            <Flex.Item>{this.renderCellText(course.original_name || course.name)}</Flex.Item>
            {shouldRenderStatusPill && <Flex.Item>{this.renderStatusPill(course)}</Flex.Item>}
          </Flex>
        </Table.Cell>
        <Table.Cell>{this.renderCellText(course.course_code)}</Table.Cell>
        <Table.Cell>{this.renderCellText(course.term.name)}</Table.Cell>
        <Table.Cell>{this.renderCellText(course.sis_course_id)}</Table.Cell>
        <Table.Cell>
          {this.renderCellText(
            course.teachers
              ? course.teachers
                  // @ts-expect-error TS7006 -- TypeScriptify (no 'any')
                  .map(teacher => teacher.display_name)
                  .join(', ')
              : I18n.t('%{teacher_count} teachers', {teacher_count: course.teacher_count}),
          )}
        </Table.Cell>
      </Table.Row>
    ))
  }

  renderBodyContent() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    if (this.props.courses.length > 0) {
      return this.renderRows()
    }

    return (
      <Table.Row key="no-results" data-testid="bca-table__no-results">
        <Table.Cell>{this.renderCellText(I18n.t('No results'))}</Table.Cell>
      </Table.Row>
    )
  }

  renderStickyHeaders() {
    // in order to create a sticky table header, we'll create a separate table with
    // just the visual sticky headers, that will be hidden from screen readers
    return (
      <div className="btps-table__header-wrapper">
        <PresentationContent as="div">
          <Table caption={I18n.t('Blueprint Courses')}>
            <Table.Head>{this.renderHeaders()}</Table.Head>
            <Table.Body />
          </Table>
        </PresentationContent>
        <div className="bca-table__select-all">
          <Checkbox
            onChange={this.onSelectAllToggle}
            value="all"
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            checked={this.state.selectedAll}
            // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
            ref={this.selectAllCheckbox}
            label={
              <Text size="small">
                {I18n.t(
                  {one: 'Select (%{count}) Course', other: 'Select All (%{count}) Courses'},
                  // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
                  {count: this.props.courses.length},
                )}
              </Text>
            }
          />
        </div>
      </div>
    )
  }

  render() {
    // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
    const tableBodyRef = this.tableBody

    return (
      // @ts-expect-error TS2339 -- TypeScriptify (no 'any')
      <div className="bca-table__wrapper" ref={this.tableRef}>
        {this.renderStickyHeaders()}
        <div className="bca-table__content-wrapper">
          <Table caption={I18n.t('Blueprint Courses')}>
            <Table.Body ref={tableBodyRef}>{this.renderBodyContent()}</Table.Body>
          </Table>
        </div>
      </div>
    )
  }
}

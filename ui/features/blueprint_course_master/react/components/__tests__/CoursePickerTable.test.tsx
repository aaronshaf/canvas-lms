/*
 * Copyright (C) 2024 - present Instructure, Inc.
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
import {render} from '@testing-library/react'
import CoursePickerTable from '../CoursePickerTable'
import getSampleData from './getSampleData'
import userEvent from '@testing-library/user-event'

describe('CoursePickerTable component', () => {
  const defaultProps = (): {
    courses: any[]
    selectedCourses: string[]
    onSelectedChanged: (changes: any) => void
  } => ({
    courses: getSampleData().courses,
    selectedCourses: [],
    onSelectedChanged: () => {},
  })

  test('renders the CoursePickerTable component', () => {
    const {container} = render(<CoursePickerTable {...defaultProps()} />)
    const node = container.querySelector('.bca-table__wrapper')
    expect(node).toBeTruthy()
  })

  test('show no results if no courses passed in', () => {
    const props = defaultProps()
    props.courses = []
    const {getByTestId} = render(<CoursePickerTable {...props} />)
    const node = getByTestId('bca-table__no-results')
    expect(node).toBeTruthy()
  })

  test('displays correct table data', () => {
    const props = defaultProps()
    const {container} = render(<CoursePickerTable {...props} />)
    const rows = container.querySelectorAll('tr[data-testid="bca-table__course-row"]')

    expect(rows).toHaveLength(props.courses.length)
    expect(rows[0].querySelectorAll('td')[0].textContent).toEqual(
      `Toggle select course ${props.courses[0].name}`,
    )
    expect(rows[1].querySelectorAll('td')[0].textContent).toEqual(
      `Toggle select course ${props.courses[1].name}`,
    )
  })

  test('calls onSelectedChanged when courses are selected', async () => {
    const props = defaultProps()
    props.onSelectedChanged = vi.fn()
    const {container} = render(<CoursePickerTable {...props} />)
    const checkbox = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]',
    )[0]
    await userEvent.click(checkbox)

    expect(props.onSelectedChanged).toHaveBeenCalledTimes(1)
    expect(props.onSelectedChanged).toHaveBeenCalledWith({added: ['1'], removed: []})
  })

  test('calls onSelectedChanged when courses are unselected', async () => {
    const props = defaultProps()
    props.selectedCourses = ['1']
    props.onSelectedChanged = vi.fn()
    const {container} = render(<CoursePickerTable {...props} />)
    const checkbox = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]',
    )[0]
    await userEvent.click(checkbox)

    expect(props.onSelectedChanged).toHaveBeenCalledTimes(1)
    expect(props.onSelectedChanged).toHaveBeenCalledWith({removed: ['1'], added: []})
  })

  test('calls onSelectedChanged with correct data when "Select All" is selected', async () => {
    const props = defaultProps()
    props.onSelectedChanged = vi.fn()
    const {container} = render(<CoursePickerTable {...props} />)

    const checkbox = container.querySelectorAll(
      '.btps-table__header-wrapper input[type="checkbox"]',
    )[0]
    await userEvent.click(checkbox)

    expect(props.onSelectedChanged).toHaveBeenCalledTimes(1)
    expect(props.onSelectedChanged).toHaveBeenCalledWith({added: ['1', '2'], removed: []})
  })

  test('handleFocusLoss focuses the next item', () => {
    const props = defaultProps()
    const ref = React.createRef<CoursePickerTable>()
    const {container} = render(<CoursePickerTable {...props} ref={ref} />)
    const instance = ref.current

    const check = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]',
    )[0] as HTMLInputElement
    check.focus = vi.fn()

    instance?.handleFocusLoss(0)
    expect(check.focus).toHaveBeenCalledTimes(1)
  })

  test('handleFocusLoss focuses the previous item if called on the last item', () => {
    const props = defaultProps()
    const ref = React.createRef<CoursePickerTable>()
    const {container} = render(<CoursePickerTable {...props} ref={ref} />)
    const instance = ref.current

    const check = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]',
    )[1] as HTMLInputElement
    check.focus = vi.fn()

    instance?.handleFocusLoss(2)
    expect(check.focus).toHaveBeenCalledTimes(1)
  })

  test('handleFocusLoss focuses on select all if no items left', () => {
    const props = defaultProps()
    props.courses = []
    const ref = React.createRef<CoursePickerTable>()
    const {container} = render(<CoursePickerTable {...props} ref={ref} />)
    const instance = ref.current

    const check = container.querySelectorAll(
      '.bca-table__select-all input[type="checkbox"]',
    )[0] as HTMLInputElement
    check.focus = vi.fn()

    instance?.handleFocusLoss(1)
    expect(check.focus).toHaveBeenCalledTimes(1)
  })

  test('renders concluded pill when course is concluded', () => {
    window.ENV = {
      ...window.ENV,
      FEATURES: {...(window.ENV.FEATURES || {}), ux_list_concluded_courses_in_bp: true},
    }

    const props = defaultProps()
    props.courses = [
      {
        id: '1',
        name: 'Concluded Course',
        course_code: 'CONCLUDED101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher One'}],
        sis_course_id: '1001',
        concluded: true,
      } as any,
    ]

    const {getByText} = render(<CoursePickerTable {...props} />)
    const pill = getByText('Concluded')
    expect(pill).toBeInTheDocument()
  })

  test('does not render pill when course is not concluded', () => {
    const props = defaultProps()
    props.courses = [
      {
        id: '1',
        name: 'Active Course',
        course_code: 'ACTIVE101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher One'}],
        sis_course_id: '1001',
        concluded: false,
      } as any,
    ]

    const {queryByText} = render(<CoursePickerTable {...props} />)
    const pill = queryByText('Concluded')
    expect(pill).not.toBeInTheDocument()
  })

  test('does not render pill when concluded property is missing', () => {
    const props = defaultProps()
    props.courses = [
      {
        id: '1',
        name: 'Course Without Concluded Property',
        course_code: 'NORMAL101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher One'}],
        sis_course_id: '1001',
      },
    ]

    const {queryByText} = render(<CoursePickerTable {...props} />)
    const pill = queryByText('Concluded')
    expect(pill).not.toBeInTheDocument()
  })


  const fiveCourseProps = () => {
    const props = defaultProps()
    props.courses = [
      {
        id: '10',
        name: 'Course Ten',
        course_code: 'course_10',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher Ten'}],
        sis_course_id: '1010',
      },
      {
        id: '11',
        name: 'Course Eleven',
        course_code: 'course_11',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher Eleven'}],
        sis_course_id: '1011',
      },
      {
        id: '12',
        name: 'Course Twelve',
        course_code: 'course_12',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher Twelve'}],
        sis_course_id: '1012',
      },
      {
        id: '13',
        name: 'Course Thirteen',
        course_code: 'course_13',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher Thirteen'}],
        sis_course_id: '1013',
      },
      {
        id: '14',
        name: 'Course Fourteen',
        course_code: 'course_14',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher Fourteen'}],
        sis_course_id: '1014',
      },
    ]
    return props
  }

  test('renders all five available courses with no initial selection', () => {
    const props = fiveCourseProps()
    const {container} = render(<CoursePickerTable {...props} />)
    const rows = container.querySelectorAll('tr[data-testid="bca-table__course-row"]')

    expect(rows).toHaveLength(5)
    const checked = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]:checked',
    )
    expect(checked).toHaveLength(0)
  })

  test('reports the specific course id added when the first course is selected', async () => {
    const props = fiveCourseProps()
    props.onSelectedChanged = vi.fn()
    const {container} = render(<CoursePickerTable {...props} />)

    const checkboxes = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]',
    )
    await userEvent.click(checkboxes[0])

    expect(props.onSelectedChanged).toHaveBeenCalledTimes(1)
    expect(props.onSelectedChanged).toHaveBeenCalledWith({added: ['10'], removed: []})
  })

  test('reports each specific course id as additional courses are selected one at a time', async () => {
    const props = fiveCourseProps()
    props.onSelectedChanged = vi.fn()
    const {container, rerender} = render(<CoursePickerTable {...props} />)

    const checkboxes = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]',
    )

    // first click selects course 10 only
    await userEvent.click(checkboxes[0])
    expect(props.onSelectedChanged).toHaveBeenNthCalledWith(1, {added: ['10'], removed: []})

    // the parent owns selection state; reflect the accepted selection back as props
    props.selectedCourses = ['10']
    rerender(<CoursePickerTable {...props} />)

    // second click selects course 11; only the newly-added id is reported
    await userEvent.click(checkboxes[1])
    expect(props.onSelectedChanged).toHaveBeenNthCalledWith(2, {added: ['11'], removed: []})
    expect(props.onSelectedChanged).toHaveBeenCalledTimes(2)
  })

  test('reports every available course id in order when "Select All" is checked', async () => {
    const props = fiveCourseProps()
    props.onSelectedChanged = vi.fn()
    const {container} = render(<CoursePickerTable {...props} />)

    const selectAll = container.querySelectorAll(
      '.btps-table__header-wrapper input[type="checkbox"]',
    )[0]
    await userEvent.click(selectAll)

    expect(props.onSelectedChanged).toHaveBeenCalledTimes(1)
    expect(props.onSelectedChanged).toHaveBeenCalledWith({
      added: ['10', '11', '12', '13', '14'],
      removed: [],
    })
  })

  test('reports the specific course id removed when an individual selected course is deselected', async () => {
    const props = fiveCourseProps()
    props.selectedCourses = ['10', '11']
    props.onSelectedChanged = vi.fn()
    const {container} = render(<CoursePickerTable {...props} />)

    // both selected courses start checked
    const checkboxes = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>
    expect(checkboxes[0].checked).toBe(true)
    expect(checkboxes[1].checked).toBe(true)

    // deselect only the first course
    await userEvent.click(checkboxes[0])

    expect(props.onSelectedChanged).toHaveBeenCalledTimes(1)
    expect(props.onSelectedChanged).toHaveBeenCalledWith({added: [], removed: ['10']})
  })

  test('removing one of two selected courses leaves the other still checked', async () => {
    const props = fiveCourseProps()
    props.selectedCourses = ['10', '11']
    props.onSelectedChanged = vi.fn()
    const {container, rerender} = render(<CoursePickerTable {...props} />)

    const checkboxes = () =>
      container.querySelectorAll(
        '[data-testid="bca-table__course-row"] input[type="checkbox"]',
      ) as NodeListOf<HTMLInputElement>

    // remove course 10
    await userEvent.click(checkboxes()[0])
    expect(props.onSelectedChanged).toHaveBeenCalledWith({added: [], removed: ['10']})

    // parent commits the removal; course 11 remains the only selection
    props.selectedCourses = ['11']
    rerender(<CoursePickerTable {...props} />)

    expect(checkboxes()[0].checked).toBe(false)
    expect(checkboxes()[1].checked).toBe(true)
    const stillChecked = container.querySelectorAll(
      '[data-testid="bca-table__course-row"] input[type="checkbox"]:checked',
    )
    expect(stillChecked).toHaveLength(1)
  })
})

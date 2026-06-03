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
import BlueprintAssociations from '../BlueprintAssociations'
import getSampleData from './getSampleData'
import type {Course} from '../../types'

describe('BlueprintAssociations component', () => {
  const defaultProps = () => ({
    courses: [] as Course[],
    existingAssociations: [] as Course[],
    addedAssociations: [] as Course[],
    removedAssociations: [] as Course[],
    addAssociations: () => {},
    removeAssociations: () => {},
    loadCourses: () => {},
    loadAssociations: () => {},
    hasLoadedCourses: false,
    isLoadingCourses: false,
    isLoadingAssociations: false,
    isSavingAssociations: false,
    hasUnsyncedChanges: false,
    subAccounts: getSampleData().subAccounts,
    terms: getSampleData().terms,
  })

  test('renders the BlueprintAssociations component', () => {
    const {container} = render(<BlueprintAssociations {...defaultProps()} />)
    const node = container.querySelector('.bca__wrapper')
    expect(node).toBeTruthy()
  })

  test('displays saving spinner when saving', () => {
    const props = defaultProps()
    props.isSavingAssociations = true
    const {container} = render(<BlueprintAssociations {...props} />)
    const node = container.querySelector('.bca__overlay__save-wrapper [class*="spinner"]')
    expect(node).toBeTruthy()
  })

  test('renders a child CoursePicker component', () => {
    const {container} = render(<BlueprintAssociations {...defaultProps()} />)
    const node = container.querySelector('.bca-course-picker')
    expect(node).toBeTruthy()
  })

  test('renders a child AssociationsTable component', () => {
    const {container} = render(<BlueprintAssociations {...defaultProps()} />)
    const node = container.querySelector('.bca-associations-table')
    expect(node).toBeTruthy()
  })

  test('render save warning if there are existing associations, new associations, and unsynced changes', () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    props.addedAssociations = getSampleData().courses as Course[]
    props.hasUnsyncedChanges = true
    const {getByText} = render(<BlueprintAssociations {...props} />)
    const node = getByText('Warning:')
    expect(node).toBeTruthy()
  })

  test('render no save warning if there are existing associations, new associations, but no unsynced changes', () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    props.addedAssociations = getSampleData().courses as Course[]
    props.hasUnsyncedChanges = false
    const {queryByText} = render(<BlueprintAssociations {...props} />)
    const node = queryByText('Warning:')
    expect(node).toBeFalsy()
  })

  test('render no save warning if there are existing associations, unsynced changes, but no new associations', () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    props.addedAssociations = []
    props.hasUnsyncedChanges = true
    const {queryByText} = render(<BlueprintAssociations {...props} />)
    const node = queryByText('Warning:')
    expect(node).toBeFalsy()
  })

  test('render no save warning if there are new associations, unsynced changes, but no existing associations', () => {
    const props = defaultProps()
    props.existingAssociations = []
    props.addedAssociations = getSampleData().courses as Course[]
    props.hasUnsyncedChanges = true
    const {queryByText} = render(<BlueprintAssociations {...props} />)
    const node = queryByText('Warning:')
    expect(node).toBeFalsy()
  })


  // --- Replacement coverage for selenium: courses show in the 'To be Added' area ---
  // The legacy selenium test selected an available course from the picker and
  // verified it appeared as a pending association: a "To be Added" heading plus a
  // remove button keyed by the course id inside the associations table. These tests
  // assert that pending-association state directly from the rendered output rather
  // than only checking that the child components mount.

  const buildCourse = (overrides: Partial<Course> = {}): Course => ({
    id: '1',
    name: 'Course One',
    course_code: 'course_1',
    term: {id: '1', name: 'Term One'},
    teachers: [{display_name: 'Teacher One'}],
    sis_course_id: '1001',
    ...overrides,
  })

  test('shows a "To be Added" heading in the associations table when a course is pending association', () => {
    const props = defaultProps()
    props.addedAssociations = [buildCourse({id: '3', name: 'Course Three'})]
    const {container} = render(<BlueprintAssociations {...props} />)
    const table = container.querySelector('.bca-associations-table')
    expect(table).toBeTruthy()
    const heading = Array.from(table!.querySelectorAll('span, th')).find(
      el => el.textContent === 'To be Added',
    )
    expect(heading).toBeTruthy()
  })

  test('renders a remove button keyed by data-course-id for each pending association', () => {
    const props = defaultProps()
    props.addedAssociations = [
      buildCourse({id: '3', name: 'Course Three'}),
      buildCourse({id: '4', name: 'Course Four'}),
    ]
    const {container} = render(<BlueprintAssociations {...props} />)
    const table = container.querySelector('.bca-associations-table')!
    expect(table.querySelector('button[data-course-id="3"]')).toBeTruthy()
    expect(table.querySelector('button[data-course-id="4"]')).toBeTruthy()
  })

  test('does not show "To be Added" when only existing associations are present', () => {
    const props = defaultProps()
    props.existingAssociations = [buildCourse({id: '1', name: 'Course One'})]
    props.addedAssociations = []
    const {container} = render(<BlueprintAssociations {...props} />)
    const table = container.querySelector('.bca-associations-table')!
    const headings = Array.from(table.querySelectorAll('span, th')).map(el => el.textContent)
    expect(headings).toContain('Current')
    expect(headings).not.toContain('To be Added')
  })

  test('does not render the associations table when there are no associations of any kind', () => {
    const props = defaultProps()
    const {container, getByText} = render(<BlueprintAssociations {...props} />)
    const table = container.querySelector('.bca-associations-table')!
    expect(table.querySelector('button[data-course-id]')).toBeFalsy()
    expect(getByText('There are currently no associated courses.')).toBeTruthy()
  })

  test('separates an existing association from a newly added one into "Current" and "To be Added"', () => {
    const props = defaultProps()
    props.existingAssociations = [buildCourse({id: '1', name: 'Course One'})]
    props.addedAssociations = [buildCourse({id: '3', name: 'Course Three'})]
    const {container} = render(<BlueprintAssociations {...props} />)
    const table = container.querySelector('.bca-associations-table')!
    const headings = Array.from(table.querySelectorAll('span, th')).map(el => el.textContent)
    expect(headings).toContain('Current')
    expect(headings).toContain('To be Added')
    // the existing course keeps its remove button, and the pending one gets its own
    expect(table.querySelector('button[data-course-id="1"]')).toBeTruthy()
    expect(table.querySelector('button[data-course-id="3"]')).toBeTruthy()
  })

  test('reflects added associations as selected courses in the course picker', () => {
    // BlueprintAssociations derives the picker selection from addedAssociations ids,
    // so a course the user just selected stays checked in the picker list. The picker
    // table is collapsed (and its rows unmounted) unless the details are expanded, so
    // render with isExpanded to observe the rendered checkbox state.
    const selectedCourse = buildCourse({id: '3', name: 'Course Three'})
    const props = defaultProps()
    props.courses = [selectedCourse, buildCourse({id: '4', name: 'Course Four'})]
    props.addedAssociations = [selectedCourse]
    const {container} = render(<BlueprintAssociations {...props} isExpanded={true} />)
    const picker = container.querySelector('.bca-course-picker')!
    const selectedCheckbox = picker.querySelector<HTMLInputElement>('input[type="checkbox"][value="3"]')
    const unselectedCheckbox = picker.querySelector<HTMLInputElement>('input[type="checkbox"][value="4"]')
    expect(selectedCheckbox).toBeTruthy()
    expect(selectedCheckbox!.checked).toBe(true)
    expect(unselectedCheckbox!.checked).toBe(false)
  })
})

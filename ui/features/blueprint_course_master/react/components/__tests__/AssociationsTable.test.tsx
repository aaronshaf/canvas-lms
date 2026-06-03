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
import userEvent from '@testing-library/user-event'
import AssociationsTable from '../AssociationsTable'
import FocusManager from '../../focusManager'
import getSampleData from './getSampleData'
import type {Course} from '../../types'

describe('AssociationsTable component', () => {
  const focusManager = new FocusManager()
  focusManager.before = document.body

  const defaultProps = () => ({
    existingAssociations: getSampleData().courses as Course[],
    addedAssociations: [] as Course[],
    removedAssociations: [] as Course[],
    onRemoveAssociations: () => {},
    onRestoreAssociations: () => {},
    isLoadingAssociations: false,
    focusManager,
  })

  test('renders the AssociationsTable component', () => {
    const {container} = render(<AssociationsTable {...defaultProps()} />)
    const node = container.querySelector('.bca-associations-table')
    expect(node).toBeInTheDocument()
  })

  test('displays correct table data', () => {
    const props = defaultProps()
    const tree = render(<AssociationsTable {...props} />)
    const rows = tree.container.querySelectorAll('tr[data-testid="associations-course-row"]')

    expect(rows).toHaveLength(props.existingAssociations.length)
    expect(rows[0].querySelectorAll('td')[0].textContent).toEqual(
      props.existingAssociations[0].name,
    )
    expect(rows[1].querySelectorAll('td')[0].textContent).toEqual(
      props.existingAssociations[1].name,
    )
  })

  test('calls onRemoveAssociations when association remove button is clicked', async () => {
    const props = defaultProps()
    props.onRemoveAssociations = vi.fn()
    const tree = render(<AssociationsTable {...props} />)
    const button = tree.container.querySelectorAll(
      'tr[data-testid="associations-course-row"] button',
    )
    await userEvent.click(button[0])

    expect(props.onRemoveAssociations).toHaveBeenCalledTimes(1)
    expect(props.onRemoveAssociations).toHaveBeenCalledWith(['1'])
  })

  test('renders concluded pill when course is concluded', () => {
    window.ENV.FEATURES = {...window.ENV.FEATURES, ux_list_concluded_courses_in_bp: true}

    const props = defaultProps()
    props.existingAssociations = [
      {
        id: '1',
        name: 'Concluded Course',
        course_code: 'CONCLUDED101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher One'}],
        sis_course_id: '1001',
        concluded: true,
      } as Course,
    ]

    const {getByText} = render(<AssociationsTable {...props} />)
    const pill = getByText('Concluded')
    expect(pill).toBeInTheDocument()
  })

  test('does not render pill when course is not concluded', () => {
    const props = defaultProps()
    props.existingAssociations = [
      {
        id: '1',
        name: 'Active Course',
        course_code: 'ACTIVE101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher One'}],
        sis_course_id: '1001',
        concluded: false,
      } as Course,
    ]

    const {queryByText} = render(<AssociationsTable {...props} />)
    const pill = queryByText('Concluded')
    expect(pill).not.toBeInTheDocument()
  })

  test('renders concluded pill in removedAssociations when course is concluded', () => {
    window.ENV.FEATURES = {...window.ENV.FEATURES, ux_list_concluded_courses_in_bp: true}

    const props = defaultProps()
    props.existingAssociations = []
    props.removedAssociations = [
      {
        id: '1',
        name: 'Concluded Removed Course',
        course_code: 'CONCLUDED101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher One'}],
        sis_course_id: '1001',
        concluded: true,
      } as Course,
    ]

    const {getByText} = render(<AssociationsTable {...props} />)
    const pill = getByText('Concluded')
    expect(pill).toBeInTheDocument()
  })

  test('renders course name as a clickable link with correct href', () => {
    const props = defaultProps()
    const {container} = render(<AssociationsTable {...props} />)
    const firstRow = container.querySelectorAll('tr[data-testid="associations-course-row"]')[0]
    const link = firstRow.querySelector('a[href^="/courses/"]')

    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', `/courses/${props.existingAssociations[0].id}`)
    expect(link).toHaveTextContent(props.existingAssociations[0].name)
  })

  test('renders course links in all association states', () => {
    const props = defaultProps()
    props.addedAssociations = [
      {
        id: '99',
        name: 'Added Course',
        course_code: 'ADDED101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher'}],
        sis_course_id: '9001',
      } as Course,
    ]
    props.removedAssociations = [
      {
        id: '88',
        name: 'Removed Course',
        course_code: 'REMOVED101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher'}],
        sis_course_id: '8001',
      } as Course,
    ]

    const {container} = render(<AssociationsTable {...props} />)

    // Check for links to existing associations
    props.existingAssociations.forEach(course => {
      const link = container.querySelector(`a[href="/courses/${course.id}"]`)
      expect(link).toBeInTheDocument()
    })

    // Check for link to added association
    const addedLink = container.querySelector(`a[href="/courses/99"]`)
    expect(addedLink).toBeInTheDocument()

    // Check for link to removed association
    const removedLink = container.querySelector(`a[href="/courses/88"]`)
    expect(removedLink).toBeInTheDocument()
  })

  test('falls back to plain text when course ID is missing', () => {
    const props = defaultProps()
    props.existingAssociations = [
      {
        id: null,
        name: 'Course Without ID',
        course_code: 'TEST101',
        term: {id: '1', name: 'Term One'},
        teachers: [{display_name: 'Teacher'}],
        sis_course_id: '1001',
      } as unknown as Course,
    ]

    const {container} = render(<AssociationsTable {...props} />)
    const firstCell = container.querySelector('tr[data-testid="associations-course-row"] td')
    const link = firstCell?.querySelector('a[href^="/courses/"]')

    expect(link).not.toBeInTheDocument()
    expect(firstCell).toHaveTextContent('Course Without ID')
  })


  test('removes the course row from the Current section after it is removed', () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    const [course0, course1] = props.existingAssociations

    const tree = render(<AssociationsTable {...props} />)

    // Both associated courses are rendered as current rows initially
    expect(
      tree.container.querySelectorAll('tr[data-testid="associations-course-row"]'),
    ).toHaveLength(2)
    expect(tree.container.querySelector(`#course_${course0.id}`)).toBeInTheDocument()
    expect(tree.container.querySelector(`#course_${course1.id}`)).toBeInTheDocument()

    // Parent reports the first course as removed (mirrors POST /associations result)
    tree.rerender(
      <AssociationsTable
        {...props}
        existingAssociations={[course1]}
        removedAssociations={[course0]}
      />,
    )

    // The removed course is no longer in the Current list; only the survivor remains there.
    // Current rows carry a remove button, whereas the removed course is re-rendered in the
    // "To be Removed" section with an Undo link instead, so filter on the remove button to
    // isolate the Current section.
    const currentRows = Array.from(
      tree.container.querySelectorAll('tr[data-testid="associations-course-row"]'),
    ).filter(row => row.querySelector('button[data-course-id]'))
    const currentNames = currentRows.map(row => row.querySelectorAll('td')[0].textContent)
    expect(currentNames).toContain(course1.name)
    expect(currentNames).not.toContain(course0.name)
  })

  test('shows the removed course under "To be Removed" with an Undo control', () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    const [course0, course1] = props.existingAssociations

    const tree = render(<AssociationsTable {...props} />)

    tree.rerender(
      <AssociationsTable
        {...props}
        existingAssociations={[course1]}
        removedAssociations={[course0]}
      />,
    )

    // The "To be Removed" section header is now present
    expect(tree.getByText('To be Removed')).toBeInTheDocument()

    // The removed course is rendered (in the removed section) with an Undo restore action
    const removedRow = tree.container.querySelector(`#course_${course0.id}`)
    expect(removedRow).toBeInTheDocument()
    expect(tree.getByText('Undo')).toBeInTheDocument()
    expect(
      tree.getByText(`Undo remove course association ${course0.name}`),
    ).toBeInTheDocument()
  })

  test('updates the rendered row count when an association is removed', () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    const [course0, course1] = props.existingAssociations

    const tree = render(<AssociationsTable {...props} />)
    expect(
      tree.container.querySelectorAll('tr[data-testid="associations-course-row"]'),
    ).toHaveLength(2)

    // After removal, the Current list holds one course and the removed list holds one course,
    // so there is still one removable row and one restorable (Undo) row.
    tree.rerender(
      <AssociationsTable
        {...props}
        existingAssociations={[course1]}
        removedAssociations={[course0]}
      />,
    )

    const allRows = tree.container.querySelectorAll('tr[data-testid="associations-course-row"]')
    expect(allRows).toHaveLength(2)

    // The surviving current course still exposes a remove button...
    const currentRow = tree.container.querySelector(`#course_${course1.id}`)
    expect(currentRow?.querySelector('button[data-course-id]')).toBeInTheDocument()
    // ...while the removed course exposes an Undo link instead of a remove button.
    const removedRow = tree.container.querySelector(`#course_${course0.id}`)
    expect(removedRow?.querySelector('button[data-course-id]')).not.toBeInTheDocument()
  })

  test('calls onRemoveAssociations with the clicked course id and reflects that removal in the UI', async () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    props.onRemoveAssociations = vi.fn()
    const [course0, course1] = props.existingAssociations

    const tree = render(<AssociationsTable {...props} />)

    // Click the remove button for the second course specifically
    const secondRow = tree.container.querySelector(`#course_${course1.id}`)
    const removeButton = secondRow?.querySelector('button[data-course-id]') as HTMLButtonElement
    await userEvent.click(removeButton)

    expect(props.onRemoveAssociations).toHaveBeenCalledTimes(1)
    expect(props.onRemoveAssociations).toHaveBeenCalledWith([course1.id])

    // Simulate the parent applying that removal and confirm the UI drops the right course
    tree.rerender(
      <AssociationsTable
        {...props}
        existingAssociations={[course0]}
        removedAssociations={[course1]}
      />,
    )

    const currentNames = Array.from(
      tree.container.querySelectorAll('tr[data-testid="associations-course-row"]'),
    )
      .filter(row => row.querySelector('button[data-course-id]'))
      .map(row => row.querySelectorAll('td')[0].textContent)
    expect(currentNames).toEqual([course0.name])
  })

  test('restores a removed course back to the Current section when Undo is clicked', async () => {
    const props = defaultProps()
    props.existingAssociations = getSampleData().courses as Course[]
    props.onRestoreAssociations = vi.fn()
    const [course0, course1] = props.existingAssociations

    const tree = render(<AssociationsTable {...props} />)

    // Start in the post-removal state: course0 is queued for removal
    tree.rerender(
      <AssociationsTable
        {...props}
        existingAssociations={[course1]}
        removedAssociations={[course0]}
      />,
    )
    expect(tree.getByText('To be Removed')).toBeInTheDocument()

    await userEvent.click(tree.getByText('Undo'))
    expect(props.onRestoreAssociations).toHaveBeenCalledTimes(1)
    expect(props.onRestoreAssociations).toHaveBeenCalledWith([course0.id])

    // Parent restores the association; the course returns to Current and the removed section clears
    tree.rerender(
      <AssociationsTable
        {...props}
        existingAssociations={getSampleData().courses as Course[]}
        removedAssociations={[]}
      />,
    )
    expect(tree.queryByText('To be Removed')).not.toBeInTheDocument()
    const currentNames = Array.from(
      tree.container.querySelectorAll('tr[data-testid="associations-course-row"]'),
    ).map(row => row.querySelectorAll('td')[0].textContent)
    expect(currentNames).toEqual([course0.name, course1.name])
  })

  test('shows the empty-state message after the last association is removed', () => {
    const props = defaultProps()
    props.existingAssociations = [getSampleData().courses[0] as Course]
    const onlyCourse = props.existingAssociations[0]

    const tree = render(<AssociationsTable {...props} />)
    expect(
      tree.container.querySelectorAll('tr[data-testid="associations-course-row"]'),
    ).toHaveLength(1)

    // Removing the sole course leaves nothing in Current; with no removed/added rows the
    // table is replaced by the empty-state copy.
    tree.rerender(
      <AssociationsTable {...props} existingAssociations={[]} removedAssociations={[]} />,
    )

    expect(
      tree.container.querySelectorAll('tr[data-testid="associations-course-row"]'),
    ).toHaveLength(0)
    expect(tree.queryByText(onlyCourse.name)).not.toBeInTheDocument()
    expect(tree.getByText('There are currently no associated courses.')).toBeInTheDocument()
  })
})

/*
 * Copyright (C) 2021 - present Instructure, Inc.
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
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'

import {PacePicker} from '../pace_picker'
import {
  COURSE,
  ENROLLMENT_1,
  ENROLLMENT_2,
  SORTED_ENROLLMENTS,
  SORTED_SECTIONS,
} from '../../../__tests__/fixtures'

const selectPaceContextFn = vi.fn()

const defaultProps = {
  course: COURSE,
  enrollments: SORTED_ENROLLMENTS,
  sections: SORTED_SECTIONS,
  selectedContextId: COURSE.id,
  selectedContextType: 'Course' as const,
  setSelectedPaceContext: selectPaceContextFn,
  responsiveSize: 'large' as const,
  unappliedChangesExist: false,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('PacePicker', () => {
  it('renders a drop-down with all pace types represented', () => {
    const {getByLabelText} = render(<PacePicker {...defaultProps} />)

    const picker = getByLabelText('Course Pacing') as HTMLInputElement
    expect(picker).toBeInTheDocument()
    expect(picker.value).toBe('Course')

    act(() => {
      fireEvent.click(picker)
    })
    expect(screen.getByRole('menuitem', {name: 'Course'})).toBeInTheDocument()

    const sections = screen.getByRole('menuitem', {name: 'Sections'})
    expect(sections).toBeInTheDocument()
    act(() => {
      fireEvent.click(sections)
    })
    expect(screen.getByRole('menuitem', {name: 'Hackers'})).toBeInTheDocument()
    expect(screen.getByRole('menuitem', {name: 'Mercenaries'})).toBeInTheDocument()

    const students = screen.getByRole('menuitem', {name: 'Students'})
    expect(students).toBeInTheDocument()
    act(() => {
      fireEvent.click(students)
    })
    const henry = screen.getByRole('menuitem', {name: 'Henry Dorsett Case'})
    expect(henry).toBeInTheDocument()
    expect(henry.querySelector('span[name="Henry Dorsett Case"]')).toBeInTheDocument()
    const molly = screen.getByRole('menuitem', {name: 'Molly Millions'})
    expect(molly).toBeInTheDocument()
    expect(molly.querySelector('img[src="molly_avatar"]')).toBeInTheDocument()
  })

  it('sets the selected context when an option is clicked', () => {
    const {getByLabelText} = render(<PacePicker {...defaultProps} />)
    const picker = getByLabelText('Course Pacing') as HTMLInputElement

    act(() => {
      fireEvent.click(picker)
    })
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', {name: 'Course'}))
    })
    expect(selectPaceContextFn).toHaveBeenCalledWith('Course', COURSE.id)

    act(() => {
      fireEvent.click(picker)
    })
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', {name: 'Sections'}))
    })
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', {name: 'Hackers'}))
    })
    expect(selectPaceContextFn).toHaveBeenCalledWith('Section', SORTED_SECTIONS[0].id)

    act(() => {
      fireEvent.click(picker)
    })
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', {name: 'Students'}))
    })
    act(() => {
      fireEvent.click(screen.getByRole('menuitem', {name: 'Molly Millions'}))
    })
    expect(selectPaceContextFn).toHaveBeenCalledWith('Enrollment', ENROLLMENT_2.id)
  })

  it('displays the name of the currently selected context', () => {
    const {getByLabelText} = render(
      <PacePicker
        {...defaultProps}
        selectedContextType="Enrollment"
        selectedContextId={ENROLLMENT_1.id}
      />,
    )
    const picker = getByLabelText('Course Pacing') as HTMLInputElement
    expect(picker.value).toBe('Henry Dorsett Case')
  })

  it('displays a heading when there are no enrolled students or sections', () => {
    const {getByRole} = render(<PacePicker {...defaultProps} sections={[]} enrollments={[]} />)
    const heading = getByRole('heading', {name: 'Course Pacing'})
    expect(heading).toBeInTheDocument()
  })

  it('renders a drop-down with course and sections only if no enrolled students', () => {
    const {getByLabelText} = render(<PacePicker {...defaultProps} enrollments={[]} />)
    const picker = getByLabelText('Course Pacing') as HTMLInputElement
    act(() => {
      fireEvent.click(picker)
    })

    expect(screen.getByRole('menuitem', {name: 'Course'})).toBeInTheDocument()
    expect(screen.getByRole('menuitem', {name: 'Sections'})).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', {name: 'Students'})).not.toBeInTheDocument()
  })

  it('renders a drop-down with course and students only if no sections exist', () => {
    const {getByLabelText} = render(<PacePicker {...defaultProps} sections={[]} />)
    const picker = getByLabelText('Course Pacing') as HTMLInputElement
    act(() => {
      fireEvent.click(picker)
    })

    expect(screen.getByRole('menuitem', {name: 'Course'})).toBeInTheDocument()
    expect(screen.getByRole('menuitem', {name: 'Students'})).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', {name: 'Sections'})).not.toBeInTheDocument()
  })

  describe('warning modal', () => {
    it('is displayed if context changes with unpublished changes', () => {
      const {getByText, getByLabelText} = render(
        <PacePicker {...defaultProps} unappliedChangesExist={true} />,
      )
      const picker = getByLabelText('Course Pacing') as HTMLInputElement

      act(() => {
        fireEvent.click(picker)
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Students'}))
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Molly Millions'}))
      })
      expect(getByText(/You have unpublished changes to your course pace./)).toBeInTheDocument()
    })

    it('shows a message for changes in section paces', () => {
      const {getByText, getByLabelText} = render(
        <PacePicker {...defaultProps} selectedContextType="Section" unappliedChangesExist={true} />,
      )
      const picker = getByLabelText('Course Pacing') as HTMLInputElement

      act(() => {
        fireEvent.click(picker)
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Students'}))
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Molly Millions'}))
      })
      expect(getByText(/You have unpublished changes to your section pace./)).toBeInTheDocument()
    })

    it('aborts context change on cancel', () => {
      const {getByDisplayValue, getByText, getByLabelText} = render(
        <PacePicker {...defaultProps} unappliedChangesExist={true} />,
      )
      const picker = getByLabelText('Course Pacing') as HTMLInputElement

      act(() => {
        fireEvent.click(picker)
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Students'}))
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Molly Millions'}))
      })
      const cancelBtn = getByText('Keep Editing').closest('button')
      act(() => {
        fireEvent.click(cancelBtn!)
      })
      expect(getByDisplayValue('Course')).toBeInTheDocument()
    })

    it('cancels context change on "Keep Editing"', () => {
      const {getByText, getByLabelText} = render(
        <PacePicker {...defaultProps} unappliedChangesExist={true} />,
      )
      const picker = getByLabelText('Course Pacing') as HTMLInputElement

      act(() => {
        fireEvent.click(picker)
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Students'}))
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Molly Millions'}))
      })
      const cancelBtn = getByText('Keep Editing').closest('button')
      act(() => {
        fireEvent.click(cancelBtn!)
      })
      expect(selectPaceContextFn).not.toHaveBeenCalledWith('Molly Millions', '98')
    })

    it('changes context change on "Discard Changes"', () => {
      const {getByText, getByLabelText} = render(
        <PacePicker {...defaultProps} unappliedChangesExist={true} />,
      )
      const picker = getByLabelText('Course Pacing') as HTMLInputElement

      act(() => {
        fireEvent.click(picker)
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Students'}))
      })
      act(() => {
        fireEvent.click(screen.getByRole('menuitem', {name: 'Molly Millions'}))
      })
      const confirmBtn = getByText('Discard Changes').closest('button')
      act(() => {
        fireEvent.click(confirmBtn!)
      })
      expect(selectPaceContextFn).toHaveBeenCalledWith('Enrollment', '25')
    })
  })
})

/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

import '@instructure/canvas-theme'
import React, {useState} from 'react'
import {render, screen, fireEvent, waitFor} from '@testing-library/react'
import LearningObjectivesInput, {LEARNING_OBJECTIVES_MAX_COUNT} from '../LearningObjectivesInput'

// Controlled wrapper so we can test the full add/edit/delete cycle
const Wrapper = ({
  initial = [],
  onChange,
  error,
}: {
  initial?: string[]
  onChange?: (v: string[]) => void
  error?: string
}) => {
  const [objectives, setObjectives] = useState<string[]>(initial)
  return (
    <LearningObjectivesInput
      objectives={objectives}
      onChange={v => {
        setObjectives(v)
        onChange?.(v)
      }}
      error={error}
    />
  )
}

const addObjective = (value: string) => {
  fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
  fireEvent.change(screen.getByLabelText('Learning objective:'), {target: {value}})
  fireEvent.click(screen.getByTestId('learning-objectives-confirm-btn'))
}

describe('LearningObjectivesInput', () => {
  describe('rendering', () => {
    it('renders existing objectives as read-only rows', () => {
      render(<Wrapper initial={['Objective A', 'Objective B']} />)
      expect(screen.getByTestId('learning-objectives-row-0')).toHaveTextContent('Objective A')
      expect(screen.getByTestId('learning-objectives-row-1')).toHaveTextContent('Objective B')
    })

    it('renders the add button when below the max count', () => {
      render(<Wrapper initial={['One objective']} />)
      expect(screen.getByTestId('learning-objectives-add-btn')).toBeInTheDocument()
    })

    it('hides the add button at the max count', () => {
      const maxObjectives = Array.from(
        {length: LEARNING_OBJECTIVES_MAX_COUNT},
        (_, i) => `Objective ${i + 1}`,
      )
      render(<Wrapper initial={maxObjectives} />)
      expect(screen.queryByTestId('learning-objectives-add-btn')).not.toBeInTheDocument()
    })

    it('shows the external error prop', () => {
      render(<Wrapper error="Please provide at least one learning objective" />)
      expect(screen.getByText('Please provide at least one learning objective')).toBeInTheDocument()
    })

    it('renders edit and delete buttons for each row', () => {
      render(<Wrapper initial={['Objective A', 'Objective B']} />)
      expect(screen.getByTestId('learning-objectives-edit-btn-0')).toBeInTheDocument()
      expect(screen.getByTestId('learning-objectives-delete-btn-0')).toBeInTheDocument()
      expect(screen.getByTestId('learning-objectives-edit-btn-1')).toBeInTheDocument()
      expect(screen.getByTestId('learning-objectives-delete-btn-1')).toBeInTheDocument()
    })

    it('renders edit and delete buttons with objective text in screen reader label', () => {
      render(<Wrapper initial={['Critical thinking']} />)
      expect(
        screen.getByRole('button', {name: /Edit objective: Critical thinking/}),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', {name: /Delete objective: Critical thinking/}),
      ).toBeInTheDocument()
    })
  })

  describe('add flow', () => {
    it('shows the inline input row when add button is clicked', () => {
      render(<Wrapper />)
      fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
      expect(screen.getByTestId('learning-objectives-input')).toBeInTheDocument()
      expect(screen.getByTestId('learning-objectives-confirm-btn')).toBeInTheDocument()
      expect(screen.getByTestId('learning-objectives-cancel-btn')).toBeInTheDocument()
    })

    it('adds the objective and calls onChange on confirm', () => {
      const onChange = vi.fn()
      render(<Wrapper onChange={onChange} />)
      addObjective('New objective')
      expect(onChange).toHaveBeenCalledWith(['New objective'])
      expect(screen.getByTestId('learning-objectives-row-0')).toHaveTextContent('New objective')
    })

    it('trims whitespace before adding', () => {
      const onChange = vi.fn()
      render(<Wrapper onChange={onChange} />)
      addObjective('  trimmed  ')
      expect(onChange).toHaveBeenCalledWith(['trimmed'])
    })

    it('hides the inline row and does not call onChange on cancel', () => {
      const onChange = vi.fn()
      render(<Wrapper onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
      fireEvent.change(screen.getByLabelText('Learning objective:'), {
        target: {value: 'Unfinished'},
      })
      fireEvent.click(screen.getByTestId('learning-objectives-cancel-btn'))
      expect(onChange).not.toHaveBeenCalled()
      expect(screen.queryByTestId('learning-objectives-input')).not.toBeInTheDocument()
    })

    it('shows inline error and does not add when confirming blank input', async () => {
      const onChange = vi.fn()
      render(<Wrapper onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
      fireEvent.click(screen.getByTestId('learning-objectives-confirm-btn'))
      await waitFor(() => {
        expect(screen.getByText('Objective cannot be blank')).toBeInTheDocument()
      })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('shows inline error and does not add when confirming whitespace-only input', async () => {
      const onChange = vi.fn()
      render(<Wrapper onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
      fireEvent.change(screen.getByLabelText('Learning objective:'), {target: {value: '   '}})
      fireEvent.click(screen.getByTestId('learning-objectives-confirm-btn'))
      await waitFor(() => {
        expect(screen.getByText('Objective cannot be blank')).toBeInTheDocument()
      })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('clears the inline error when user starts typing', async () => {
      render(<Wrapper />)
      fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
      fireEvent.click(screen.getByTestId('learning-objectives-confirm-btn'))
      await waitFor(() => {
        expect(screen.getByText('Objective cannot be blank')).toBeInTheDocument()
      })
      fireEvent.change(screen.getByRole('textbox'), {target: {value: 'x'}})
      expect(screen.queryByText('Objective cannot be blank')).not.toBeInTheDocument()
    })

    it('pressing Enter confirms the add', () => {
      const onChange = vi.fn()
      render(<Wrapper onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
      fireEvent.change(screen.getByLabelText('Learning objective:'), {
        target: {value: 'Via enter'},
      })
      fireEvent.keyDown(screen.getByLabelText('Learning objective:'), {key: 'Enter'})
      expect(onChange).toHaveBeenCalledWith(['Via enter'])
    })

    it('hides the add button while the add row is open', () => {
      render(<Wrapper />)
      fireEvent.click(screen.getByTestId('learning-objectives-add-btn'))
      expect(screen.queryByTestId('learning-objectives-add-btn')).not.toBeInTheDocument()
    })
  })

  describe('edit flow', () => {
    it('shows the inline edit row pre-filled when pencil is clicked', () => {
      render(<Wrapper initial={['Original text']} />)
      fireEvent.click(screen.getByTestId('learning-objectives-edit-btn-0'))
      expect(screen.getByLabelText('Learning objective:')).toHaveValue('Original text')
    })

    it('updates the objective and calls onChange on confirm edit', () => {
      const onChange = vi.fn()
      render(<Wrapper initial={['Old text']} onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-edit-btn-0'))
      fireEvent.change(screen.getByLabelText('Learning objective:'), {target: {value: 'New text'}})
      fireEvent.click(screen.getByTestId('learning-objectives-confirm-btn-0'))
      expect(onChange).toHaveBeenCalledWith(['New text'])
      expect(screen.getByTestId('learning-objectives-row-0')).toHaveTextContent('New text')
    })

    it('restores the original text and does not call onChange on cancel edit', () => {
      const onChange = vi.fn()
      render(<Wrapper initial={['Original']} onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-edit-btn-0'))
      fireEvent.change(screen.getByLabelText('Learning objective:'), {target: {value: 'Changed'}})
      fireEvent.click(screen.getByTestId('learning-objectives-cancel-btn-0'))
      expect(onChange).not.toHaveBeenCalled()
      expect(screen.getByTestId('learning-objectives-row-0')).toHaveTextContent('Original')
    })

    it('shows inline error when confirming blank edit', async () => {
      const onChange = vi.fn()
      render(<Wrapper initial={['Some text']} onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-edit-btn-0'))
      fireEvent.change(screen.getByLabelText('Learning objective:'), {target: {value: ''}})
      fireEvent.click(screen.getByTestId('learning-objectives-confirm-btn-0'))
      await waitFor(() => {
        expect(screen.getByText('Objective cannot be blank')).toBeInTheDocument()
      })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('pressing Enter confirms the edit', () => {
      const onChange = vi.fn()
      render(<Wrapper initial={['Old']} onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-edit-btn-0'))
      fireEvent.change(screen.getByLabelText('Learning objective:'), {target: {value: 'New'}})
      fireEvent.keyDown(screen.getByLabelText('Learning objective:'), {key: 'Enter'})
      expect(onChange).toHaveBeenCalledWith(['New'])
    })

    it('only one row is in edit mode at a time', () => {
      render(<Wrapper initial={['Obj A', 'Obj B']} />)
      fireEvent.click(screen.getByTestId('learning-objectives-edit-btn-0'))
      fireEvent.click(screen.getByTestId('learning-objectives-edit-btn-1'))
      expect(screen.getByLabelText('Learning objective:')).toHaveValue('Obj B')
      expect(screen.getByTestId('learning-objectives-row-0')).toHaveTextContent('Obj A')
    })
  })

  describe('delete flow', () => {
    it('removes the objective and calls onChange on delete', () => {
      const onChange = vi.fn()
      render(<Wrapper initial={['Keep', 'Remove']} onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-delete-btn-1'))
      expect(onChange).toHaveBeenCalledWith(['Keep'])
      expect(screen.queryByText('Remove')).not.toBeInTheDocument()
    })

    it('removes the correct item when deleting from the middle', () => {
      const onChange = vi.fn()
      render(<Wrapper initial={['A', 'B', 'C']} onChange={onChange} />)
      fireEvent.click(screen.getByTestId('learning-objectives-delete-btn-1'))
      expect(onChange).toHaveBeenCalledWith(['A', 'C'])
    })

    it('shows the add button again after deleting the only item', () => {
      render(<Wrapper initial={['Only one']} />)
      fireEvent.click(screen.getByTestId('learning-objectives-delete-btn-0'))
      expect(screen.getByTestId('learning-objectives-add-btn')).toBeInTheDocument()
    })
  })

  describe('max count enforcement', () => {
    it('hides the add button when at the max count', () => {
      const maxObjectives = Array.from(
        {length: LEARNING_OBJECTIVES_MAX_COUNT},
        (_, i) => `Obj ${i + 1}`,
      )
      render(<Wrapper initial={maxObjectives} />)
      expect(screen.queryByTestId('learning-objectives-add-btn')).not.toBeInTheDocument()
    })

    it('shows the add button after deleting from a full list', () => {
      const maxObjectives = Array.from(
        {length: LEARNING_OBJECTIVES_MAX_COUNT},
        (_, i) => `Obj ${i + 1}`,
      )
      render(<Wrapper initial={maxObjectives} />)
      fireEvent.click(screen.getByTestId('learning-objectives-delete-btn-0'))
      expect(screen.getByTestId('learning-objectives-add-btn')).toBeInTheDocument()
    })
  })
})

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

import React from 'react'
import {render} from '@testing-library/react'
import {showFlashSuccess} from '@instructure/platform-alerts'
import DefaultGradeModal from '../DefaultGradeModal'
import {useDefaultGrade} from '../../../hooks/useDefaultGrade'
import {ApiCallStatus} from '../../../../types'
import {defaultAssignment} from './fixtures'
import {defaultGradebookOptions} from '../../__tests__/fixtures'

vi.mock('@instructure/platform-alerts', async () => {
  const actual = await vi.importActual('@instructure/platform-alerts')
  return {
    ...actual,
    showFlashSuccess: vi.fn().mockReturnValue(vi.fn()),
    showFlashError: vi.fn().mockReturnValue(vi.fn()),
  }
})

vi.mock('../../../hooks/useDefaultGrade')

describe('DefaultGradeModal flash idempotency', () => {
  const baseProps = {
    assignment: defaultAssignment,
    gradebookOptions: defaultGradebookOptions,
    submissions: [],
    modalOpen: true,
    handleClose: vi.fn(),
  }

  const mockHookState = (status: ApiCallStatus) =>
    vi.mocked(useDefaultGrade).mockReturnValue({
      defaultGradeStatus: status,
      savedGrade: '10',
      setGrades: vi.fn(),
      updatedSubmissions: [],
      resetDefaultGradeStatus: vi.fn(),
    })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // The component always mounts in NOT_STARTED in production (initial useDefaultGrade state).
  // Tests start there and drive transitions through re-renders with new mock return values.
  const renderWithInitialStatus = () => {
    mockHookState(ApiCallStatus.NOT_STARTED)
    return render(<DefaultGradeModal {...baseProps} handleSetGrades={vi.fn()} />)
  }

  it('fires showFlashSuccess once when status transitions into COMPLETED', () => {
    const {rerender} = renderWithInitialStatus()
    expect(vi.mocked(showFlashSuccess)).not.toHaveBeenCalled()

    mockHookState(ApiCallStatus.COMPLETED)
    rerender(<DefaultGradeModal {...baseProps} handleSetGrades={vi.fn()} />)

    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)
  })

  it('does not re-fire showFlashSuccess when handleSetGrades identity changes but status stays COMPLETED', () => {
    // simulates parent re-render on student switch: callback identity changes,
    // status remains stale-COMPLETED (the React 18 deferred-update scenario).
    const {rerender} = renderWithInitialStatus()

    mockHookState(ApiCallStatus.COMPLETED)
    rerender(<DefaultGradeModal {...baseProps} handleSetGrades={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)

    // status still COMPLETED, only handleSetGrades identity changes
    rerender(<DefaultGradeModal {...baseProps} handleSetGrades={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)
  })

  it('fires showFlashSuccess again only after a real status transition out and back into COMPLETED', () => {
    const {rerender} = renderWithInitialStatus()

    mockHookState(ApiCallStatus.COMPLETED)
    rerender(<DefaultGradeModal {...baseProps} handleSetGrades={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)

    mockHookState(ApiCallStatus.NOT_STARTED)
    rerender(<DefaultGradeModal {...baseProps} handleSetGrades={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)

    mockHookState(ApiCallStatus.COMPLETED)
    rerender(<DefaultGradeModal {...baseProps} handleSetGrades={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(2)
  })
})

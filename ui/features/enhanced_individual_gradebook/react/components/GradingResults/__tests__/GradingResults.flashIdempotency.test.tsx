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
import GradingResults from '..'
import {useSubmitScore} from '../../../hooks/useSubmitScore'
import {useGetComments} from '../../../hooks/useComments'
import {ApiCallStatus, type GradebookUserSubmissionDetails} from '../../../../types'
import {gradingResultsDefaultProps, defaultStudentSubmissions} from './fixtures'

vi.mock('@instructure/platform-alerts', async () => {
  const actual = await vi.importActual('@instructure/platform-alerts')
  return {
    ...actual,
    showFlashSuccess: vi.fn().mockReturnValue(vi.fn()),
    showFlashError: vi.fn().mockReturnValue(vi.fn()),
  }
})

vi.mock('../../../hooks/useSubmitScore')
vi.mock('../../../hooks/useComments')

describe('GradingResults flash idempotency', () => {
  // Pass studentSubmissions=[] so the component hits its early-return before
  // rendering ProxyUploadModal (which requires an ApolloProvider). The effect
  // we're testing runs before the early return, so this doesn't affect coverage.
  const baseProps = {
    ...gradingResultsDefaultProps,
    studentSubmissions: [],
  }

  const mockSubmitState = (
    status: ApiCallStatus,
    savedSubmission: GradebookUserSubmissionDetails | null = defaultStudentSubmissions,
  ) =>
    vi.mocked(useSubmitScore).mockReturnValue({
      submitScoreError: '',
      submitScoreStatus: status,
      savedSubmission,
      submit: vi.fn(),
      submitExcused: vi.fn(),
    })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useGetComments).mockReturnValue({
      submissionComments: [],
      loadingComments: false,
      refetchComments: vi.fn(),
    })
  })

  // Production always mounts in NOT_STARTED. Drive transitions via re-renders.
  const renderWithInitialStatus = () => {
    mockSubmitState(ApiCallStatus.NOT_STARTED, null)
    return render(<GradingResults {...baseProps} onSubmissionSaved={vi.fn()} />)
  }

  it('fires showFlashSuccess once when submitScoreStatus transitions into COMPLETED', () => {
    const {rerender} = renderWithInitialStatus()
    expect(vi.mocked(showFlashSuccess)).not.toHaveBeenCalled()

    mockSubmitState(ApiCallStatus.COMPLETED)
    rerender(<GradingResults {...baseProps} onSubmissionSaved={vi.fn()} />)

    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)
  })

  it('does not re-fire showFlashSuccess when onSubmissionSaved identity changes but status stays COMPLETED', () => {
    // simulates parent re-render on student switch: callback identity changes
    // (because it depends on selectedStudentId), status remains stale-COMPLETED.
    const {rerender} = renderWithInitialStatus()

    mockSubmitState(ApiCallStatus.COMPLETED)
    rerender(<GradingResults {...baseProps} onSubmissionSaved={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)

    // status still COMPLETED, only onSubmissionSaved identity changes
    rerender(<GradingResults {...baseProps} onSubmissionSaved={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)
  })

  it('fires showFlashSuccess again only after a real status transition out and back into COMPLETED', () => {
    const {rerender} = renderWithInitialStatus()

    mockSubmitState(ApiCallStatus.COMPLETED)
    rerender(<GradingResults {...baseProps} onSubmissionSaved={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)

    mockSubmitState(ApiCallStatus.NOT_STARTED, null)
    rerender(<GradingResults {...baseProps} onSubmissionSaved={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(1)

    mockSubmitState(ApiCallStatus.COMPLETED)
    rerender(<GradingResults {...baseProps} onSubmissionSaved={vi.fn()} />)
    expect(vi.mocked(showFlashSuccess)).toHaveBeenCalledTimes(2)
  })
})

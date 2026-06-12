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
import {render, screen} from '@testing-library/react'
import {configureGradeFormatting, resetGradeFormatting} from '@instructure/platform-grades'
import {GradeDisplay} from '../GradeDisplay'

const baseProps = {
  score: 85,
  pointsPossible: 100,
  grade: '85',
  excused: false,
  gradingType: 'points',
  courseGrade: null,
  gradingScheme: 'percentage' as const,
  submissionId: 'sub1',
}

beforeEach(() => {
  window.ENV = {} as any
})

// GradeFormatHelper holds module-level locale config; restore defaults so
// configured-locale tests don't bleed into the others.
afterEach(() => {
  resetGradeFormatting()
})

describe('GradeDisplay', () => {
  it('formats the assignment grade via @instructure/platform-grades', () => {
    render(<GradeDisplay {...baseProps} />)
    expect(screen.getByTestId('grade-percentage-sub1')).toHaveTextContent('85/100')
  })

  it('renders a letter grade unchanged', () => {
    render(<GradeDisplay {...baseProps} grade="B" gradingType="letter_grade" />)
    expect(screen.getByTestId('grade-percentage-sub1')).toHaveTextContent('B')
  })

  it('uses the locale config injected through configureGradeFormatting', () => {
    // Mirrors the startup wiring in platformBridge.tsx: the host injects its
    // own number formatter and "score out of" template.
    configureGradeFormatting({
      formatNumber: value => String(value).replace('.', ','),
      parseNumber: input => parseFloat(String(input).replace(',', '.')),
      strings: {
        excused: 'Excused',
        complete: 'Complete',
        incomplete: 'Incomplete',
        scoreOutOf: '%{score} of %{pointsPossible}',
      },
    })

    render(<GradeDisplay {...baseProps} grade="85.5" score={85.5} />)
    expect(screen.getByTestId('grade-percentage-sub1')).toHaveTextContent('85,5 of 100')
  })

  it('renders the configured excused string for excused submissions', () => {
    configureGradeFormatting({strings: {excused: 'EXCUSED!'} as any})
    render(<GradeDisplay {...baseProps} excused={true} grade={null} />)
    expect(screen.getByTestId('grade-percentage-sub1')).toHaveTextContent('EXCUSED!')
  })
})

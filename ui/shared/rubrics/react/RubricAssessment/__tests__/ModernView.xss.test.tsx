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
import {MockedQueryProvider} from '@canvas/test-utils/query'
import {ModernView} from '../ModernView'
import type {RubricCriterion} from '../../types/rubric'

const criteriaWith = (longDescription: string): RubricCriterion[] => [
  {
    id: 'criterion_1',
    description: 'Writing Quality',
    longDescription,
    points: 10,
    criterionUseRange: false,
    ignoreForScoring: false,
    ratings: [{id: 'rating_1_1', description: 'Excellent', longDescription: '', points: 10}],
  },
]

const renderModernView = (longDescription: string) =>
  render(
    <MockedQueryProvider>
      <ModernView
        buttonDisplay="numeric"
        criteria={criteriaWith(longDescription)}
        hidePoints={false}
        isPreviewMode={false}
        isPeerReview={false}
        isSelfAssessment={false}
        isFreeFormCriterionComments={false}
        ratingOrder="descending"
        rubricAssessmentData={[]}
        selectedViewMode="horizontal"
        onUpdateAssessmentData={() => {}}
      />
    </MockedQueryProvider>,
  )

describe('ModernView long description XSS mitigation', () => {
  it('strips <script> tags from longDescription', () => {
    const {baseElement} = renderModernView('<script>alert(1)</script>malicious')
    expect(baseElement.innerHTML).not.toContain('<script>')
    expect(baseElement.innerHTML).not.toContain('alert(1)')
  })

  it('strips onclick event handlers from longDescription', () => {
    const {baseElement} = renderModernView('<div onclick="alert(1)">click me</div>')
    expect(baseElement.innerHTML).not.toContain('onclick')
  })

  it('strips javascript: protocol from longDescription', () => {
    const {baseElement} = renderModernView('<a href="javascript:alert(1)">click</a>')
    expect(baseElement.innerHTML).not.toContain('javascript:')
  })

  it('strips object tags with event handlers from longDescription', () => {
    const {baseElement} = renderModernView('<object onerror="alert(3)">x</object>')
    expect(baseElement.innerHTML).not.toContain('onerror')
  })

  it('renders safe HTML as rich content', () => {
    const {baseElement} = renderModernView('<strong>bold</strong>')
    expect(baseElement.querySelector('strong')?.textContent).toBe('bold')
  })
})

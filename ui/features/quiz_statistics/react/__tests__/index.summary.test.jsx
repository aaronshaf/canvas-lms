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
import Report from '../components/summary/report'

describe('canvas_quizzes/statistics/summary report generators', () => {
  const baseReport = {
    generatable: true,
    isGenerated: false,
    isGenerating: false,
    includesAllVersions: false,
    anonymous: false,
    progress: {},
    file: {},
  }

  describe('Student Analysis report-generator', () => {
    const studentReport = {
      ...baseReport,
      id: '9',
      reportType: 'student_analysis',
      readableType: 'Student Analysis',
    }

    it('renders the report-generator container with the Student Analysis label', () => {
      const {container, getAllByText} = render(<Report {...studentReport} />)
      const generator = container.querySelector('.report-generator')
      expect(generator).not.toBeNull()
      expect(getAllByText('Student Analysis').length).toBeGreaterThan(0)
    })

    it('does not show "Report has been generated" before any interaction', () => {
      const {container} = render(<Report {...studentReport} />)
      const generator = container.querySelector('.report-generator')
      expect(generator.textContent).not.toContain('Report has been generated')
    })

    it('renders the "Generate student analysis report" screen-reader tooltip text', () => {
      const {container} = render(<Report {...studentReport} />)
      const generator = container.querySelector('.report-generator')
      expect(generator.textContent).toContain('Generate student analysis report')
    })
  })

  describe('Item Analysis report-generator', () => {
    const itemReport = {
      ...baseReport,
      id: '8',
      reportType: 'item_analysis',
      readableType: 'Item Analysis',
    }

    it('renders the report-generator container with the Item Analysis label', () => {
      const {container, getAllByText} = render(<Report {...itemReport} />)
      const generator = container.querySelector('.report-generator')
      expect(generator).not.toBeNull()
      expect(getAllByText('Item Analysis').length).toBeGreaterThan(0)
    })

    it('does not show "Report has been generated" before any interaction', () => {
      const {container} = render(<Report {...itemReport} />)
      const generator = container.querySelector('.report-generator')
      expect(generator.textContent).not.toContain('Report has been generated')
    })

    it('renders the "Generate item analysis report" screen-reader tooltip text', () => {
      const {container} = render(<Report {...itemReport} />)
      const generator = container.querySelector('.report-generator')
      expect(generator.textContent).toContain('Generate item analysis report')
    })
  })
})

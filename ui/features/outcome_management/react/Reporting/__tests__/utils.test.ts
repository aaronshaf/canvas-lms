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

import {contentTypeToScoreType} from '../utils'

describe('contentTypeToScoreType', () => {
  it('maps Assignment to assignment', () => {
    expect(contentTypeToScoreType('Assignment')).toBe('assignment')
  })

  it('maps DiscussionTopic to discussion', () => {
    expect(contentTypeToScoreType('DiscussionTopic')).toBe('discussion')
  })

  it('maps Quizzes::Quiz to new_quiz', () => {
    expect(contentTypeToScoreType('Quizzes::Quiz')).toBe('new_quiz')
  })

  it('maps Quiz to quiz', () => {
    expect(contentTypeToScoreType('Quiz')).toBe('quiz')
  })

  it('falls back to assignment for unknown types', () => {
    expect(contentTypeToScoreType('WikiPage')).toBe('assignment')
    expect(contentTypeToScoreType('Rubric')).toBe('assignment')
    expect(contentTypeToScoreType('something_unknown')).toBe('assignment')
  })

  it('falls back to assignment for undefined', () => {
    expect(contentTypeToScoreType(undefined)).toBe('assignment')
  })
})

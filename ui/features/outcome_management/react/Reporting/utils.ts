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

import type {ScoreType} from './types'

const CONTENT_TYPE_TO_SCORE_TYPE: Record<string, ScoreType> = {
  Assignment: 'assignment',
  DiscussionTopic: 'discussion',
  'Quizzes::Quiz': 'new_quiz',
  Quiz: 'quiz',
}

export const contentTypeToScoreType = (contentType: string | undefined): ScoreType =>
  (contentType && CONTENT_TYPE_TO_SCORE_TYPE[contentType]) || 'assignment'

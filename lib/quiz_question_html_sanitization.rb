# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

module QuizQuestionHtmlSanitization
  private

  def sanitize_question_data_html_fields
    data = self[:question_data]
    return unless data.is_a?(Hash)

    sanitize_fields(data, Quizzes::QuizQuestion::QUESTION_DATA_HTML_FIELDS)

    answers = data[:answers]
    answers = answers.values if answers.is_a?(Hash)
    answers&.each do |answer|
      next unless answer.is_a?(Hash)

      sanitize_fields(answer, Quizzes::QuizQuestion::QUESTION_DATA_ANSWER_HTML_FIELDS)
    end
  end

  def sanitize_fields(hash, fields)
    fields.each do |field|
      next unless hash[field].is_a?(String)

      hash[field] = Sanitize.clean(hash[field], CanvasSanitize::SANITIZE)
    end
  end
end

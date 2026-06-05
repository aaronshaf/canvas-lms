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

require_relative "../../support/request_helper"

describe "Quizzes::QuizzesController#show with take=1" do
  describe "GET /courses/:course_id/quizzes/:quiz_id/take" do
    it "does not render the take_quiz_link element for a teacher" do
      # Arrange
      course_with_teacher(active_all: true)
      course_with_student(course: @course, active_all: true)
      quiz = @course.quizzes.create!(title: "Teacher cannot take", time_limit: 5)
      quiz.quiz_questions.create!(question_data: multiple_choice_question_data)
      quiz.generate_quiz_data
      quiz.workflow_state = "available"
      quiz.published_at = Time.zone.now
      quiz.save!

      # The brandable_css handlebars index isn't built in this worktree;
      # stub it out so the full HTML view can render. We only care about the
      # take_quiz_link absence, not the css/js asset pipeline.
      allow(BrandableCSS).to receive(:handlebars_index_json).and_return("{}".html_safe)

      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/take"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to match(/id=["']take_quiz_link["']/)
    end
  end
end

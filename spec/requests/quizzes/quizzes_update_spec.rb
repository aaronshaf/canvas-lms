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

describe "Quizzes::QuizzesController#update PUT /courses/:course_id/quizzes/:id" do
  describe "allowed_attempts validation" do
    it "accepts a 3 digit number for allowed_attempts and persists it on the quiz" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      quiz = @course.quizzes.create!(title: "Attempt Limit Quiz")

      # Act
      put "/courses/#{@course.id}/quizzes/#{quiz.id}",
          params: { quiz: { allowed_attempts: "123" } }

      # Assert
      expect(response).to have_http_status(:found)
      expect(flash[:error]).to be_nil
      expect(quiz.reload.allowed_attempts).to eq 123
      expect(quiz.errors[:allowed_attempts]).to be_empty
    end
  end
end

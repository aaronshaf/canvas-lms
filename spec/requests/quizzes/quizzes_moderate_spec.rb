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

describe "Quizzes Moderate page extra time" do
  describe "POST /api/v1/courses/:course_id/quizzes/:quiz_id/extensions" do
    it "persists extra_time on the student's quiz submission" do
      # Arrange
      course_with_teacher(active_all: true)
      student = student_in_course(course: @course, active_all: true).user
      quiz = @course.quizzes.create!(title: "moderation quiz", time_limit: 20)
      quiz.published_at = Time.zone.now
      quiz.workflow_state = "available"
      quiz.generate_quiz_data
      quiz.save!
      user_session(@teacher)

      # Act
      post "/api/v1/courses/#{@course.id}/quizzes/#{quiz.id}/extensions",
           params: { quiz_extensions: [{ user_id: student.id, extra_time: 13 }] },
           headers: { "Accept" => "application/vnd.api+json" }

      # Assert
      expect(response).to have_http_status(:ok)
      submission = quiz.quiz_submissions.where(user_id: student.id).first
      expect(submission).not_to be_nil
      expect(submission.extra_time).to eq 13
      json = json_parse(response.body)
      expect(json["quiz_extensions"].first["extra_time"]).to eq 13
      # vnd.api+json serializes IDs as strings
      expect(json["quiz_extensions"].first["user_id"].to_i).to eq student.id
    end
  end
end

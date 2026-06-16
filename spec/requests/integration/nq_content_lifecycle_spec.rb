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

require "spec_helper"

describe "New Quizzes Content Lifecycle Integration" do
  include NQHelpers

  describe "Duplication" do
    it "leaves the duplicate of a published New Quiz unpublished when the service finalizes it", guid: "b6e4a10d" do
      # Arrange
      teacher_enrollment = course_with_teacher(active_all: true)
      course = teacher_enrollment.course
      teacher = teacher_enrollment.user

      course.root_account.disable_feature!(:course_copy_alignments)

      tool = create_nq_tool(course)
      published_quiz = create_nq_external_tool_assignment(course, tool, title: "Published New Quiz", workflow_state: "published")

      duplicating_copy = create_nq_external_tool_assignment(
        course,
        tool,
        title: "Published New Quiz Copy",
        workflow_state: "duplicating",
        duplicate_of: published_quiz
      )

      pseudonym(teacher)
      token = teacher.access_tokens.create!(purpose: "test")

      # Act
      put "/api/v1/courses/#{course.id}/assignments/#{duplicating_copy.id}",
          params: { assignment: { duplicated_successfully: true } },
          headers: { "Authorization" => "Bearer #{token.full_token}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(duplicating_copy.reload.workflow_state).to eq("unpublished")
    end

    it "leaves the duplicate of a published New Quiz unpublished when course_copy_alignments routes through alignment cloning", guid: "b6e4a10d" do
      skip("2026-06-15 QUIZ-14864 did not fix this issue when course_copy_alignments is on")

      # Arrange
      teacher_enrollment = course_with_teacher(active_all: true)
      course = teacher_enrollment.course
      teacher = teacher_enrollment.user

      course.root_account.enable_feature!(:course_copy_alignments)

      tool = create_nq_tool(course)
      published_quiz = create_nq_external_tool_assignment(course, tool, title: "Published New Quiz", workflow_state: "published")

      duplicating_copy = create_nq_external_tool_assignment(
        course,
        tool,
        title: "Published New Quiz Copy",
        workflow_state: "duplicating",
        duplicate_of: published_quiz
      )

      pseudonym(teacher)
      token = teacher.access_tokens.create!(purpose: "test")
      auth = { "Authorization" => "Bearer #{token.full_token}" }

      # Act
      put "/api/v1/courses/#{course.id}/assignments/#{duplicating_copy.id}",
          params: { assignment: { duplicated_successfully: true } },
          headers: auth
      put "/api/v1/courses/#{course.id}/assignments/#{duplicating_copy.id}",
          params: { assignment: { alignment_cloned_successfully: true } },
          headers: auth

      # Assert
      expect(duplicating_copy.reload.workflow_state).to eq("unpublished")
    end
  end
end

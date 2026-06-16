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

  describe "Content Import" do
    it "retains the graded survey type when a New Quiz is copied into a destination course", guid: "c8a15e4d" do
      # Arrange
      teacher_enrollment = course_with_teacher(active_all: true)
      source_course = teacher_enrollment.course
      teacher = teacher_enrollment.user

      source_tool = create_nq_tool(source_course)
      source_quiz = create_nq_external_tool_assignment(
        source_course,
        source_tool,
        title: "Course Feedback Survey",
        submission_types: "external_tool",
        workflow_state: "published"
      )
      source_quiz.new_quizzes_type = "graded_survey"
      source_quiz.save!

      destination_course = course_with_teacher(user: teacher, active_all: true).course
      create_nq_tool(destination_course)

      pseudonym(teacher)
      token = teacher.access_tokens.create!(purpose: "test")

      # Act
      post "/api/v1/courses/#{destination_course.id}/content_migrations",
           params: {
             migration_type: "course_copy_importer",
             settings: { source_course_id: source_course.id }
           },
           headers: { "Authorization" => "Bearer #{token.full_token}" }
      run_jobs

      # Assert
      expect(response).to have_http_status(:ok)
      migration = ContentMigration.find(response.parsed_body["id"])
      expect(migration.reload.workflow_state).to eq("imported")

      copied_quiz = destination_course.assignments.find_by(title: "Course Feedback Survey")
      expect(copied_quiz).to be_present
      expect(copied_quiz.submission_types).to eq("external_tool")
      expect(copied_quiz.new_quizzes_type).to eq("graded_survey")
    end
  end
end

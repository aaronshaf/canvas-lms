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

describe "Quizzes::QuizzesController#edit" do
  describe "GET /courses/:course_id/quizzes/:id/edit" do
    it "omits the find-question and find-bank links when teacher_role has read_question_banks disabled" do
      # Arrange
      course_with_teacher(active_all: true, account: Account.default)
      Account.default.role_overrides.create!(
        permission: "read_question_banks",
        role: teacher_role,
        enabled: false
      )
      quiz = @course.quizzes.create!(title: "My Quiz")
      course_bank = AssessmentQuestionBank.create!(context: @course)
      assessment_question_model(bank: course_bank)
      account_bank = AssessmentQuestionBank.create!(context: @course.account)
      assessment_question_model(bank: account_bank)
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include("find_question_link")
      expect(response.body).not_to include("find_bank_link")
    end

    it "renders the find-question and find-bank links when teacher_role has read_question_banks enabled" do
      # Arrange
      course_with_teacher(active_all: true, account: Account.default)
      quiz = @course.quizzes.create!(title: "My Quiz")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("find_question_link")
      expect(response.body).to include("find_bank_link")
    end

    it "flashes a warning notice when the quiz already has student submissions" do
      # Arrange
      course_with_teacher(active_all: true)
      quiz_with_submission
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{@quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Keep in mind, some students have already taken or started taking this quiz")
    end

    it "does not flash the submissions warning when the quiz has no submissions" do
      # Arrange
      course_with_teacher(active_all: true)
      quiz = @course.quizzes.create!(title: "Fresh Quiz")
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).not_to include("Keep in mind, some students have already taken or started taking this quiz")
    end

    it "renders the persisted question_name for a text_only_question on the Questions tab" do
      # Arrange
      course_with_teacher(active_all: true)
      quiz = @course.quizzes.create!(title: "Custom Name Quiz")
      custom_name = "the hardest question ever"
      quiz.quiz_questions.create!(
        question_data: {
          question_type: "text_only_question",
          question_name: custom_name,
          question_text: "<p>nothing to answer</p>"
        }.with_indifferent_access
      )
      quiz.generate_quiz_data
      quiz.save!
      user_session(@teacher)

      # Act
      get "/courses/#{@course.id}/quizzes/#{quiz.id}/edit"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(custom_name)
      expect(response.body).to match(/class="[^"]*\bquestion_name\b[^"]*"[^>]*>[^<]*#{Regexp.escape(custom_name)}/m)
    end
  end

  describe "PUT /courses/:course_id/quizzes/:id" do
    it "creates a Group assignment_override titled after the differentiation tag when the account setting is enabled" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.account.tap do |a|
        a.settings[:allow_assign_to_differentiation_tags] = { value: true }
        a.save!
      end
      diff_tag_category = @course.group_categories.create!(name: "Differentiation Tag Category", non_collaborative: true)
      diff_tag = @course.groups.create!(name: "Differentiation Tag 1", group_category: diff_tag_category, non_collaborative: true)
      student = student_in_course(course: @course, active_all: true, name: "Student 1").user
      diff_tag.add_user(student)
      quiz = @course.quizzes.create!(title: "Diff Tag Quiz", quiz_type: "assignment", workflow_state: "available")
      user_session(@teacher)

      # Act
      put "/courses/#{@course.id}/quizzes/#{quiz.id}", params: {
        course_id: @course.id,
        id: quiz.id,
        quiz: {
          assignment_overrides: [
            {
              group_id: diff_tag.id,
              due_at: "2022-12-31T17:00:00",
              due_at_overridden: true,
              unlock_at: "2022-12-27T08:00:00",
              unlock_at_overridden: true,
              lock_at: "2023-01-07T21:00:00",
              lock_at_overridden: true
            }
          ]
        }
      }

      # Assert
      override = quiz.reload.assignment_overrides.last
      expect(override).not_to be_nil
      expect(override.set_type).to eq("Group")
      expect(override.set_id).to eq(diff_tag.id)
      expect(override.title).to eq(diff_tag.name)
    end

    it "rejects a differentiation-tag override when the account setting is disabled" do
      # Arrange
      course_with_teacher(active_all: true)
      @course.account.tap do |a|
        a.settings[:allow_assign_to_differentiation_tags] = { value: false }
        a.save!
      end
      diff_tag_category = @course.group_categories.create!(name: "Differentiation Tag Category", non_collaborative: true)
      diff_tag = @course.groups.create!(name: "Differentiation Tag 1", group_category: diff_tag_category, non_collaborative: true)
      quiz = @course.quizzes.create!(title: "Diff Tag Quiz Disabled", quiz_type: "assignment", workflow_state: "available")
      user_session(@teacher)

      # Act
      put "/courses/#{@course.id}/quizzes/#{quiz.id}", params: {
        course_id: @course.id,
        id: quiz.id,
        quiz: {
          assignment_overrides: [
            {
              group_id: diff_tag.id,
              due_at: "2022-12-31T17:00:00",
              due_at_overridden: true
            }
          ]
        }
      }

      # Assert
      expect(quiz.reload.assignment_overrides.where(set_type: "Group", set_id: diff_tag.id)).to be_empty
    end
  end
end

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

require_relative "../support/request_helper"

describe "Assessment Question Banks" do
  describe "POST /courses/:course_id/question_banks" do
    it "creates an active question bank with the given title for the course" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)

      # Act
      post "/courses/#{@course.id}/question_banks",
           params: { assessment_question_bank: { title: "goober" } },
           headers: { "Accept" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      bank = AssessmentQuestionBank.where(title: "goober").first
      expect(bank).not_to be_nil
      expect(bank.context).to eq(@course)
      expect(bank.workflow_state).to eq("active")
    end

    it "auto-bookmarks the newly created bank for the creator" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)

      # Act
      post "/courses/#{@course.id}/question_banks",
           params: { assessment_question_bank: { title: "goober" } },
           headers: { "Accept" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      bank = AssessmentQuestionBank.where(title: "goober").first
      expect(bank).not_to be_nil
      expect(bank).to be_bookmarked_for(@teacher)
    end

    it "returns the created bank in the JSON response body" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)

      # Act
      post "/courses/#{@course.id}/question_banks",
           params: { assessment_question_bank: { title: "goober" } },
           headers: { "Accept" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      json = json_parse(response.body)
      payload = json["assessment_question_bank"] || json
      expect(payload["title"]).to eq("goober")
      expect(payload["workflow_state"]).to eq("active")
      expect(payload["context_id"]).to eq(@course.id)
      expect(payload["context_type"]).to eq("Course")
    end

    it "denies students from creating a question bank" do
      # Arrange
      course_with_teacher(active_all: true)
      student_in_course(active_all: true, course: @course)
      user_session(@student)

      # Act
      post "/courses/#{@course.id}/question_banks",
           params: { assessment_question_bank: { title: "should not exist" } },
           headers: { "Accept" => "application/json" }

      # Assert
      expect(response).to have_http_status(:forbidden)
      expect(AssessmentQuestionBank.where(title: "should not exist")).to be_empty
    end
  end

  describe "POST /courses/:course_id/question_banks/:question_bank_id/assessment_questions" do
    it "creates a single assessment question in the bank" do
      # Arrange
      course_with_teacher(active_all: true)
      user_session(@teacher)
      bank = @course.assessment_question_banks.create!(title: "My Bank")

      question_data = {
        question_type: "multiple_choice_question",
        question_name: "MC Q1",
        question_text: "Hi, this is a multiple choice question.",
        points_possible: 1,
        answers: [
          { text: "Correct Answer", weight: 100, comments: "Good job!" },
          { text: "Wrong Answer #1", weight: 0, comments: "Bad job :(" },
          { text: "Second Wrong Answer", weight: 0 },
          { text: "Wrongest Answer", weight: 0 }
        ]
      }

      # Act
      expect do
        post "/courses/#{@course.id}/question_banks/#{bank.id}/assessment_questions",
             params: { assessment_question: { form_question_data: question_data } },
             headers: { "Accept" => "application/json" }
      end.to change(AssessmentQuestion, :count).by(1)

      # Assert
      expect(response).to have_http_status(:ok)
      created = bank.reload.assessment_questions.active.last
      expect(created).not_to be_nil
      expect(created.question_data["question_type"]).to eq("multiple_choice_question")
      expect(created.question_data["question_name"]).to eq("MC Q1")
    end

    it "denies students from creating an assessment question on the bank" do
      # Arrange
      course_with_teacher(active_all: true)
      student_in_course(active_all: true, course: @course)
      user_session(@student)
      bank = @course.assessment_question_banks.create!(title: "Locked Bank")

      # Act
      expect do
        post "/courses/#{@course.id}/question_banks/#{bank.id}/assessment_questions",
             params: { assessment_question: { form_question_data: { question_type: "multiple_choice_question",
                                                                    question_name: "x" } } },
             headers: { "Accept" => "application/json" }
      end.not_to change(AssessmentQuestion, :count)

      # Assert
      expect(response).to have_http_status(:forbidden)
    end
  end
end

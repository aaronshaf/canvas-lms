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
require "oauth"
require "webmock/rspec"

describe "New Quizzes Integration" do
  include NQGradePassbackHelpers

  describe "Grade Passback" do
    before do
      Account.default.enable_feature!(:quizzes_next_submission_history)
    end

    it "auto-graded New Quizzes score flows to Canvas gradebook", guid: "7e2b4f91" do
      # Arrange
      student_enrollment = course_with_student(active_all: true)
      course = student_enrollment.course
      student = student_enrollment.user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Auto-Graded Quiz")
      launch_url = "https://quizzes.example.com/session/1?participant_session_id=12345"

      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.8",
        launch_url:,
        submitted_at: 1.hour.ago.iso8601(3)
      )

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      assert_successful_passback

      submission = Submission.find_by(assignment:, user: student)
      expect(submission.reload.score).to eql(0.8 * 100)
      expect(submission.reload.workflow_state).to eq("graded")
    end

    it "teacher manual grade of essay question updates Canvas submission score", guid: "d4a6e823" do
      # Arrange
      student_enrollment = course_with_student(active_all: true)
      course = student_enrollment.course
      student = student_enrollment.user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Quiz with Essay")
      launch_url = "https://quizzes.example.com/session/2?participant_session_id=67890"

      # Pre-existing submission: auto-graded questions scored 60/80, essay (20 pts) ungraded.
      # NQ sent initial passback with needsAdditionalReview, so workflow_state is pending_review.
      submission = seed_existing_submission(
        assignment:,
        user: student,
        tool:,
        launch_url:,
        score: 60,
        workflow_state: "pending_review"
      )

      # Teacher grades the essay at 15/20 in NQ. NQ recalculates total: 60 + 15 = 75.
      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.75",
        launch_url:,
        submitted_at: 2.hours.ago.iso8601(3)
      )

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      assert_successful_passback
      expect(submission.reload.score).to eql(0.75 * 100)
      expect(submission.reload.workflow_state).to eq("graded")
    end

    it "grade passback for outcome-aligned quiz records score on the aligned assignment", guid: "6c1f8b50" do
      # Arrange
      student_enrollment = course_with_student(active_all: true)
      course = student_enrollment.course
      student = student_enrollment.user

      outcome = LearningOutcome.create!(
        title: "Quiz Mastery Outcome",
        description: "Measures quiz mastery",
        context: course,
        rubric_criterion: {
          mastery_points: 3,
          ratings: [
            { points: 3, description: "Mastery" },
            { points: 0, description: "Not Yet" }
          ]
        }
      )
      course.root_outcome_group.add_outcome(outcome)

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Outcome-Aligned Quiz")
      outcome.align(assignment, course)

      launch_url = "https://quizzes.example.com/session/3?participant_session_id=11111"

      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.9",
        launch_url:,
        submitted_at: 1.hour.ago.iso8601(3)
      )

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      assert_successful_passback

      submission = Submission.find_by(assignment:, user: student)
      expect(submission.reload.score).to eql(0.9 * 100)
      expect(submission.reload.workflow_state).to eq("graded")

      outcome_alignment = ContentTag.find_by(
        learning_outcome_id: outcome.id,
        content_type: "Assignment",
        tag_type: "learning_outcome",
        context: course
      )
      expect(outcome_alignment&.content_id).to eq(assignment.id)
      expect(submission.reload.assignment_id).to eq(assignment.id)
    end

    it "fudge points applied in New Quizzes update the Canvas submission score", guid: "b5f3a91d" do
      # Arrange
      student_enrollment = course_with_student(active_all: true)
      course = student_enrollment.course
      student = student_enrollment.user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Fudge Points Quiz")
      launch_url = "https://quizzes.example.com/session/4?participant_session_id=22222"

      # Pre-existing submission: student auto-graded at 70/100
      submission = seed_existing_submission(
        assignment:,
        user: student,
        tool:,
        launch_url:,
        score: 70
      )

      # Teacher adds 10 fudge points in NQ. NQ recalculates: 70 + 10 = 80.
      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.8",
        launch_url:,
        submitted_at: 2.hours.ago.iso8601(3)
      )

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      assert_successful_passback
      expect(submission.reload.score).to eql(0.8 * 100)
      expect(submission.reload.workflow_state).to eq("graded")
    end

    it "second attempt passback updates the Canvas submission score", guid: "c8d2e05f" do
      # Arrange
      student_enrollment = course_with_student(active_all: true)
      course = student_enrollment.course
      student = student_enrollment.user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Multi-Attempt Quiz")
      first_attempt_url = "https://quizzes.example.com/session/5?participant_session_id=33333"

      # Pre-existing submission from first attempt: student scored 60/100
      submission = seed_existing_submission(
        assignment:,
        user: student,
        tool:,
        launch_url: first_attempt_url,
        score: 60
      )

      # NQ sends grade passback for second attempt (different launch URL) with score 85/100
      second_attempt_url = "https://quizzes.example.com/session/6?participant_session_id=44444"

      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.85",
        launch_url: second_attempt_url,
        submitted_at: 1.hour.ago.iso8601(3)
      )

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      assert_successful_passback
      expect(submission.reload.score).to eql(0.85 * 100)
      expect(submission.reload.workflow_state).to eq("graded")
      expect(submission.reload.url).to eq(second_attempt_url)
    end
  end

  describe "Outcome Results" do
    it "retrieves outcome results from the Outcomes Service for a New Quizzes quiz", guid: "a3e7d942" do
      # Arrange
      Account.default.enable_feature!(:outcome_service_results_to_canvas)

      teacher_enrollment = course_with_teacher(active_all: true)
      course = teacher_enrollment.course
      teacher = teacher_enrollment.user

      student_enrollment = student_in_course(course:, active_all: true)
      student = student_enrollment.user

      outcome = course.created_learning_outcomes.create!(
        title: "Quiz Mastery Outcome",
        description: "Measures quiz mastery",
        short_description: "Quiz Mastery",
        rubric_criterion: {
          mastery_points: 3,
          ratings: [
            { points: 5, description: "Exceeds" },
            { points: 3, description: "Mastery" },
            { points: 0, description: "Not Yet" }
          ]
        }
      )
      course.root_outcome_group.add_outcome(outcome)

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Outcome Quiz")

      outcome.align(assignment, course)

      seed_nq_submission(assignment:, user: student, tool:, score: 90, posted: true)

      # Configure Outcomes Service provision settings on root account
      os_domain = "outcomes.test.example.com"
      Account.default.settings[:provision] = {
        "outcomes" => {
          consumer_key: "os_key",
          jwt_secret: "os_secret",
          domain: os_domain
        }
      }
      Account.default.save!

      # Stub the Outcomes Service authoritative_results API
      os_response_body = {
        results: [
          {
            user_uuid: student.uuid,
            points: 4.0,
            points_possible: 5.0,
            external_outcome_id: outcome.id,
            attempted: true,
            submitted_at: 1.hour.ago.iso8601(3),
            associated_asset_type: "canvas.assignment.quizzes",
            associated_asset_id: assignment.id,
            artifact_type: "quizzes.quiz",
            artifact_id: "1",
            mastery: true,
            attempts: [
              {
                id: 1,
                authoritative_result_id: 1,
                points: 4.0,
                points_possible: 5.0,
                event_created_at: 1.hour.ago.iso8601(3),
                event_updated_at: 1.hour.ago.iso8601(3),
                deleted_at: nil,
                created_at: 1.hour.ago.iso8601(3),
                updated_at: 1.hour.ago.iso8601(3),
                metadata: nil,
                submitted_at: 1.hour.ago.iso8601(3),
                attempt_number: 1
              }
            ]
          }
        ]
      }

      stub_request(:get, %r{#{Regexp.escape(os_domain)}/api/authoritative_results})
        .to_return(
          status: 200,
          body: os_response_body.to_json,
          headers: { "Content-Type" => "application/json", "Per-Page" => "200", "Total" => "1" }
        )

      user_session(teacher)

      # Act
      get "/api/v1/courses/#{course.id}/outcome_results",
          params: { user_ids: [student.id], outcome_ids: [outcome.id] }

      # Assert
      expect(response).to have_http_status(:ok)

      body = response.parsed_body
      results = body["outcome_results"]
      expect(results.length).to eq(1)

      os_result = results.find { |r| r["links"]["learning_outcome"] == outcome.id.to_s }
      expect(os_result&.dig("links", "learning_outcome")).to eq(outcome.id.to_s)
      expect(os_result["mastery"]).to be(true)
      expect(os_result["links"]["alignment"]).to eq("assignment_#{assignment.id}")

      expect(WebMock).to have_requested(:get, %r{#{Regexp.escape(os_domain)}/api/authoritative_results})
    end
  end
end

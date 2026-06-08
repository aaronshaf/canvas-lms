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

describe "New Quizzes Grade Passback Controls Integration" do
  include NQGradePassbackHelpers

  describe "Grade Passback Controls" do
    before do
      Account.default.enable_feature!(:quizzes_next_submission_history)
    end

    it "manual posting policy keeps a passed-back grade hidden from the student", guid: "f3a91c47" do
      # Arrange
      student_enrollment = course_with_student(active_all: true)
      course = student_enrollment.course
      student = student_enrollment.user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Manual Posting Quiz", points_possible: 100)
      assignment.ensure_post_policy(post_manually: true)

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
      expect(submission.reload.posted_at).to be_nil
      expect(submission.reload.posted?).to be(false)
    end

    it "manual teacher grade is not overwritten when passback prioritizes the non-tool grade", guid: "a2c7e914" do
      # Arrange
      teacher_enrollment = course_with_teacher(active_all: true)
      course = teacher_enrollment.course
      teacher = teacher_enrollment.user
      student = student_in_course(course:, active_all: true).user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Override Protection Quiz", points_possible: 100)

      # Teacher manually grades the student at 95 (positive grader_id = the teacher).
      teacher_grade = "95"
      assignment.grade_student(student, grade: teacher_grade, grader: teacher)

      launch_url = "https://quizzes.example.com/session/2?participant_session_id=67890"
      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.5",
        launch_url:,
        submitted_at: 1.hour.ago.iso8601(3),
        prioritize_non_tool_grade: true
      )

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      assert_successful_passback

      submission = Submission.find_by(assignment:, user: student)
      expect(submission.reload.score).to eql(teacher_grade.to_f)
      expect(submission.reload.grader_id).to eql(teacher.id)
      # The prioritized passback registers a new ungraded attempt (moving the
      # submission from "graded" back to "submitted") while preserving the
      # teacher's score and grader_id — the human grade is protected, even
      # though a fresh attempt was recorded.
      expect(submission.reload.workflow_state).to eq("submitted")
    end

    it "passback without prioritizeNonToolGrade does overwrite the teacher grade (negative control)", guid: "b9f4c2a1" do
      # Arrange
      teacher_enrollment = course_with_teacher(active_all: true)
      course = teacher_enrollment.course
      teacher = teacher_enrollment.user
      student = student_in_course(course:, active_all: true).user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Override Control Quiz", points_possible: 100)

      # Teacher manually grades the student at 95 (positive grader_id = the teacher).
      assignment.grade_student(student, grade: "95", grader: teacher)

      # Same passback as the protected case, but WITHOUT the prioritizeNonToolGrade flag.
      launch_url = "https://quizzes.example.com/session/4?participant_session_id=24680"
      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.5",
        launch_url:,
        submitted_at: 1.hour.ago.iso8601(3)
      )

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      assert_successful_passback

      # Without the flag the tool's score wins: 0.5 * 100 replaces the teacher's 95,
      # and the grade is reattributed to the tool. This is what the flag prevents.
      submission = Submission.find_by(assignment:, user: student)
      expect(submission.reload.score).to eql(0.5 * 100)
      expect(submission.reload.grader_id).to eql(-tool.id)
    end

    it "moderated grading withholds a passed-back grade from the student", guid: "e6b1d370" do
      # Arrange
      teacher_enrollment = course_with_teacher(active_all: true)
      course = teacher_enrollment.course
      teacher = teacher_enrollment.user
      student = student_in_course(course:, active_all: true).user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Moderated Quiz", points_possible: 100)
      assignment.update!(moderated_grading: true, grader_count: 2, final_grader: teacher)

      launch_url = "https://quizzes.example.com/session/3?participant_session_id=13579"
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
      expect(submission.reload.posted_at).to be_nil
      expect(submission.reload.posted?).to be(false)
      # The LTI 1.1 passback path records the score directly and does NOT create
      # a provisional grade; the grade is withheld via moderated manual posting.
      expect(submission.provisional_grades).to be_empty
      expect(assignment.reload.moderated_grading?).to be(true)
    end
  end
end

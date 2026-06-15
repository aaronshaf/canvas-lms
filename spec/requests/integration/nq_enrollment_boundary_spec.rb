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
require "webmock/rspec" # fail loudly if passback processing ever reaches for a real external call

describe "New Quizzes Enrollment Boundary Integration" do
  include NQGradePassbackHelpers

  describe "Grade Passback" do
    it "rejects a grade passback for a student whose course has concluded", guid: "1d7f4a26" do
      # Arrange
      student_enrollment = course_with_student(active_all: true)
      course = student_enrollment.course
      student = student_enrollment.user

      tool = create_nq_tool(course)
      assignment = create_nq_assignment(course, tool, title: "NQ Concluded Course Quiz")

      # The course soft-concludes when its end date passes while the student's
      # enrollment stays workflow-active. That is the exact state
      # grade_passback_allowed? refuses to write into: the course is concluded and
      # the student is no longer active or pending by date.
      course.update!(start_at: 1.month.ago, conclude_at: 1.day.ago, restrict_enrollments_to_course_dates: true)

      xml_body = nq_replace_result_xml(
        source_id: nq_source_id(tool, course, assignment, student),
        score: "0.8",
        launch_url: "https://quizzes.example.com/session/1?participant_session_id=12345",
        submitted_at: 1.hour.ago.iso8601(3)
      )

      # A published assignment with an active student already has a placeholder
      # submission. Snapshot it so the rejection can be proven to have written
      # nothing, rather than relying on the placeholder's default empty state.
      placeholder = Submission.find_by(assignment:, user: student)
      expect(placeholder).to be_present # guard: fail legibly if the placeholder ever stops being auto-created
      placeholder_state = placeholder.workflow_state
      placeholder_updated_at = placeholder.updated_at

      # Act
      nq_grade_passback(tool, xml_body)

      # Assert
      expect(response).to have_http_status(:unprocessable_content)
      response_xml = Nokogiri::XML.parse(response.body)
      expect(response_xml.at_css("imsx_codeMajor").content).to eq("failure")
      # Pin the rejection to the enrollment-boundary gate specifically, not just
      # any passback failure — the concluded course is refused as unavailable.
      expect(response_xml.at_css("ext_canvas_error_code").content).to eq("course_not_available")

      # The placeholder row is untouched: no grade landed and it was not rewritten.
      untouched = placeholder.reload
      expect(untouched.score).to be_nil
      expect(untouched.workflow_state).to eq(placeholder_state)
      expect(untouched.updated_at).to eq(placeholder_updated_at)
    end
  end
end

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

describe "Rollcall Grade Passback Controls Integration" do
  include RollcallPassbackHelpers

  it "manual posting policy keeps a Rollcall passback grade unposted and hidden from the student", guid: "f4e2c97a" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    student = student_in_course(course:, active_all: true).user

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)
    assignment.ensure_post_policy(post_manually: true)

    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "80%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to eql(0.8 * 100)
    expect(submission.workflow_state).to eq("graded")
    # Manual posting policy: the score is recorded but the grade is withheld —
    # the student cannot see it on the Grades page until the teacher posts it.
    expect(submission.posted_at).to be_nil
    expect(submission.posted?).to be(false)
  end

  it "Rollcall passback clears a teacher's excused status and counts the score (negative control)", guid: "2e9a7d46" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    student_enrollment = student_in_course(course:, active_all: true)
    student = student_enrollment.user

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    # The teacher has excused the student from attendance grading. While excused,
    # the attendance assignment is omitted from the course grade, so the student
    # has no computed course score yet.
    assignment.grade_student(student, excuse: true, grader: teacher)
    expect(student_enrollment.reload.computed_current_score).to be_nil

    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "75%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)

    # Canvas offers no protection at this boundary: applying any score clears the
    # excused flag, so the Rollcall passback silently un-excuses the student.
    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.excused?).to be(false)
    expect(submission.score).to eql(0.75 * 100)
    expect(submission.workflow_state).to eq("graded")

    # The previously-excluded attendance score now counts toward the course grade.
    expect(student_enrollment.reload.computed_current_score).to eql(0.75 * 100)
  end
end

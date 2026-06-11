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

describe "Rollcall Attendance Grading" do
  include RollcallPassbackHelpers

  it "Rollcall creates a Roll Call Attendance assignment in the Canvas gradebook", guid: "9c4b3e17" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    tool = create_rollcall_tool(course)
    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    post "/api/v1/courses/#{course.id}/assignments",
         params: {
           assignment: {
             name: "Roll Call Attendance",
             grading_type: "percent",
             points_possible: 100,
             published: true,
             submission_types: ["external_tool"],
             external_tool_tag_attributes: { url: tool.url, new_tab: false }
           }
         },
         headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:created)

    body = response.parsed_body
    expect(body["name"]).to eq("Roll Call Attendance")
    expect(body["points_possible"]).to be(100.0)
    expect(body["submission_types"]).to eq(["external_tool"])

    assignment = course.assignments.find_by(title: "Roll Call Attendance")
    expect(assignment.reload.points_possible).to be(100.0)
    expect(assignment.submission_types).to eq("external_tool")
    expect(assignment.external_tool_tag.url).to eq(tool.url)
  end

  it "present attendance mark produces a 100% grade on the Canvas attendance assignment", guid: "e5a82d4f" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    student = student_in_course(course:, active_all: true).user

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "100%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(100.0)
    expect(submission.grade).to eq("100%")
    expect(submission.workflow_state).to eq("graded")
    expect(submission.submission_type).to eq("basic_lti_launch")
    expect(submission.url).to eq(tool.url)
  end

  it "absent attendance mark records a zero grade on the Canvas attendance assignment", guid: "2f8c4d6b" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    student = student_in_course(course:, active_all: true).user

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "0%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(0.0)
    expect(submission.grade).to eq("0%")
    expect(submission.workflow_state).to eq("graded")
  end

  it "a subsequent Rollcall passback overwrites a prior Rollcall-set attendance grade", guid: "1f7d6a93" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    student = student_in_course(course:, active_all: true).user

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    # A prior Rollcall passback already graded this submission as an LTI launch.
    prior_submission = assignment.submissions.find_or_create_by!(user: student)
    prior_submission.update!(
      submission_type: "basic_lti_launch",
      url: tool.url,
      grade: "50%",
      score: 50,
      workflow_state: "graded",
      grader: teacher,
      submitted_at: 1.hour.ago,
      posted_at: 1.hour.ago
    )

    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "90%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(90.0)
    expect(submission.grade).to eq("90%")
    expect(submission.workflow_state).to eq("graded")
    expect(submission.submission_type).to eq("basic_lti_launch")
  end

  it "a reduced attendance score lowers the student's course grade", guid: "b0e94c58" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    student_enrollment = student_in_course(course:, active_all: true)
    student = student_enrollment.user

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    # A second graded assignment so the course grade is a real sum, not just attendance.
    other_assignment = course.assignments.create!(
      title: "Essay",
      points_possible: 100,
      grading_type: "points",
      workflow_state: "published"
    )
    other_assignment.grade_student(student, grade: 100, grader: teacher)

    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "50%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(50.0)
    expect(submission.workflow_state).to eq("graded")

    # essay 100/100 + attendance 50/100 = 75%
    expect(student_enrollment.reload.computed_current_score).to be(75.0)
  end
end

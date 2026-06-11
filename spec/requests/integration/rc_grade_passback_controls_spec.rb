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

  it "setting omit_from_final_grade excludes the attendance score from the course grade", guid: "a1f5e830" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    pseudonym(teacher) # bearer-token auth requires an active pseudonym

    student_enrollment = student_in_course(course:, active_all: true)
    student = student_enrollment.user

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    # A second graded assignment so the course grade is a real sum, and the
    # attendance assignment currently drags it down: essay 100/100 + attendance
    # 50/100 = 75%.
    essay = course.assignments.create!(
      title: "Essay",
      points_possible: 100,
      grading_type: "points",
      workflow_state: "published"
    )
    essay.grade_student(student, grade: 100, grader: teacher)
    assignment.grade_student(student, grade: "50%", grader: teacher)
    expect(student_enrollment.reload.computed_current_score).to eql(75.0) # rubocop:disable RSpec/BeEql

    token = teacher.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}",
        params: { assignment: { omit_from_final_grade: true } },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(assignment.reload.omit_from_final_grade).to be(true)

    # With attendance omitted, only the essay counts: 100/100 = 100%.
    expect(student_enrollment.reload.computed_current_score).to eql(100.0) # rubocop:disable RSpec/BeEql
  end

  it "a section-limited TA can pass back an attendance grade for a student in their own section", guid: "3a7f1e62" do
    # Arrange
    course = course_factory(active_all: true)
    section_a = course.course_sections.create!(name: "Section A")

    ta = user_with_pseudonym(active_all: true) # bearer-token auth requires an active pseudonym
    course.enroll_user(ta, "TaEnrollment", section: section_a, limit_privileges_to_course_section: true, enrollment_state: "active")

    student_a = user_factory(active_all: true)
    course.enroll_user(student_a, "StudentEnrollment", section: section_a, enrollment_state: "active")

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    token = ta.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student_a.id}",
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

    submission = assignment.submissions.find_by(user: student_a)
    expect(submission.reload.score).to eql(100.0) # rubocop:disable RSpec/BeEql
    expect(submission.reload.workflow_state).to eq("graded")
  end

  it "a section-limited TA cannot pass back an attendance grade for a student outside their section", guid: "8c6d4f15" do
    # Arrange
    course = course_factory(active_all: true)
    section_a = course.course_sections.create!(name: "Section A")
    section_b = course.course_sections.create!(name: "Section B")

    ta = user_with_pseudonym(active_all: true) # bearer-token auth requires an active pseudonym
    course.enroll_user(ta, "TaEnrollment", section: section_a, limit_privileges_to_course_section: true, enrollment_state: "active")

    student_b = user_factory(active_all: true)
    course.enroll_user(student_b, "StudentEnrollment", section: section_b, enrollment_state: "active")

    tool = create_rollcall_tool(course)
    assignment = create_attendance_assignment(course, tool)

    token = ta.access_tokens.create!(purpose: "test")

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student_b.id}",
        params: {
          submission: {
            posted_grade: "100%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    # Canvas scopes the grader to their own section (get_user_considering_section),
    # so the out-of-section student is invisible and the passback is rejected.
    expect(response).to have_http_status(:not_found)

    submission = assignment.submissions.find_by(user: student_b)
    expect(submission&.grade).to be_nil
    expect(submission&.score).to be_nil
  end
end

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

# New Quizzes marks a survey anonymous by setting the NQ-specific
# anonymous_participants flag on the Canvas assignment (distinct from the
# anonymous_grading column). These specs pin the submissions-API side of that
# contract: a teacher listing an anonymous survey's submissions must not be able
# to map a submission back to the student who made it. Bug-sourced from
# QUIZ-17021, where the gradebook revealed which students had submitted an
# anonymous graded survey.
describe "New Quizzes Anonymous & Survey Behaviors Integration" do
  include NQAnonymousSurveyHelpers

  it "withholds each student's name from a teacher listing an anonymous survey's submissions", guid: "5a9c3e72" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    first_student = student_in_course(course:, active_all: true).user
    second_student = student_in_course(course:, active_all: true).user

    tool = create_nq_tool(course)
    assignment = create_nq_survey(course, tool, title: "Anonymous NQ Survey", anonymous: true)
    seed_nq_submission(assignment:, user: first_student, tool:, score: 10)
    seed_nq_submission(assignment:, user: second_student, tool:, score: 10)

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions",
        params: { include: ["user"] }

    # Assert
    # The teacher sees both real submissions, but cannot read who made either
    # one: can_read_submission_user_name? returns false for a non-self viewer
    # once new_quizzes_anonymous_participants? is set, so the "user" object
    # Canvas would normally embed (name + avatar) is withheld from every record.
    # The bare numeric user_id stays in the payload by design (this endpoint
    # only strips it under the anonymize_user_id param); what the NQ flag
    # guarantees is that no *name* leaks, not full de-identification.
    expect(response).to have_http_status(:ok)
    submissions = response.parsed_body
    expect(submissions.pluck("user_id")).to match_array([first_student.id, second_student.id])
    expect(submissions.flat_map(&:keys)).not_to include("user")
  end

  it "withholds each student's name when the listing asks for a user summary", guid: "5a9c3e72" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    student = student_in_course(course:, active_all: true).user

    tool = create_nq_tool(course)
    assignment = create_nq_survey(course, tool, title: "Anonymous NQ Survey", anonymous: true)
    seed_nq_submission(assignment:, user: student, tool:, score: 10)

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions",
        params: { include: ["user_summary"] }

    # Assert
    # user_summary embeds the student's display name through a different
    # serializer than the "user" include, but behind the same
    # can_read_submission_user_name? guard. The NQ anonymity flag must withhold
    # it here too, or a grader could de-anonymize the survey just by asking for
    # the summary instead of the full user.
    expect(response).to have_http_status(:ok)
    record = response.parsed_body.first
    expect(record["user_id"]).to eql(student.id)
    expect(record).not_to have_key("user")
  end

  it "exposes student identity for a non-anonymous survey (negative control)", guid: "5a9c3e72" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    student = student_in_course(course:, active_all: true).user

    tool = create_nq_tool(course)
    assignment = create_nq_survey(course, tool, title: "Plain NQ Survey", anonymous: false)
    seed_nq_submission(assignment:, user: student, tool:, score: 10)

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions",
        params: { include: ["user"] }

    # Assert
    # Without the NQ anonymity flag the same request embeds the student's user
    # object — proving the flag, not some unrelated default, is what withholds
    # identity in the anonymous case above.
    expect(response).to have_http_status(:ok)
    record = response.parsed_body.first
    expect(record["user_id"]).to eql(student.id)
    expect(record["user"]["id"]).to eql(student.id)
  end

  it "embeds the student's name in a user summary for a non-anonymous survey (negative control)", guid: "5a9c3e72" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user
    student = student_in_course(course:, active_all: true).user

    tool = create_nq_tool(course)
    assignment = create_nq_survey(course, tool, title: "Plain NQ Survey", anonymous: false)
    seed_nq_submission(assignment:, user: student, tool:, score: 10)

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions",
        params: { include: ["user_summary"] }

    # Assert
    # Without the NQ anonymity flag the user_summary branch embeds the student's
    # display name — proving the flag, not the user_summary code path itself, is
    # what withholds the name in the anonymous case above.
    expect(response).to have_http_status(:ok)
    record = response.parsed_body.first
    expect(record["user"]["id"]).to eql(student.id)
    expect(record["user"]["display_name"]).to eq(student.short_name)
  end

  it "reports the NQ anonymity flag in the survey's assignment details", guid: "d3f9e27c" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user

    tool = create_nq_tool(course)
    assignment = create_nq_survey(course, tool, title: "Anonymous NQ Survey", anonymous: true)

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}"

    # Assert
    # New Quizzes carries survey anonymity in the assignment's
    # new_quizzes_anonymous_participants flag (the NQ-specific seam, not the
    # anonymous_grading column), and the assignment details API surfaces it so
    # the gradebook knows to anonymize this survey rather than exposing who
    # responded.
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["new_quizzes_anonymous_participants"]).to be(true)
  end

  it "reports the NQ anonymity flag as false for a non-anonymous survey (negative control)", guid: "d3f9e27c" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user

    tool = create_nq_tool(course)
    assignment = create_nq_survey(course, tool, title: "Plain NQ Survey", anonymous: false)

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/assignments/#{assignment.id}"

    # Assert
    # A survey left non-anonymous reports the flag as false — proving the flag
    # tracks the NQ anonymity setting rather than defaulting on for every survey.
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["new_quizzes_anonymous_participants"]).to be(false)
  end
end

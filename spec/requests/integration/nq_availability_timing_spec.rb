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

# Canvas's side of the New Quizzes availability & timing contract has three
# responsibilities, verified here against the sessionless LTI launch:
#   - GATE:    block a student from launching while the quiz is locked.
#   - PUSH:    emit the student's effective unlock_at/lock_at/due_at as the
#              custom_canvas_assignment_* launch params. This is the
#              un-backstopped seam: quiz_lti enforces its lock window and
#              quiz_api auto-submits / caps sessions purely from these values,
#              so a wrong date here is invisible until it misfires in production.
#   - RESOLVE: apply per-student overrides to BOTH the gate and the push.
describe "New Quizzes Availability & Timing Integration" do
  include NQAvailabilityTimingHelpers

  it "locks a student out of the launch before the Available From date", guid: "8d4f1b63" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user

    tool = create_nq_tool(course)
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Available From Quiz",
      unlock_at: 1.day.from_now,
      lock_at: 1.week.from_now
    )

    user_session(student)

    # Act
    get "/api/v1/courses/#{course.id}/external_tools/sessionless_launch",
        params: { launch_type: "assessment", assignment_id: assignment.id }

    # Assert
    # Canvas refuses to mint a launch while the quiz is still locked by its
    # unlock_at, so the student can never reach New Quizzes before it opens.
    # An authenticated-but-locked-out student is forbidden (403), not 401.
    expect(response).to have_http_status(:forbidden)
  end

  it "locks a student out of the launch after the Until date", guid: "4d7e2b93" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user

    tool = create_nq_tool(course)
    # The quiz opened a week ago, but its Until date has now passed, so it is
    # closed — unlock_at is in the past so only lock_at can lock it here.
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Until Date Quiz",
      unlock_at: 1.week.ago,
      lock_at: 1.day.ago
    )

    user_session(student)

    # Act
    get "/api/v1/courses/#{course.id}/external_tools/sessionless_launch",
        params: { launch_type: "assessment", assignment_id: assignment.id }

    # Assert
    # Once lock_at (the Until date) has passed the quiz is closed, so Canvas will
    # not mint a launch — exercising locked_for?'s lock_at branch, distinct from
    # the unlock_at branch above. New Quizzes uses this same lock_at to
    # auto-submit any session still open when the deadline arrives.
    expect(response).to have_http_status(:forbidden)
  end

  it "pushes the student's effective unlock, lock, and due dates to the launch", guid: "9b3e7d52" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user

    tool = create_nq_tool(course)
    unlock_at = 1.day.ago
    due_at = 2.days.from_now
    lock_at = 5.days.from_now
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Effective Dates Quiz",
      unlock_at:,
      due_at:,
      lock_at:
    )

    user_session(student)

    # Act
    get "/api/v1/courses/#{course.id}/external_tools/sessionless_launch",
        params: { launch_type: "assessment", assignment_id: assignment.id }

    # Assert
    # The open quiz launches, and Canvas hands New Quizzes the full set of
    # effective dates it relies on: unlock_at (its lock window), lock_at (the
    # auto-submit deadline and session cap), and due_at. lock_at is the hard
    # cap and must stay distinct from the softer due_at — conflating them would
    # cap sessions at the wrong time.
    expect(response).to have_http_status(:ok)

    tool_settings = read_launch_tool_settings(course, response.parsed_body["url"])
    expect(Time.zone.parse(tool_settings["custom_canvas_assignment_unlock_at"]))
      .to be_within(1.second).of(unlock_at)
    expect(Time.zone.parse(tool_settings["custom_canvas_assignment_lock_at"]))
      .to be_within(1.second).of(lock_at)
    expect(Time.zone.parse(tool_settings["custom_canvas_assignment_due_at"]))
      .to be_within(1.second).of(due_at)
    expect(tool_settings["custom_canvas_assignment_lock_at"])
      .not_to eq(tool_settings["custom_canvas_assignment_due_at"])
  end

  it "launches a student with their override dates, not the locked base dates", guid: "f2c8a41b" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user

    tool = create_nq_tool(course)
    # Base assignment is still locked for everyone (unlock_at in the future)...
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Differentiated Quiz",
      unlock_at: 1.week.from_now,
      lock_at: 2.weeks.from_now
    )
    # ...but this student has an override that opens the quiz now and runs it
    # to a later Until date.
    override_unlock_at = 1.day.ago
    override_lock_at = 3.days.from_now
    override = assignment.assignment_overrides.create!(
      title: "Extended student",
      set_type: "ADHOC",
      unlock_at_overridden: true,
      lock_at_overridden: true,
      unlock_at: override_unlock_at,
      lock_at: override_lock_at
    )
    override.assignment_override_students.create!(user: student)

    user_session(student)

    # Act
    get "/api/v1/courses/#{course.id}/external_tools/sessionless_launch",
        params: { launch_type: "assessment", assignment_id: assignment.id }

    # Assert
    # The override unlocks the quiz for this student even though the base dates
    # would lock everyone out (gate honors the override), and the launch carries
    # the student's overridden dates (push honors the override). The two must
    # agree — gating on the override while pushing base dates would desync Canvas
    # from New Quizzes.
    expect(response).to have_http_status(:ok)

    tool_settings = read_launch_tool_settings(course, response.parsed_body["url"])
    expect(Time.zone.parse(tool_settings["custom_canvas_assignment_unlock_at"]))
      .to be_within(1.second).of(override_unlock_at)
    expect(Time.zone.parse(tool_settings["custom_canvas_assignment_lock_at"]))
      .to be_within(1.second).of(override_lock_at)
  end

  it "pushes a section override's lock date in place of the base lock date", guid: "f2c8a41b" do
    # Arrange
    course = course_factory(active_all: true)
    section = course.course_sections.create!(name: "Early-close Section")
    student = user_factory(active_all: true)
    course.enroll_student(student, section:, enrollment_state: "active")

    tool = create_nq_tool(course)
    # The quiz is open for everyone now; the base Until date is far out...
    base_lock_at = 10.days.from_now
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Section Override Quiz",
      unlock_at: 1.day.ago,
      lock_at: base_lock_at
    )
    # ...but this student's section closes much sooner.
    section_lock_at = 2.days.from_now
    assignment.assignment_overrides.create!(
      set: section,
      lock_at_overridden: true,
      lock_at: section_lock_at
    )

    user_session(student)

    # Act
    get "/api/v1/courses/#{course.id}/external_tools/sessionless_launch",
        params: { launch_type: "assessment", assignment_id: assignment.id }

    # Assert
    # Canvas resolves the date per student: the launch carries this section's
    # earlier lock_at, not the base lock_at that students without the override
    # would receive. Sending the base date here would let New Quizzes run the
    # section's sessions days past their real deadline.
    expect(response).to have_http_status(:ok)

    tool_settings = read_launch_tool_settings(course, response.parsed_body["url"])
    pushed_lock_at = Time.zone.parse(tool_settings["custom_canvas_assignment_lock_at"])
    expect(pushed_lock_at).to be_within(1.second).of(section_lock_at)
    expect(pushed_lock_at).to be < base_lock_at
  end

  it "carries the student's override dates on the native launch, not the locked base dates", guid: "f2c8a41b" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user
    course.enable_feature!(:new_quizzes_native_experience)

    tool = create_nq_tool(course)
    # Base assignment is still locked for everyone (unlock_at in the future)...
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Native Differentiated Quiz",
      unlock_at: 1.week.from_now,
      lock_at: 2.weeks.from_now
    )
    # ...but this student has an override that opens the quiz now, gives them a
    # later due date, and runs it to a later Until date.
    override_unlock_at = 1.day.ago
    override_due_at = 2.days.from_now
    override_lock_at = 3.days.from_now
    override = assignment.assignment_overrides.create!(
      title: "Extended student",
      set_type: "ADHOC",
      unlock_at_overridden: true,
      due_at_overridden: true,
      lock_at_overridden: true,
      unlock_at: override_unlock_at,
      due_at: override_due_at,
      lock_at: override_lock_at
    )
    override.assignment_override_students.create!(user: student)

    user_session(student)

    # Act
    get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

    # Assert
    expect(response).to have_http_status(:ok)

    params = read_native_launch_params(response)
    expect(Time.zone.parse(params["custom_canvas_assignment_unlock_at"]))
      .to be_within(1.second).of(override_unlock_at)
    expect(Time.zone.parse(params["custom_canvas_assignment_due_at"]))
      .to be_within(1.second).of(override_due_at)
    expect(Time.zone.parse(params["custom_canvas_assignment_lock_at"]))
      .to be_within(1.second).of(override_lock_at)
  end

  it "pushes the student's effective unlock, lock, and due dates to the native launch", guid: "9b3e7d52" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user
    course.enable_feature!(:new_quizzes_native_experience)

    tool = create_nq_tool(course)
    unlock_at = 1.day.ago
    due_at = 2.days.from_now
    lock_at = 5.days.from_now
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Native Effective Dates Quiz",
      unlock_at:,
      due_at:,
      lock_at:
    )

    user_session(student)

    # Act
    get "/courses/#{course.id}/assignments/#{assignment.id}/launch"

    # Assert
    expect(response).to have_http_status(:ok)

    params = read_native_launch_params(response)
    expect(Time.zone.parse(params["custom_canvas_assignment_unlock_at"]))
      .to be_within(1.second).of(unlock_at)
    expect(Time.zone.parse(params["custom_canvas_assignment_lock_at"]))
      .to be_within(1.second).of(lock_at)
    expect(Time.zone.parse(params["custom_canvas_assignment_due_at"]))
      .to be_within(1.second).of(due_at)
    expect(params["custom_canvas_assignment_lock_at"])
      .not_to eq(params["custom_canvas_assignment_due_at"])
  end

  it "blocks a locked-out student from the native quiz-taking launch", guid: "8d4f1b63" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user
    course.enable_feature!(:new_quizzes_native_experience)

    tool = create_nq_tool(course)
    # No override: the quiz is still locked for this student by a future
    # Available From date.
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Native Locked Quiz",
      unlock_at: 1.week.from_now,
      lock_at: 2.weeks.from_now
    )

    user_session(student)

    # Act
    get "/courses/#{course.id}/assignments/#{assignment.id}/taking"

    # Assert
    # The native lock gate is enforced only on the /taking path, not /launch
    # (assignment_locked_for_student?), so a locked student gets no launch.
    expect(response).to have_http_status(:unauthorized)
    expect(read_native_launch_params(response)).to be_empty
  end

  it "blocks a student from the native quiz-taking launch after the Until date", guid: "4d7e2b93" do
    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user
    course.enable_feature!(:new_quizzes_native_experience)

    tool = create_nq_tool(course)
    # The quiz opened a week ago, but its Until date has now passed, so it is
    # closed — unlock_at is in the past so only lock_at can lock it here.
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Native Until Date Quiz",
      unlock_at: 1.week.ago,
      lock_at: 1.day.ago
    )

    user_session(student)

    # Act
    get "/courses/#{course.id}/assignments/#{assignment.id}/taking"

    # Assert
    expect(response).to have_http_status(:unauthorized)
    expect(read_native_launch_params(response)).to be_empty
  end

  it "does not launch a locked New Quiz from the grades-page submission preview", guid: "8d4f1b63" do
    skip("2026-06-22 EVAL-6355's show_preview lock guard was reverted under EVAL-6363 " \
         "and not re-landed on master; the grades-page preview path is currently " \
         "unprotected. Restore the locked_for? check in show_preview.html.erb, then un-skip.")

    # Arrange
    student_enrollment = course_with_student(active_all: true)
    course = student_enrollment.course
    student = student_enrollment.user

    tool = create_nq_tool(course)
    # Quiz is locked for the student by a future Available From date.
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Locked Quiz",
      unlock_at: 1.week.from_now,
      lock_at: 2.weeks.from_now
    )
    seed_nq_submission(assignment:, user: student, tool:, submitted_at: nil, workflow_state: "unsubmitted")

    user_session(student)

    # Act
    get "/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: { preview: 1 }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.body).not_to match(/HTTP-EQUIV=.REFRESH/i)
    expect(response.body).not_to include(tool.url)
    expect(response.body).to include("This assignment is locked until")
  end

  it "lets a teacher launch a quiz that has not opened for students yet", guid: "8d4f1b63" do
    # Arrange
    teacher_enrollment = course_with_teacher(active_all: true)
    course = teacher_enrollment.course
    teacher = teacher_enrollment.user

    tool = create_nq_tool(course)
    assignment = create_nq_assignment(
      course,
      tool,
      title: "NQ Not-Yet-Open Quiz",
      unlock_at: 1.week.from_now,
      lock_at: 2.weeks.from_now
    )

    user_session(teacher)

    # Act
    get "/api/v1/courses/#{course.id}/external_tools/sessionless_launch",
        params: { launch_type: "assessment", assignment_id: assignment.id }

    # Assert
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["url"]).to be_present
  end
end

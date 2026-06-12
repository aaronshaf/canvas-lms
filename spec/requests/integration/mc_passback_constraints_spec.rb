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

# Mastery Connect passes grades back to a linked Canvas course via the Canvas
# REST Submissions API (see mc_grade_passback_spec.rb for the base contract).
# These tests cover the *constraints* on that passback at the Canvas boundary.
#
# The boundary truth that shapes this file: Canvas has no concept of an MC
# "tracker" or its link state. Linking, unlinking, and moving a tracker are all
# mc-mothership operations. What Canvas exposes is the plain Submissions API PUT
# and the Assignments API DELETE that mc-mothership drives as the teacher's
# Bearer token. So the only passback constraints observable here are the ones
# Canvas itself computes (late status) or performs (assignment deletion); a
# constraint enforced by mc-mothership severing its own channel is not visible
# at this boundary and is documented as such, not asserted as Canvas behavior.
describe "Mastery Connect Passback Constraints" do
  include MCPassbackHelpers

  it "MC score posted after the due date is marked late in the Canvas gradebook", guid: "6e2b8d4f" do
    # Arrange
    course, tool, token = setup_mc_passback_course
    student = student_in_course(course:, active_all: true).user
    mc_pct = 80 # MC posts a percentage; Canvas scales it onto the 100-point assignment.
    # Due date is already in the past and the student never completed the
    # assessment, so the submission's cached_due_date predates the passback.
    assignment = create_mc_assignment(course, tool, due_at: 1.week.ago)

    # Act — MC scores the student after the due date. submission_type
    # "basic_lti_launch" stamps submitted_at at this (post-due) moment.
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "#{mc_pct}%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert — the score lands in the gradebook and Canvas flags it late
    # because the passback (submitted_at) falls after the due date.
    expect(response).to have_http_status(:ok)

    body = response.parsed_body
    expect(body["score"]).to eql(mc_pct.to_f)
    expect(body["grade"]).to eq(mc_pct.to_s)
    expect(body["workflow_state"]).to eq("graded")
    expect(body["late"]).to be(true)

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to eql(mc_pct.to_f)
    expect(submission.workflow_state).to eq("graded")
    expect(submission.submission_type).to eq("basic_lti_launch")
    expect(submission.late?).to be(true)
  end

  it "remove-content unlink deletes the assignment and drops its grades from the gradebook", guid: "73f1a6c9" do
    # Arrange
    course, tool, token, grader = setup_mc_passback_course
    enrollment = student_in_course(course:, active_all: true)
    student = enrollment.user
    existing_pct = 80
    assignment = create_mc_assignment(course, tool)
    # A prior MC passback already graded this student, so the assignment is the
    # only thing driving their course grade.
    assignment.grade_student(student, grade: "#{existing_pct}%", grader:)
    expect(enrollment.reload.computed_current_score).to eql(existing_pct.to_f)

    # Act — the "unlink tracker and remove content" path: mc-mothership deletes
    # the Canvas assignment it created (one DELETE per assessment).
    delete "/api/v1/courses/#{course.id}/assignments/#{assignment.id}",
           headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert — the assignment leaves the course's active list and its grade no
    # longer counts toward the student's course grade.
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["id"]).to eq(assignment.id)
    expect(response.parsed_body["workflow_state"]).to eq("deleted")
    expect(assignment.reload.workflow_state).to eq("deleted")
    expect(course.active_assignments.reload).not_to include(assignment)
    expect(enrollment.reload.computed_current_score).to be_nil
  end

  # Negative control covering the "preserve-content unlink" and "tracker moved
  # to another course" scenarios (MC-3.2 / MC-3.4 / MC-3.5). Both are
  # mc-mothership operations with no Canvas counterpart: unlinking or moving a
  # tracker changes nothing in Canvas, so the assignment and its grades persist
  # and a later passback is indistinguishable from any other teacher grade. This
  # pins that Canvas has no boundary mechanism to stop passback after an unlink
  # or move — that severance lives entirely in mc-mothership.
  it "still accepts passback to an assignment whose tracker was unlinked or moved", guid: "9c1a5f73" do
    # Arrange
    course, tool, token, grader = setup_mc_passback_course
    enrollment = student_in_course(course:, active_all: true)
    student = enrollment.user
    existing_pct = 50
    new_pct = 90
    assignment = create_mc_assignment(course, tool)
    # An earlier MC passback graded the student while the tracker was linked.
    assignment.grade_student(student, grade: "#{existing_pct}%", grader:)
    # The teacher then unlinks (preserve content) or moves the tracker. Canvas
    # has no tracker concept, so nothing here changes: the assignment stays in
    # the active list and the prior grade stays in the gradebook.
    expect(course.active_assignments.reload).to include(assignment)
    expect(enrollment.reload.computed_current_score).to eql(existing_pct.to_f)

    # Act — mc-mothership posts a fresh score the way it always does. If
    # severance were a Canvas guarantee, this would be rejected; it is not.
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: {
          submission: {
            posted_grade: "#{new_pct}%",
            submission_type: "basic_lti_launch",
            url: tool.url
          }
        },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert — Canvas accepts the new score with no awareness of the unlink or
    # move, and the assignment remains active. Stopping passback is therefore
    # mc-mothership's responsibility, not a Canvas-boundary protection.
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["score"]).to eql(new_pct.to_f)

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to eql(new_pct.to_f)
    expect(submission.workflow_state).to eq("graded")
    expect(course.active_assignments.reload).to include(assignment)
  end
end

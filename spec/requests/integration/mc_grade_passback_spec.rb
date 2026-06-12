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
# REST Submissions API, not LTI 1.1 replaceResult. For a linked tracker + Canvas
# course + SIS-synced student, the mc-mothership Lms::ScorePostback::CanvasSubmission
# strategy scores via:
#   PUT /api/v1/courses/:cid/assignments/:aid/submissions/:uid
#   submission: { posted_grade: "<pct>%", submission_type: "basic_lti_launch", url: <launch> }
# MC creates its Canvas assignments as grading_type 'points' (see mc-mothership
# Lms::Canvas::AssignmentSerializer) and posts a percentage string, which Canvas
# scales against points_possible — so a "<pct>%" passback lands as a point grade.
#
# These tests cover only the Canvas-side contract of that passback: they issue
# the same plain Submissions API PUT mc-mothership makes, authenticated as the
# teacher's Bearer token. MC-specific auth/scoping, and MC's own auto-publish
# and bulk fan-out (one Sidekiq job per student), live in mc-mothership and are
# out of scope here.
describe "Mastery Connect Grade Passback" do
  include MCPassbackHelpers

  it "MC score on a published assessment appears in the Canvas gradebook", guid: "3a7f1c4e" do
    # Arrange
    course, tool, token = setup_mc_passback_course
    student = student_in_course(course:, active_all: true).user
    assignment = create_mc_assignment(course, tool)

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

    # Assert — MC posts "80%"; Canvas scales it onto the 100-point assignment.
    expect(response).to have_http_status(:ok)

    body = response.parsed_body
    expect(body["score"]).to be(80.0)
    expect(body["grade"]).to eq("80")
    expect(body["workflow_state"]).to eq("graded")

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(80.0)
    expect(submission.grade).to eq("80")
    expect(submission.workflow_state).to eq("graded")
    expect(submission.submission_type).to eq("basic_lti_launch")
    expect(submission.url).to eq(tool.url)
  end

  it "MC re-score overwrites the prior grade in the Canvas gradebook", guid: "8b2e5d91" do
    # Arrange
    course, tool, token, teacher = setup_mc_passback_course
    student = student_in_course(course:, active_all: true).user
    assignment = create_mc_assignment(course, tool)

    # A prior MC passback already graded this submission at 50 points.
    prior_submission = assignment.submissions.find_or_create_by!(user: student)
    prior_submission.update!(
      submission_type: "basic_lti_launch",
      url: tool.url,
      grade: "50",
      score: 50,
      workflow_state: "graded",
      grader: teacher,
      submitted_at: 1.hour.ago,
      posted_at: 1.hour.ago
    )

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

    body = response.parsed_body
    expect(body["score"]).to be(90.0)
    expect(body["grade"]).to eq("90")
    expect(body["workflow_state"]).to eq("graded")

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(90.0)
    expect(submission.grade).to eq("90")
    expect(submission.workflow_state).to eq("graded")
    expect(submission.submission_type).to eq("basic_lti_launch")
  end

  it "MC scores every enrolled student and each grade rolls up into the course grade", guid: "5c4a9f72" do
    # Arrange
    course, tool, token = setup_mc_passback_course
    assignment = create_mc_assignment(course, tool)

    # A cohort with distinct target percentages, so each student's grade is
    # individually verifiable across the batch. MC has no bulk grade endpoint;
    # it scores a class by posting one percentage per enrolled student.
    cohort = {
      student_in_course(course:, active_all: true) => 60,
      student_in_course(course:, active_all: true) => 70,
      student_in_course(course:, active_all: true) => 80
    }

    # Act — MC posts each enrolled student's score.
    cohort.each do |enrollment, pct|
      put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{enrollment.user_id}",
          params: {
            submission: {
              posted_grade: "#{pct}%",
              submission_type: "basic_lti_launch",
              url: tool.url
            }
          },
          headers: { "Authorization" => "Bearer #{token.full_token}" }
      expect(response).to have_http_status(:ok)
    end

    # Assert — every student's score lands in the gradebook and, since this is
    # the course's only assignment (100 pts), rolls up to that same percentage
    # as their Canvas course grade. (computed_current_score relies on Canvas's
    # inline grade recomputation on grade_student.)
    cohort.each do |enrollment, pct| # rubocop:disable Style/CombinableLoops -- keep the Act (post scores) and Assert (verify rollups) phases separate
      submission = assignment.submissions.find_by(user_id: enrollment.user_id)
      submission.reload
      expect(submission.score).to eql(pct.to_f)
      expect(submission.workflow_state).to eq("graded")
      expect(enrollment.reload.computed_current_score).to eql(pct.to_f)
    end
  end

  it "MC item-based score is rejected until the teacher publishes the assignment", guid: "7f6c2a4d" do
    # Arrange
    course, tool, token = setup_mc_passback_course
    student = student_in_course(course:, active_all: true).user
    # Item-based assessments arrive unpublished; this simulates the unpublished
    # state Mastery Connect would auto-create.
    assignment = create_mc_assignment(course, tool, workflow_state: "unpublished", title: "MC Item-Based Assessment")
    expect(assignment.unpublished?).to be(true)

    grade_path = "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}"
    grade_params = {
      submission: {
        posted_grade: "75%",
        submission_type: "basic_lti_launch",
        url: tool.url
      }
    }
    auth = { "Authorization" => "Bearer #{token.full_token}" }

    # Act 1 — MC tries to score while the assignment is still unpublished.
    put grade_path, params: grade_params, headers: auth

    # Assert — Canvas rejects the grade; nothing lands in the gradebook.
    expect(response).to have_http_status(:forbidden)
    expect(assignment.submissions.find_by(user: student)&.score).to be_nil

    # The teacher manually publishes the assignment, opening the gate.
    assignment.publish!
    expect(assignment.published?).to be(true)

    # Act 2 — MC re-posts the same score now that it is published.
    put grade_path, params: grade_params, headers: auth

    # Assert — the score now flows into the gradebook.
    expect(response).to have_http_status(:ok)

    body = response.parsed_body
    expect(body["score"]).to be(75.0)
    expect(body["grade"]).to eq("75")
    expect(body["workflow_state"]).to eq("graded")

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(75.0)
    expect(submission.grade).to eq("75")
    expect(submission.workflow_state).to eq("graded")
    expect(submission.submission_type).to eq("basic_lti_launch")
  end

  it "MC score on a Mastery-aligned graded discussion appears in the Canvas gradebook", guid: "e9a47b13" do
    # Arrange
    course, _tool, token = setup_mc_passback_course
    student = student_in_course(course:, active_all: true).user

    # A graded discussion is a DiscussionTopic backed by a 'discussion_topic' assignment.
    # In the real scenario this discussion is aligned to a Mastery Connect standard
    # (a LearningOutcome), but that alignment has no bearing on the grade-passback
    # contract under test: a plain posted_grade records a score, it does not produce
    # a LearningOutcomeResult (those come only from rubric assessments). The outcome
    # setup is therefore omitted as it would be unasserted dead state.
    topic = graded_discussion_topic(context: course)
    assignment = topic.assignment
    assignment.update!(points_possible: 100)
    expect(assignment.published?).to be(true)

    # Act
    put "/api/v1/courses/#{course.id}/assignments/#{assignment.id}/submissions/#{student.id}",
        params: { submission: { posted_grade: "88%" } },
        headers: { "Authorization" => "Bearer #{token.full_token}" }

    # Assert
    expect(response).to have_http_status(:ok)

    body = response.parsed_body
    expect(body["score"]).to be(88.0)
    expect(body["grade"]).to eq("88")
    expect(body["workflow_state"]).to eq("graded")

    submission = assignment.submissions.find_by(user: student)
    expect(submission.reload.score).to be(88.0)
    expect(submission.grade).to eq("88")
    expect(submission.workflow_state).to eq("graded")
  end
end

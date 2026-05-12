# frozen_string_literal: true

#
# Copyright (C) 2022 - present Instructure, Inc.
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
#

require_relative "../graphql_spec_helper"

RSpec.describe Mutations::UpdateSubmissionGrade do
  def mutation_str(submission_id: nil, score: nil)
    <<~GQL
      mutation {
        updateSubmissionGrade(input: {submissionId: #{submission_id}, score: #{score}}) {
          submission {
            _id
            id
            grade
            score
            user {
              _id
              id
              name
            }
          }
          parentAssignmentSubmission {
            _id
            id
            grade
            score
          }
          errors {
            attribute
            message
          }
        }
      }
    GQL
  end

  def run_mutation(opts = {}, current_user = @teacher)
    super(opts, current_user:, domain_root_account: @course.account.root_account)
  end

  before(:once) do
    @account = Account.create!
    @course = @account.courses.create!
    @teacher = @course.enroll_teacher(User.create!, enrollment_state: "active").user
    @student = @course.enroll_student(User.create!, enrollment_state: "active").user
    @assignment = @course.assignments.create!(title: "Example Assignment")
    @submission = @assignment.submit_homework(
      @student,
      submission_type: "online_text_entry",
      body: "body"
    )
    @student_comment = @submission.submission_comments.create!(author: @student, comment: "whats up")
    @teacher_comment = @submission.submission_comments.create!(author: @teacher, comment: "teachers whats up")
  end

  it "updates grade to 12" do
    result = run_mutation({ submission_id: @submission.id, score: 12 })
    expect(result.dig("data", "updateSubmissionGrade", "errors")).to be_nil
    expect(result.dig("data", "updateSubmissionGrade", "submission")).to include({ _id: @submission.id.to_s })
    @submission.reload
    expect(@submission.score).to eq 12
  end

  it "user should not have access to grade" do
    result = run_mutation({ submission_id: @submission.id, score: 12 }, @student)
    errors = result.dig("data", "updateSubmissionGrade", "errors")
    expect(result.dig("data", "updateSubmissionGrade", "submission")).to be_nil
    expect(errors).not_to be_nil
    @submission.reload
    expect(@submission.score).to be_nil
    expect(errors[0][:message]).to eq "Not authorized to score Submission"
  end

  it "does not leak existence of submissions across courses" do
    other_account = Account.create!
    other_course = other_account.courses.create!
    other_student = other_course.enroll_student(User.create!, enrollment_state: "active").user
    other_assignment = other_course.assignments.create!(title: "Foreign Assignment")
    foreign_submission = other_assignment.submit_homework(
      other_student,
      submission_type: "online_text_entry",
      body: "body"
    )

    nonexistent_id = Submission.maximum(:id).to_i + 1_000_000

    foreign_result = run_mutation({ submission_id: foreign_submission.id, score: 12 }, @student)
    missing_result = run_mutation({ submission_id: nonexistent_id, score: 12 }, @student)

    expect(foreign_result).to eq(missing_result)
    expect(foreign_result.dig("data", "updateSubmissionGrade", "submission")).to be_nil
    expect(foreign_result["errors"]).to be_nil

    payload_errors = foreign_result.dig("data", "updateSubmissionGrade", "errors")
    expect(payload_errors).not_to be_nil
    expect(payload_errors[0][:attribute]).to eq "submissionId"
    expect(payload_errors[0][:attribute]).not_to eq foreign_submission.id.to_s
  end

  it "results should not include parent assignment submission if checkpoints are disabled" do
    result = run_mutation({ submission_id: @submission.id, score: 9 })
    expect(result.dig("data", "updateSubmissionGrade", "errors")).to be_nil
    expect(result.dig("data", "updateSubmissionGrade", "parentAssignmentSubmission")).to be_nil
  end

  context "when submission is for a child assignment" do
    before(:once) do
      @parent_assignment = @course.assignments.create!(title: "Parent Assignment", has_sub_assignments: true)
      @parent_assignment.course.account.enable_feature!(:discussion_checkpoints)

      @reply_to_topic = SubAssignment.new(
        name: "Reply to Topic",
        sub_assignment_tag: CheckpointLabels::REPLY_TO_TOPIC,
        points_possible: 10,
        due_at: 3.days.from_now,
        only_visible_to_overrides: false,
        context: @course,
        parent_assignment: @parent_assignment
      )

      @reply_to_topic.save!

      # Need to add a submission to the "Reply To Topic" sub assignment
      @sub_assignment_submission = @reply_to_topic.submit_homework(
        @student,
        submission_type: "discussion_topic",
        body: "body"
      )
    end

    it "results should include parent assignment submission" do
      result = run_mutation({ submission_id: @sub_assignment_submission.id, score: 9 })
      parent_submission = Submission.find_by(assignment_id: @parent_assignment.id, user_id: @student.id)

      expect(result.dig("data", "updateSubmissionGrade", "errors")).to be_nil
      expect(result.dig("data", "updateSubmissionGrade", "parentAssignmentSubmission")).to include({
                                                                                                     _id: parent_submission.id.to_s,
                                                                                                     score: 9.0,
                                                                                                     grade: "9"
                                                                                                   })
    end
  end
end

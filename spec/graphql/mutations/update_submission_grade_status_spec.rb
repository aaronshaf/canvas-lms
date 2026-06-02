# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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
  def mutation_str(submission_id: nil, late_policy_status: nil, custom_grade_status_id: nil, seconds_late_override: nil)
    late_policy_status = late_policy_status ? "\"#{late_policy_status}\"" : "null"
    custom_grade_status_id = custom_grade_status_id ? "\"#{custom_grade_status_id}\"" : "null"
    seconds_late_override_str = seconds_late_override.nil? ? "" : "secondsLateOverride: #{seconds_late_override}"
    <<~GQL
      mutation {
        updateSubmissionGradeStatus(
          input: {
            submissionId: #{submission_id}
            latePolicyStatus: #{late_policy_status}
            customGradeStatusId: #{custom_grade_status_id}
            #{seconds_late_override_str}
          }
        ) {
          submission {
            _id
            id
            userId
            assignmentId
            gradingStatus
            latePolicyStatus
            customGradeStatus
            excused
            deductedPoints
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
    super(opts, current_user:)
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
  end

  it "can update a submission grade status" do
    result = run_mutation({ submission_id: @submission.id, late_policy_status: "late", custom_grade_status_id: nil })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to eq "late"
  end

  it "can update a submission grade status with custom grade status" do
    custom_grade_status = CustomGradeStatus.create!(name: "custom", color: "#000000", root_account_id: @course.root_account, created_by: @teacher)
    result = run_mutation({ submission_id: @submission.id, custom_grade_status_id: custom_grade_status.id })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq custom_grade_status.name.to_s
  end

  it "user should not have access to grade" do
    result = run_mutation({ submission_id: @submission.id, late_policy_status: "late", custom_grade_status_id: nil }, @student)
    expect(result[:data][:updateSubmissionGradeStatus][:submission]).to be_nil
    expect(result[:data][:updateSubmissionGradeStatus][:errors]).to include({ attribute: @submission.id.to_s, message: "Not authorized to set submission status" })
  end

  it "set status to extended" do
    result = run_mutation({ submission_id: @submission.id, late_policy_status: "extended", custom_grade_status_id: nil })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to eq "extended"
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq ""
  end

  it "set status to nil if none" do
    result = run_mutation({ submission_id: @submission.id, late_policy_status: "none", custom_grade_status_id: nil })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to eq "none"
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq ""
  end

  it "sets status and custom id to nil if no status is provided or custom id is provided" do
    result = run_mutation({ submission_id: @submission.id, late_policy_status: nil, custom_grade_status_id: nil })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to be_nil
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq ""
  end

  it "sets excused status" do
    result = run_mutation({ submission_id: @submission.id, late_policy_status: "excused", custom_grade_status_id: nil })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to be_nil
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq ""
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:excused]).to be true
  end

  it "overwrites excused with no status" do
    @submission.update!(excused: true)
    result = run_mutation({ submission_id: @submission.id, late_policy_status: "none", custom_grade_status_id: nil })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to eq "none"
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq ""
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:excused]).to be false
  end

  it "overwrites excused with custom grade status" do
    @submission.update!(excused: true)
    custom_grade_status = CustomGradeStatus.create!(name: "custom", color: "#000000", root_account_id: @course.root_account, created_by: @teacher)
    result = run_mutation({ submission_id: @submission.id, custom_grade_status_id: custom_grade_status.id })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to be_nil
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq custom_grade_status.name.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:excused]).to be false
  end

  it "overwrites excused with late policy status" do
    @submission.update!(excused: true)
    result = run_mutation({ submission_id: @submission.id, late_policy_status: "late", custom_grade_status_id: nil })
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:latePolicyStatus]).to eq "late"
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq ""
    expect(result[:data][:updateSubmissionGradeStatus][:submission][:excused]).to be false
  end

  describe "custom_grade_status root_account scoping" do
    it "rejects a custom_grade_status_id from a different root_account" do
      foreign_account = Account.create!
      foreign_status = CustomGradeStatus.create!(name: "foreign", color: "#000000", root_account_id: foreign_account.id, created_by: @teacher)
      result = run_mutation({ submission_id: @submission.id, custom_grade_status_id: foreign_status.id })
      expect(result[:data][:updateSubmissionGradeStatus][:submission]).to be_nil
      expect(result[:data][:updateSubmissionGradeStatus][:errors]).to be_present
      expect(@submission.reload.custom_grade_status_id).to be_nil
    end

    it "rejects a nonexistent custom_grade_status_id" do
      result = run_mutation({ submission_id: @submission.id, custom_grade_status_id: 999_999_999 })
      expect(result[:data][:updateSubmissionGradeStatus][:submission]).to be_nil
      expect(result[:data][:updateSubmissionGradeStatus][:errors]).to be_present
    end

    it "rejects a soft-deleted same-account custom_grade_status_id" do
      status = CustomGradeStatus.create!(name: "going away", color: "#000000", root_account_id: @course.root_account, created_by: @teacher)
      status.update!(workflow_state: "deleted", deleted_by: @teacher)
      result = run_mutation({ submission_id: @submission.id, custom_grade_status_id: status.id })
      expect(result[:data][:updateSubmissionGradeStatus][:submission]).to be_nil
      expect(result[:data][:updateSubmissionGradeStatus][:errors]).to be_present
    end

    it "accepts a same-root-account custom_grade_status_id supplied as a Switchman global id" do
      # GraphQL ID input may arrive as a Switchman global id rather than a
      # shard-local id. find_by(id:) on a Switchman-aware association must
      # translate the global id back to the local row. A genuine cross-shard
      # CustomGradeStatus is not constructable (FK on root_account_id is
      # shard-local); this exercises the global-id translation path on the
      # same shard.
      status = CustomGradeStatus.create!(name: "global", color: "#111111", root_account_id: @course.root_account, created_by: @teacher)
      result = run_mutation({ submission_id: @submission.id, custom_grade_status_id: status.global_id })
      expect(result[:data][:updateSubmissionGradeStatus][:submission][:_id]).to eq @submission.id.to_s
      expect(result[:data][:updateSubmissionGradeStatus][:submission][:customGradeStatus]).to eq "global"
    end
  end

  describe "secondsLateOverride (EVAL-6420)" do
    before(:once) do
      @course.create_late_policy!(
        late_submission_deduction_enabled: true,
        late_submission_deduction: 10.0,
        late_submission_interval: "day"
      )
      @late_assignment = @course.assignments.create!(
        title: "Late Policy Assignment",
        points_possible: 10,
        due_at: 2.days.ago,
        submission_types: "online_text_entry"
      )
      @late_submission = @late_assignment.submit_homework(
        @student,
        submission_type: "online_text_entry",
        body: "submitted late"
      )
      @late_assignment.grade_student(@student, grader: @teacher, score: 10)
      @late_submission.reload
    end

    it "applies late deduction when secondsLateOverride is provided with late status" do
      result = run_mutation({
                              submission_id: @late_submission.id,
                              late_policy_status: "late",
                              seconds_late_override: 86_400 # 1 day
                            })
      submission_data = result[:data][:updateSubmissionGradeStatus][:submission]
      expect(submission_data[:latePolicyStatus]).to eq "late"
      expect(submission_data[:deductedPoints]).to eq 1.0
      expect(submission_data[:score]).to eq 9.0
    end

    it "does not apply deduction when secondsLateOverride is not provided" do
      result = run_mutation({
                              submission_id: @late_submission.id,
                              late_policy_status: "late"
                            })
      submission_data = result[:data][:updateSubmissionGradeStatus][:submission]
      expect(submission_data[:latePolicyStatus]).to eq "late"
      expect(submission_data[:deductedPoints]).to eq 0.0
      expect(submission_data[:score]).to eq 10.0
    end

    it "ignores secondsLateOverride for non-late statuses" do
      result = run_mutation({
                              submission_id: @late_submission.id,
                              late_policy_status: "missing",
                              seconds_late_override: 86_400
                            })
      submission_data = result[:data][:updateSubmissionGradeStatus][:submission]
      expect(submission_data[:latePolicyStatus]).to eq "missing"
      expect(submission_data[:score]).to eq 10.0
    end
  end
end

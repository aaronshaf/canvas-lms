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

class Mutations::UpdateSubmissionGradeStatus < Mutations::BaseMutation
  graphql_name "UpdateSubmissionsGradeStatus"

  argument :checkpoint_tag, String, required: false
  argument :custom_grade_status_id, ID, required: false
  argument :late_policy_status, String, required: false
  argument :seconds_late_override, Integer, required: false
  argument :submission_id, ID, required: true

  field :submission, Types::SubmissionType, null: true
  def resolve(input:)
    submission = Submission.find(input[:submission_id])
    if input[:checkpoint_tag].present? && submission.course.discussion_checkpoints_enabled?
      submission = submission.effective_checkpoint_submission(input[:checkpoint_tag])
    end

    return { errors: { submission.id => "Not authorized to set submission status" } } unless submission.grants_right?(current_principal, :grade)

    if input[:custom_grade_status_id]
      status = submission.root_account.custom_grade_statuses.active.find_by(id: input[:custom_grade_status_id])
      return { errors: { submission.id => "Invalid custom grade status" } } if status.nil?

      submission.update(custom_grade_status: status, grader: current_user)
    elsif input[:late_policy_status] && input[:late_policy_status] != "none"
      if input[:late_policy_status] == "excused"
        submission.assignment.grade_student(
          submission.user,
          {
            grader: current_user,
            excused: true,
          }
        )
        submission.reload
      else
        attrs = { late_policy_status: input[:late_policy_status], grader: current_user }
        attrs[:seconds_late_override] = input[:seconds_late_override] if input[:late_policy_status] == "late" && input[:seconds_late_override].present?
        submission.update(attrs)
      end
    elsif (input[:custom_grade_status_id].nil? && input[:late_policy_status].nil?) || input[:late_policy_status] == "none"
      submission.update(custom_grade_status_id: nil, late_policy_status: input[:late_policy_status], excused: false, grader: current_user)
    end

    { submission: }
  end
end

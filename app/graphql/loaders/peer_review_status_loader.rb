# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

module Loaders
  class PeerReviewStatusLoader < GraphQL::Batch::Loader
    attr_reader :current_principal

    def initialize(assignment_id, current_principal:)
      super()
      @assignment_id = assignment_id
      @current_principal = current_principal
    end

    def perform(user_ids)
      assignment = Assignment.find_by(id: @assignment_id)
      scoped_user_ids = if assignment
                          base_scope = assignment.context.participating_students_by_date.not_fake_student
                          visible_students_subquery = assignment.context.apply_enrollment_visibility(base_scope, current_principal)
                                                                .select("users.*")

                          scope = User.from("(#{visible_students_subquery.to_sql}) AS users").where(id: user_ids)
                          scope = assignment.students_with_visibility(scope, user_ids)
                          scope.pluck(:id)
                        else
                          []
                        end

      must_review_counts = AllocationRule.active
                                         .where(assignment_id: @assignment_id, assessor_id: scoped_user_ids, must_review: true)
                                         .group(:assessor_id)
                                         .count

      completed_reviews_counts = AssessmentRequest.joins(:submission)
                                                  .where(
                                                    assessor_id: scoped_user_ids,
                                                    workflow_state: "completed",
                                                    submissions: { assignment_id: @assignment_id }
                                                  )
                                                  .group(:assessor_id)
                                                  .count

      user_ids.each do |user_id|
        status = {
          must_review_count: must_review_counts[user_id] || 0,
          completed_reviews_count: completed_reviews_counts[user_id] || 0
        }
        fulfill(user_id, status)
      end
    end
  end
end

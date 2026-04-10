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

# Validates that existing peer review sub assignment dates (base dates and override
# dates) remain within the boundaries of the parent assignment's current dates.
# Called when the parent assignment is updated without peer review data, to ensure
# the update doesn't create constraint violations with existing peer review dates.
class PeerReview::DateValidationService < ApplicationService
  include PeerReview::Validations

  def initialize(peer_review_sub_assignment:)
    super()
    @peer_review_sub_assignment = peer_review_sub_assignment
    @parent_assignment = peer_review_sub_assignment&.parent_assignment
  end

  def call
    validate_parent_assignment(@parent_assignment)
    refresh_associations
    validate_base_dates
    validate_override_dates
    true
  end

  private

  # Reloads parent assignment to ensure changes made upstream in the same
  # transaction are visible before validating against parent dates.
  def refresh_associations
    @peer_review_sub_assignment.association(:parent_assignment).reload
    @parent_assignment = @peer_review_sub_assignment.parent_assignment
  end

  def validate_base_dates
    peer_review_dates = {
      due_at: @peer_review_sub_assignment.due_at,
      unlock_at: @peer_review_sub_assignment.unlock_at,
      lock_at: @peer_review_sub_assignment.lock_at
    }.compact

    return if peer_review_dates.empty?

    validate_peer_review_dates_against_parent_assignment(peer_review_dates, @parent_assignment)
  end

  def validate_override_dates
    peer_review_overrides = @peer_review_sub_assignment
                            .assignment_overrides
                            .active
                            .preload(:parent_override)

    peer_review_overrides.each do |pr_override|
      parent_override = pr_override.parent_override
      next unless parent_override

      override_dates = {}
      override_dates[:due_at] = pr_override.due_at if pr_override.due_at_overridden
      override_dates[:unlock_at] = pr_override.unlock_at if pr_override.unlock_at_overridden
      override_dates[:lock_at] = pr_override.lock_at if pr_override.lock_at_overridden

      next if override_dates.empty?

      validate_override_dates_against_parent_override(override_dates, parent_override)
    end
  end
end

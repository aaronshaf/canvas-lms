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

class PeerReview::BulkDateUpdateService < ApplicationService
  include PeerReview::Validations
  include PeerReview::DateOverrider

  def initialize(assignment:, peer_review_data:)
    super()
    @assignment = assignment
    @peer_review_data = peer_review_data
  end

  # Mutates peer_review_sub_assignment and its overrides in memory.
  # Returns true if any dates changed, false otherwise.
  def call
    validate_peer_review_sub_assignment_exists(@assignment)
    peer_review_sub = @assignment.peer_review_sub_assignment
    base_dates_changed = apply_base_dates(peer_review_sub)
    overrides_changed = apply_override_dates(peer_review_sub)
    base_dates_changed || overrides_changed
  end

  private

  def peer_review_dates
    @peer_review_data["all_dates"] || []
  end

  def apply_base_dates(peer_review_sub) # rubocop:disable Naming/PredicateMethod
    base_dates = peer_review_dates.select { |d| d["base"] }
    return false if base_dates.empty?

    peer_review_sub.due_at = base_dates.first["due_at"]
    peer_review_sub.unlock_at = base_dates.first["unlock_at"]
    peer_review_sub.lock_at = base_dates.first["lock_at"]
    peer_review_sub.changed?
  end

  def apply_override_dates(peer_review_sub)
    override_dates = peer_review_dates.reject { |d| d["base"] }
    changed = false

    override_dates.each do |override_data|
      peer_review_override = peer_review_sub.assignment_overrides.detect { |o| o.id == override_data["id"].to_i }
      validate_override_exists(peer_review_override)

      apply_overridden_dates(peer_review_override, {
                               due_at: override_data["due_at"],
                               unlock_at: override_data["unlock_at"],
                               lock_at: override_data["lock_at"]
                             })
      changed = true if peer_review_override.changed?
    end

    changed
  end
end

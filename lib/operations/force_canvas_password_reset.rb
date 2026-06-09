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

module Operations
  # ForceCanvasPasswordReset
  #
  # Sets must_reset_password on every active canvas-auth pseudonym for a
  # root account. Targets the same pseudonyms that Pseudonym#passwordable?
  # returns true for: those with an explicit Canvas authentication provider
  # or a nil provider when canvas authentication is enabled on the account.
  #
  # Example:
  #
  #   Operations::ForceCanvasPasswordReset.new(
  #     root_account: Account.find(123)
  #   ).run_later
  class ForceCanvasPasswordReset < CanvasOperations::RootAccountOperation
    self.progress_tracking = true

    description "Sets must_reset_password on every active canvas-auth pseudonym for a root account"

    argument :root_account,
             type: Account,
             required: true,
             title: "Root Account",
             description: "The root account where password resets should be forced",
             example: "93360000000000001"

    def execute
      GuardRail.activate(:secondary) do
        root_account.shard.activate do
          canvas_ap_ids = root_account.authentication_providers
                                      .active.where(auth_type: "canvas").pluck(:id)

          root_account.pseudonyms.active
                      .where(authentication_provider_id: canvas_ap_ids + [nil])
                      .in_batches(of: 10_000) do |batch|
            GuardRail.activate(:primary) do
              batch.update_all(must_reset_password: true)
            end
          end
        end
      end
    end

    protected

    def job_options
      super.merge(priority: Delayed::HIGH_PRIORITY)
    end
  end
end

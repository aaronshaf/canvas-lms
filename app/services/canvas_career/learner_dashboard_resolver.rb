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

module CanvasCareer
  class LearnerDashboardResolver
    def initialize(user, root_account)
      @user = user
      @root_account = root_account
    end

    def resolve
      return nil unless @root_account.feature_enabled?(:horizon_configurable_learner_dashboard)

      GuardRail.activate(:secondary) do
        RequestCache.cache("learner_dashboard_layout", @user, @root_account) do
          resolve_layout
        end
      end
    end

    private

    def resolve_layout
      return nil if enrollment_account_ids.empty?

      activation = find_nearest_activation
      return nil unless activation

      layout = activation.learner_dashboard_layout
      layout&.active? ? layout : nil
    end

    def find_nearest_activation
      chain_ids = resolution_chain_ids
      return nil if chain_ids.empty?

      activations_by_account = LearnerDashboardActivation
                               .where(account_id: chain_ids)
                               .preload(:learner_dashboard_layout)
                               .index_by(&:account_id)

      chain_ids.each do |account_id|
        return activations_by_account[account_id] if activations_by_account[account_id]
      end

      nil
    end

    def resolution_chain_ids
      chains = account_chains
      return [] if chains.empty?
      return chains.values.first if chains.size == 1

      chains.values.reduce(:&)
    end

    def account_chains
      @account_chains ||= if enrollment_account_ids.empty?
                            {}
                          else
                            Account.account_chain_ids_for_multiple_accounts(enrollment_account_ids)
                          end
    end

    def enrollment_account_ids
      @enrollment_account_ids ||= Course
                                  .active
                                  .horizon
                                  .where(id: @user.enrollments
                                                  .shard(@root_account.shard)
                                                  .active_or_pending_by_date
                                                  .select(:course_id))
                                  .distinct
                                  .pluck(:account_id)
    end
  end
end

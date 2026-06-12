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

module DataFixup
  # Slow path for INTEROP-10663: users associated with more than one shard.
  # Determining "non-admin" for them means checking account_users across all of
  # their in-region shards, which is inherently cross-database and touches redis
  # (via User#account_membership?). We process these one user at a time so the
  # per-record sleep can throttle that work, and lower the range batch size so
  # each scheduled job stays small. Single-shard users are handled by the much
  # cheaper ExpireNonAdminTokensSingleShard.
  class ExpireNonAdminTokensCrossShard < CanvasOperations::DataFixup
    include NonAdminTokenExpiration

    self.mode = :individual_record
    self.progress_tracking = false
    self.record_changes = true

    # This is how many records we can run the exists on at once when scheduling
    # the jobs, underlying batch size is always 1000
    setting :range_batch_size, default: 10_000, type_cast: :to_i
    setting :processing_sleep_time, default: 0.25, type_cast: :to_f

    scope do
      User.active
          .non_shadow
          .where(cross_shard_strong_association_exists_sql)
    end

    def process_record(user)
      return if user.account_membership?

      tokens_expired = expire_non_admin_tokens([user.id])
      return if tokens_expired.empty?

      { shard_id: Shard.current.id, user_id: user.id, tokens_expired: }.to_json
    end
  end
end

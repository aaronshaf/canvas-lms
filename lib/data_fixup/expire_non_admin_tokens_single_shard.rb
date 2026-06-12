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
  # "Non-admin" can be answered with a single local join against account_users,
  # so we expire their tokens with set-based UPDATEs and no cross-shard or redis
  # lookups. Multi-shard users are handled by ExpireNonAdminTokensCrossShard.
  class ExpireNonAdminTokensSingleShard < CanvasOperations::DataFixup
    include NonAdminTokenExpiration

    self.mode = :batch
    self.progress_tracking = false
    self.record_changes = true

    setting :range_batch_size, default: 10_000, type_cast: :to_i

    scope do
      User.active
          .non_shadow
          .where("NOT #{ActiveRecord::Base.sanitize_sql(cross_shard_strong_association_exists_sql)}")
    end

    def process_batch(batch)
      user_ids = batch.pluck(:id)
      admin_ids = AccountUser.active.joins(:account).merge(Account.active).where(user_id: user_ids).distinct.pluck(:user_id)
      tokens_expired = expire_non_admin_tokens(user_ids - admin_ids)

      { shard_id: Shard.current.id, tokens_expired:, affected_user_ids: user_ids - admin_ids }.to_json
    end
  end
end

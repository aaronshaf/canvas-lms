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
  # Shared behavior for the single- and cross-shard non-admin token expiration
  # fixups (INTEROP-10663). Both fixups retroactively bring existing
  # user-generated tokens for non-admin users in line with the going-forward
  # 30-day cap added in INTEROP-10564.
  module NonAdminTokenExpiration
    # Non-admin user-generated tokens that currently outlive this date (or never
    # expire) get clamped down to it. The existing daily
    # AccessToken.send_expiration_reminders cron then fires the 7-day notice on
    # 2026-07-11 with nothing to reset, since the notice is driven solely by
    # permanent_expires_at.
    TARGET_EXPIRATION = Time.zone.parse("2026-07-18")

    # A correlated SQL EXISTS clause matching users who have a strong shard
    # association to a shard other than the current one, i.e. multi-shard
    # users. This mirrors the :strong-only semantics of
    # in_region_associated_shards / account_membership?, and lets each fixup's
    # scope cheaply select the single-shard (NOT ...) or multi-shard population
    # with one join. The fixups exclude shadow records, so we're always querying
    # from the user's home shard. Single-shard users don't have any strong
    # association rows; only a row for some other shard means the user actually
    # lives on more than one.
    def cross_shard_strong_association_exists_sql
      other_shard_associations =
        UserShardAssociation.where("user_shard_associations.user_id = users.id")
                            .where(strength: "strong")
                            .where.not(shard_id: Shard.current.id)
      "EXISTS (#{other_shard_associations.to_sql})"
    end

    # Clamps qualifying user-generated tokens for the given users down to
    # TARGET_EXPIRATION. Updates in batches of 1000 so a user with many tokens
    # can't lock too many rows in a single statement. Idempotent: tokens already
    # at or below the target are skipped, so re-runs are no-ops.
    #
    # Returns the number of tokens updated.
    def expire_non_admin_tokens(user_ids)
      return [] if user_ids.blank?

      now = Time.now.utc
      AccessToken.not_deleted
                 .user_generated
                 .where(user_id: user_ids)
                 .where("permanent_expires_at IS NULL OR permanent_expires_at > ?", TARGET_EXPIRATION)
                 .find_ids_in_batches.reduce([]) do |ids, batch|
                   AccessToken.where(id: batch).update_all(permanent_expires_at: TARGET_EXPIRATION, updated_at: now)
                   ids.concat(batch)
                 end
    end
  end
end

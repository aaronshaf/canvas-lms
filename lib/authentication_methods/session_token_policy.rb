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

module AuthenticationMethods
  module SessionTokenPolicy
    # Returns true if the bearer of `access_token` may mint a session token.
    # Emits an event for non-mobile callers and a block event when
    # the user-generated-access-token block flag is on.
    def self.can_issue?(access_token:)
      developer_key = access_token.developer_key
      emit_non_mobile_issuance_event(developer_key, access_token.user) unless developer_key.mobile_app?

      if access_token.manually_created?
        # Emit the blocked event for every user-generated-token attempt,
        # regardless of whether enforcement is on. This lets us quantify the
        # impact of the blocking flags before flipping them on.
        emit_blocked_event(developer_key, access_token.user)
        return false if blocking_enabled?(access_token:)
      end

      true
    end

    def self.blocking_enabled?(access_token:)
      return true if Account.site_admin.feature_enabled?(:block_session_token_for_user_generated_access_tokens_globally)

      Account.site_admin.feature_enabled?(:block_session_token_for_user_generated_access_tokens_for_site_admins) &&
        Account.site_admin.grants_right?(access_token.user, :read)
    end

    def self.emit_non_mobile_issuance_event(developer_key, user)
      message = "Non-mobile session_token issuance: user_id=#{user&.global_id} dk_id=#{developer_key&.global_id} dk_name=#{developer_key&.name.inspect}"
      InstStatsd::Statsd.event(
        "Non-Mobile Session Token Issuance",
        message,
        type: :non_mobile_session_token_issuance,
        alert_type: :info,
        tags: event_tags(developer_key, user)
      )
      Rails.logger.info("[SessionTokenPolicy] #{message}")
    end

    def self.emit_blocked_event(developer_key, user)
      site_admin = user && Account.site_admin.grants_right?(user, :read)
      message = "Session token blocked for user-generated access token: user_id=#{user&.global_id} site_admin=#{site_admin} dk_id=#{developer_key&.global_id}"
      InstStatsd::Statsd.event(
        "Session Token Blocked",
        message,
        type: :session_token_blocked,
        alert_type: :warning,
        tags: event_tags(developer_key, user)
      )
      Rails.logger.warn("[SessionTokenPolicy] #{message}")
    end

    def self.metric_tags
      Utils::InstStatsdUtils::Tags.tags_for(Shard.current)
    end

    # enriched with per-user/per-key ids; only safe on events, where
    # cardinality affects explorer faceting rather than metric cost
    def self.event_tags(developer_key, user)
      metric_tags.merge(
        user_global_id: user&.global_id,
        developer_key_id: developer_key&.global_id&.to_s,
        developer_key_name: developer_key&.name
      ).compact
    end
  end
end

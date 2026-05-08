# frozen_string_literal: true

#
# Copyright (C) 2013 - present Instructure, Inc.
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
#

module Api::V1::AuthenticationEvent
  include Api::V1::Pseudonym
  include Api::V1::Account
  include Api::V1::User
  include Api::V1::PageView

  def authentication_event_json(event, _user, _session)
    links = {
      login: Shard.relative_id_for(event.pseudonym_id, Shard.current, Shard.current),
      account: Shard.relative_id_for(event.account_id, Shard.current, Shard.current),
      user: Shard.relative_id_for(event.user_id, Shard.current, Shard.current),
      page_view: event.request_id && PageView.find_by(id: event.request_id).try(:id)
    }

    {
      id: event.uuid,
      created_at: event.created_at.in_time_zone,
      event_type: event.event_type,
      links:
    }
  end

  def authentication_events_json(events, current_principal, session)
    events.map { |event| authentication_event_json(event, current_principal, session) }
  end

  def authentication_events_compound_json(events, current_principal, session)
    {
      links: links_json,
      events: authentication_events_json(events, current_principal, session),
      linked: linked_json(events, current_principal, session)
    }
  end

  private

  def links_json
    # This should include logins, users, and page_views.  There is no end point
    # for returning single json objects for those models.
    {
      "events.login" => nil,
      "events.account" => templated_url(:api_v1_account_url, "{events.account}"),
      "events.user" => nil,
      "events.page_view" => nil
    }
  end

  def linked_json(events, current_principal, session)
    pseudonyms = []
    accounts = []
    pseudonym_ids = events.map(&:pseudonym_id).uniq.compact
    Shard.partition_by_shard(pseudonym_ids) do |shard_pseudonym_ids|
      shard_pseudonyms = Pseudonym.where(id: shard_pseudonym_ids).to_a
      account_ids = shard_pseudonyms.map(&:account_id).uniq
      accounts.concat Account.where(id: account_ids).to_a
      pseudonyms.concat shard_pseudonyms
    end

    user_ids = events.map(&:user_id).uniq.compact
    users = Shard.partition_by_shard(user_ids) do |shard_user_ids|
      User.where(id: shard_user_ids).to_a
    end

    page_view_ids = events.filter_map(&:request_id)
    page_views = PageView.find_all_by_id(page_view_ids) unless page_view_ids.empty?
    page_views ||= []

    {
      logins: pseudonyms_json(pseudonyms, current_principal, session),
      accounts: accounts_json(accounts, current_principal, session, []),
      users: users_json(users, current_principal, session, [], @domain_root_account),
      page_views: page_views_json(page_views, current_principal, session)
    }
  end
end

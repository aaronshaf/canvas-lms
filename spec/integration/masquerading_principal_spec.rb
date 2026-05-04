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
#

describe "MasqueradingPrincipal" do
  let_once(:account) { Account.default }

  let_once(:masquerade_only_role) do
    role = custom_account_role("MasqueradeOnly", account:)
    account.role_overrides.create!(permission: "become_user", enabled: true, role:)
    role
  end

  let_once(:masquerade_only_admin) do
    account_admin_user(account:, role: masquerade_only_role)
    user_with_pseudonym(user: @user, account:, username: "masq-only@example.com")
    @user
  end

  let_once(:full_admin) do
    account_admin_user(account:)
    user_with_pseudonym(user: @user, account:, username: "full@example.com")
    @user
  end

  before do
    Account.site_admin.enable_feature!(:allow_masquerade_without_all_permissions)
    user_session(masquerade_only_admin, masquerade_only_admin.pseudonyms.first)
    post "/users/#{full_admin.id}/masquerade"
    expect(session[:become_user_id]).to eql full_admin.id.to_s
  end

  describe "GET /" do
    it "loads the dashboard with the masqueraded user as effective and the masquerader as real" do
      get "/"

      expect(response).to have_http_status(:ok)
      expect(assigns["current_user"]).to eq full_admin
      expect(assigns["real_current_user"]).to eq masquerade_only_admin
    end
  end

  describe "GET /accounts/self/authentication_providers" do
    it "denies access because the real user lacks manage_account_settings" do
      get "/accounts/self/authentication_providers"

      expect(response).to have_http_status(:unauthorized)
      expect(assigns["current_user"]).to eq full_admin
      expect(assigns["real_current_user"]).to eq masquerade_only_admin
    end
  end
end

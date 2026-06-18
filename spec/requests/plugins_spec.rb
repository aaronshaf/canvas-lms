# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

describe "Plugins" do
  include Rails.application.routes.url_helpers

  describe "#index" do
    before { set_domain_root_account(account: Account.site_admin) }

    it "does not allow non-site-admins" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      get "/plugins"
      expect(response).to have_http_status(:unauthorized)
    end

    it "allows site-admins" do
      user = user_with_pseudonym(active_all: true)
      Account.site_admin.account_users.create!(user:)
      user_session(user)
      get "/plugins"
      expect(response).to have_http_status(:ok)
    end
  end

  describe "#show" do
    before { set_domain_root_account(account: Account.site_admin) }

    it "does not allow non-site-admins" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      get "/plugins/account_reports"
      expect(response).to have_http_status(:unauthorized)
    end

    it "allows site-admins" do
      user = user_with_pseudonym(active_all: true)
      Account.site_admin.account_users.create!(user:)
      user_session(user)
      get "/plugins/account_reports"
      expect(response).to have_http_status(:ok)
    end
  end

  describe "#update" do
    before { set_domain_root_account(account: Account.site_admin) }

    it "does not allow non-site-admins" do
      user = user_with_pseudonym(active_all: true)
      user_session(user)
      put "/plugins/account_reports", params: { plugin_setting: { disabled: false } }
      expect(response).to have_http_status(:unauthorized)
    end

    it "allows site-admins" do
      user = user_with_pseudonym(active_all: true)
      Account.site_admin.account_users.create!(user:)
      user_session(user)
      put "/plugins/account_reports", params: { plugin_setting: { disabled: false } }
      expect(response).to have_http_status(:found)
    end

    it "still enables plugins even with no settings posted" do
      user = account_admin_user(account: Account.site_admin, active_all: true)
      user_session(user)
      set_domain_root_account(account: Account.site_admin)
      expect(PluginSetting.find_by(name: "account_reports")).to be_nil

      put "/plugins/account_reports", params: { all: "1", plugin_setting: { disabled: false } }
      expect(response).to have_http_status(:found)
      ps = PluginSetting.find_by!(name: "account_reports")
      expect(ps.disabled).to be(false)
    end

    it "trims posted params" do
      user = account_admin_user(account: Account.site_admin, active_all: true)
      user_session(user)
      ps = PluginSetting.new(name: "big_blue_button")
      ps.settings = {}.with_indifferent_access
      ps.disabled = false
      ps.save!

      # The 'all' parameter is necessary for this test to pass when the
      # multiple root accounts plugin is installed
      put "/plugins/big_blue_button", params: { settings: { domain: " abc ", secret: "secret", recording_enabled: "0", free_trial: true, send_avatar: true, replace_with_alternatives: false, use_fallback: false }, all: 1 }
      expect(response).to have_http_status(:found)
      ps.reload
      expect(ps.settings[:domain]).to eq "abc"
    end

    context "account_reports" do
      it "can disable reports" do
        user = account_admin_user(account: Account.site_admin, active_all: true)
        user_session(user)
        ps = PluginSetting.new(name: "account_reports")
        ps.settings = { course_storage_csv: true }.with_indifferent_access
        ps.save!

        # The 'all' parameter is necessary for this test to pass when the
        # multiple root acoounts plugin is installed
        put "/plugins/account_reports", params: { settings: { "course_storage_csv" => "0" }, all: 1 }
        expect(response).to have_http_status(:found)
        ps.reload
        expect(ps.settings[:course_storage_csv]).to be false
      end
    end
  end

  describe "elevated auth provider enforcement" do
    let(:account) { Account.default }
    let!(:elevated_provider) { account.authentication_providers.create!(auth_type: "saml") }
    let(:log_flag_enabled) { false }
    let(:enforce_flag_enabled) { false }
    let(:plugins_flag_enabled) { true }

    before do
      set_domain_root_account(account: Account.site_admin)
      user_with_pseudonym(active_all: true, account:)
      Account.site_admin.account_users.create!(user: @user)
      user_session(@user, @pseudonym)

      AuthenticationMethods::PseudonymAttributes.reset

      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("log_violations").and_return(log_flag_enabled)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("enforce_violations").and_return(enforce_flag_enabled)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("require_for_plugins").and_return(plugins_flag_enabled)
    end

    context "when no elevated provider is configured" do
      let(:enforce_flag_enabled) { true }

      it "allows the request" do
        get "/plugins"
        expect(response).to have_http_status(:ok)
      end
    end

    context "when an elevated provider is configured" do
      before do
        account.settings[:elevated_auth_provider_global_id] = elevated_provider.global_id
        account.save(validate: false)
      end

      context "and the session uses the elevated provider" do
        let(:enforce_flag_enabled) { true }

        before do
          allow(AuthenticationMethods::PseudonymAttributes).to receive(:load_auth_provider).and_return(elevated_provider)
        end

        it "allows index" do
          get "/plugins"
          expect(response).to have_http_status(:ok)
        end

        it "allows show" do
          get "/plugins/account_reports.json"
          expect(response).to have_http_status(:ok)
        end

        it "allows update" do
          put "/plugins/account_reports", params: { plugin_setting: { disabled: false } }
          expect(response).to have_http_status(:found)
        end
      end

      context "and the session does not use the elevated provider" do
        context "with both flags off" do
          it "allows the request" do
            get "/plugins"
            expect(response).to have_http_status(:ok)
          end
        end

        context "with only the log flag on" do
          let(:log_flag_enabled) { true }

          it "allows the request" do
            get "/plugins"
            expect(response).to have_http_status(:ok)
          end
        end

        context "with the enforce flag on" do
          let(:enforce_flag_enabled) { true }

          it "blocks json requests with 403 unauthorized" do
            get "/plugins/account_reports.json"
            expect(response).to have_http_status(:forbidden)
            expect(response.parsed_body["status"]).to eq "unauthorized"
          end

          it "redirects html requests with a flash error" do
            get "/plugins"
            expect(response).to have_http_status(:found)
            expect(flash[:error][:html]).to include("requires using an elevated authentication provider")
          end

          context "but the plugins flag is off" do
            let(:plugins_flag_enabled) { false }

            it "bypasses the elevated auth provider check" do
              get "/plugins"
              expect(response).to have_http_status(:ok)
            end
          end
        end
      end
    end
  end
end

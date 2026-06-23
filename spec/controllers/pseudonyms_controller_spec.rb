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

# These two describe blocks remain controller specs on purpose. They exercise
# the login-management authorization gate (AuthenticationMethods::ElevatedAuthProvider
# + authorized_per_site_admin_user_restrictions), which is driven by auth-context
# internals that are injected directly in the test: AccessTokenAttributes.current_developer_key,
# AuthenticationMethods::PseudonymAttributes.auth_provider_id, and the masquerade
# pair @current_user / @real_current_user. None of those survive — or exist in —
# the real request middleware, so converting them to request specs makes the
# "allowed" cases fail and the "blocked" cases pass vacuously. Faithfully
# request-testing this gate would require real Bearer tokens with scopes, real
# elevated-auth-provider session state, and a real masquerade flow — a separate
# effort. Until then this stays at the controller layer where the contract holds.
describe PseudonymsController do
  describe "elevated auth provider enforcement" do
    let(:account) { Account.default }
    let!(:auth_provider) { account.authentication_providers.create!(auth_type: "saml") }
    let!(:other_provider) { account.authentication_providers.create!(auth_type: "cas") }
    let(:admin) { account_admin_user(account:) }
    let(:admin_pseudonym) { pseudonym(admin, account:) }
    let(:target_pseudonym) { pseudonym(user_with_pseudonym(active_all: true, account:), account:) }
    let(:login_management_flag_enabled) { true }
    let(:enforce_flag_enabled) { true }

    before do
      AuthenticationMethods::PseudonymAttributes.reset

      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("require_for_login_management").and_return(login_management_flag_enabled)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("enforce_violations").and_return(enforce_flag_enabled)

      user_session(admin, admin_pseudonym)
    end

    context "when the login management gate flag is off" do
      let(:login_management_flag_enabled) { false }

      before do
        account.settings[:elevated_auth_provider_global_id] = auth_provider.global_id
        account.save(validate: false)
        AuthenticationMethods::PseudonymAttributes.auth_provider_id = other_provider.id
      end

      it "allows destroy through" do
        delete :destroy, params: { user_id: target_pseudonym.user_id, id: target_pseudonym.id }, format: :json
        expect(response).to have_http_status(:ok)
        expect(target_pseudonym.reload).to be_deleted
      end
    end

    context "when no elevated provider is configured" do
      it "allows destroy through" do
        delete :destroy, params: { user_id: target_pseudonym.user_id, id: target_pseudonym.id }, format: :json
        expect(response).to have_http_status(:ok)
        expect(target_pseudonym.reload).to be_deleted
      end
    end

    context "when an elevated provider is configured" do
      before do
        account.settings[:elevated_auth_provider_global_id] = auth_provider.global_id
        account.save(validate: false)
      end

      context "and the session uses the elevated provider" do
        before { AuthenticationMethods::PseudonymAttributes.auth_provider_id = auth_provider.id }

        it "allows destroy through" do
          delete :destroy, params: { user_id: target_pseudonym.user_id, id: target_pseudonym.id }, format: :json
          expect(response).to have_http_status(:ok)
          expect(target_pseudonym.reload).to be_deleted
        end
      end

      context "and the session does not use the elevated provider" do
        before { AuthenticationMethods::PseudonymAttributes.auth_provider_id = other_provider.id }

        it "blocks destroy with 403 unauthorized" do
          delete :destroy, params: { user_id: target_pseudonym.user_id, id: target_pseudonym.id }, format: :json
          expect(response).to have_http_status(:forbidden)
          expect(response.parsed_body["status"]).to eq "unauthorized"
          expect(target_pseudonym.reload).to be_active
        end

        it "blocks create and does not persist a new pseudonym" do
          expect do
            post :create,
                 params: { user_id: target_pseudonym.user_id,
                           pseudonym: { account_id: account.id, unique_id: "new_login@example.com" } },
                 format: :json
          end.not_to change { target_pseudonym.user.pseudonyms.count }
          expect(response).to have_http_status(:forbidden)
        end

        it "blocks update and does not change unique_id" do
          original = target_pseudonym.unique_id
          put :update,
              params: { user_id: target_pseudonym.user_id,
                        id: target_pseudonym.id,
                        login: { unique_id: "renamed@example.com" } },
              format: :json
          expect(response).to have_http_status(:forbidden)
          expect(target_pseudonym.reload.unique_id).to eq original
        end

        context "but the enforce flag is off" do
          let(:enforce_flag_enabled) { false }

          it "allows destroy through" do
            delete :destroy, params: { user_id: target_pseudonym.user_id, id: target_pseudonym.id }, format: :json
            expect(response).to have_http_status(:ok)
            expect(target_pseudonym.reload).to be_deleted
          end
        end
      end
    end
  end

  describe "site-admin target user restriction" do
    let(:account) { Account.default }
    let(:caller_user) { site_admin_user(active_all: true) }
    let(:target_user) do
      u = user_with_pseudonym(active_all: true, account:)
      Account.site_admin.account_users.create!(user: u)
      u
    end
    let!(:target_pseudonym) { pseudonym(target_user, account:) }
    let(:caller_site_admin_role) { caller_user.account_users.find_by(account: Account.site_admin).role }

    before do
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("restrict_modifying_site_admin_user_logins").and_return(true)
      caller_pseudonym = pseudonym(caller_user, account:)
      user_session(caller_user, caller_pseudonym)
    end

    def override_site_admin_manage_user_logins(enabled:, applies_to_self:, applies_to_descendants: true)
      Account.site_admin.role_overrides.where(permission: "manage_user_logins", role: caller_site_admin_role).destroy_all
      Account.site_admin.role_overrides.create!(
        permission: "manage_user_logins",
        role: caller_site_admin_role,
        enabled:,
        applies_to_self:,
        applies_to_descendants:
      )
    end

    def create_call
      post :create,
           params: { user_id: target_user.id,
                     pseudonym: { account_id: account.id, unique_id: "new_login@example.com" } },
           format: :json
    end

    def api_create_call
      request.path = "/api/v1/accounts/#{account.id}/logins"
      post :create,
           params: { account_id: account.id,
                     user: { id: target_user.id },
                     login: { unique_id: "new_login@example.com" } },
           format: :json
    end

    def update_call
      put :update,
          params: { user_id: target_user.id,
                    id: target_pseudonym.id,
                    pseudonym: { unique_id: "renamed@example.com" } },
          format: :json
    end

    def api_update_call
      request.path = "/api/v1/accounts/#{account.id}/logins/#{target_pseudonym.id}"
      put :update,
          params: { account_id: account.id,
                    id: target_pseudonym.id,
                    login: { unique_id: "renamed@example.com" } },
          format: :json
    end

    shared_examples "blocked" do
      it "blocks create with 403 and does not persist" do
        expect { create_call }.not_to change { target_user.pseudonyms.count }
        expect(response).to have_http_status(:forbidden)
      end

      it "blocks API create with 403 and does not persist" do
        expect { api_create_call }.not_to change { target_user.pseudonyms.count }
        expect(response).to have_http_status(:forbidden)
      end

      it "blocks update with 403 and does not change unique_id" do
        original = target_pseudonym.unique_id
        update_call
        expect(response).to have_http_status(:forbidden)
        expect(target_pseudonym.reload.unique_id).to eql original
      end

      it "blocks API update with 403 and does not change unique_id" do
        original = target_pseudonym.unique_id
        api_update_call
        expect(response).to have_http_status(:forbidden)
        expect(target_pseudonym.reload.unique_id).to eql original
      end
    end

    shared_examples "allowed" do
      it "allows create through" do
        expect { create_call }.to change { target_user.pseudonyms.count }.by(1)
        expect(response).to be_successful
      end

      it "allows update through and persists the new unique_id" do
        update_call
        expect(response).to be_successful
        expect(target_pseudonym.reload.unique_id).to eql "renamed@example.com"
      end

      it "allows API update through and persists the new unique_id" do
        api_update_call
        expect(response).to be_successful
        expect(target_pseudonym.reload.unique_id).to eql "renamed@example.com"
      end
    end

    context "when the target is not a site-admin user" do
      let(:target_user) { user_with_pseudonym(active_all: true, account:) }

      it_behaves_like "allowed"
    end

    context "when the target is a site-admin user" do
      it "allows destroy through regardless (so unwanted pseudonyms can be cleaned up)" do
        delete :destroy,
               params: { user_id: target_user.id, id: target_pseudonym.id },
               format: :json
        expect(response).to have_http_status(:ok)
        expect(target_pseudonym.reload).to be_deleted
      end

      context "and no exception applies" do
        it_behaves_like "blocked"
      end

      context "with an access token" do
        let(:scopes) { [] }
        let(:caller_developer_key) { DeveloperKey.create!(name: "key", scopes:) }

        before do
          AuthenticationMethods::AccessTokenAttributes.current_developer_key = caller_developer_key
        end

        after { AuthenticationMethods::AccessTokenAttributes.reset }

        context "with a non-matching elevated_operations scope" do
          let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/anonymous/index"] }

          it_behaves_like "blocked"
        end

        context "with the /all scope but manage_user_logins is disabled on Site Admin" do
          let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"] }

          before { override_site_admin_manage_user_logins(enabled: false, applies_to_self: true) }

          it_behaves_like "blocked"
        end

        context "with /all scope and Site-Admin manage_user_logins (applies_to_self: true)" do
          let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"] }

          before { override_site_admin_manage_user_logins(enabled: true, applies_to_self: true) }

          it_behaves_like "allowed"
        end

        context "with action-specific elevated_operations scopes and Site-Admin manage_user_logins" do
          let(:scopes) do
            %w[create update].map do |action|
              "#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/pseudonyms/#{action}"
            end
          end

          before { override_site_admin_manage_user_logins(enabled: true, applies_to_self: true) }

          it_behaves_like "allowed"
        end

        context "with /all scope but Site-Admin manage_user_logins is applies_to_self: false" do
          let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"] }

          before { override_site_admin_manage_user_logins(enabled: true, applies_to_self: false) }

          it_behaves_like "blocked"
        end

        context "with /all scope and perm but require_client_credentials enforces InstAccess token" do
          let(:scopes) { ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"] }

          before do
            override_site_admin_manage_user_logins(enabled: true, applies_to_self: true)
            allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
              .with("require_client_credentials").and_return(true)
          end

          it_behaves_like "blocked"
        end
      end

      context "with masquerading" do
        # Both @current_user and @real_current_user must hold the Site-Admin
        # manage_user_logins permission. Either alone is not enough.
        let(:non_site_admin) { account_admin_user(account:) }
        let(:caller_developer_key) do
          DeveloperKey.create!(name: "key", scopes: ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"])
        end

        before do
          override_site_admin_manage_user_logins(enabled: true, applies_to_self: true)
          AuthenticationMethods::AccessTokenAttributes.current_developer_key = caller_developer_key
        end

        after { AuthenticationMethods::AccessTokenAttributes.reset }

        context "when a non-site-admin is masquerading as the site-admin target_user" do
          # Session-as user (target_user) has the perm, real (masquerading) user does not.
          before do
            user_session(target_user, target_pseudonym)
            controller.instance_variable_set(:@real_current_user, non_site_admin)
          end

          it_behaves_like "blocked"
        end

        context "when a site-admin is masquerading as a non-site-admin (and target is still a site-admin)" do
          # Real (masquerading) user has the perm, session-as user does not.
          before do
            user_session(non_site_admin, pseudonym(non_site_admin, account:))
            controller.instance_variable_set(:@real_current_user, caller_user)
          end

          it_behaves_like "blocked"
        end
      end

      context "when the restrict_modifying_site_admin_user_logins Consul setting is disabled (or unset)" do
        before do
          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
            .with("restrict_modifying_site_admin_user_logins").and_return(false)
        end

        it_behaves_like "allowed"
      end

      context "when the restrict_modifying_site_admin_user_logins Consul setting is enabled" do
        before do
          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
            .with("restrict_modifying_site_admin_user_logins").and_return(true)
        end

        it_behaves_like "blocked"
      end

      describe "events" do
        it "emits an allowed event when the call is permitted" do
          caller_developer_key = DeveloperKey.create!(name: "key", scopes: ["#{TokenScopes::ELEVATED_OPERATIONS_PREFIX}/all"])
          AuthenticationMethods::AccessTokenAttributes.current_developer_key = caller_developer_key
          override_site_admin_manage_user_logins(enabled: true, applies_to_self: true)
          expect(InstStatsd::Statsd).to receive(:event).with(
            "Site-Admin User Login Management Allowed",
            anything,
            hash_including(type: :pseudonyms_site_admin_user_restriction_allowed, alert_type: :info)
          )
          create_call
        ensure
          AuthenticationMethods::AccessTokenAttributes.reset
        end

        it "emits a blocked event when the call is blocked" do
          expect(InstStatsd::Statsd).to receive(:event).with(
            "Site-Admin User Login Management Blocked",
            anything,
            hash_including(type: :pseudonyms_site_admin_user_restriction_blocked, alert_type: :warning)
          )
          create_call
        end
      end
    end
  end
end

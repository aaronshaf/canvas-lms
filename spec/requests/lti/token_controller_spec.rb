# frozen_string_literal: true

#
# Copyright (C) 2021 - present Instructure, Inc.
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
require "lti2_spec_helper"
require "rotp"

describe Lti::TokenController do
  describe "#lti_2_token" do
    include_context "lti2_spec_helper"

    let(:params) { {} }

    def send_request
      get "/api/lti/lti_2_token", params:
    end

    context "when user is not logged in" do
      it "returns unauthorized" do
        send_request

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when user is not site admin" do
      before do
        user_session(account_admin_user)
      end

      it "returns forbidden" do
        send_request

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when request uses a user access token" do
      let(:user) { site_admin_user }

      before do
        user_session(user)
        allow_any_instance_of(Lti::TokenController).to receive(:require_session_authentication).and_wrap_original do |method, *args|
          controller_instance = method.receiver
          controller_instance.instance_variable_set(:@access_token, user.access_tokens.create!(purpose: "testing"))
          method.call(*args)
        end
      end

      it "returns forbidden" do
        send_request

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when elevated auth provider is configured on the site_admin account" do
      let!(:elevated_provider) { Account.site_admin.authentication_providers.create!(auth_type: "saml") }
      let(:user) do
        user_with_pseudonym(active_all: true, account: Account.site_admin).tap do |u|
          Account.site_admin.account_users.create!(user: u)
        end
      end
      let(:user_pseudonym) { user.pseudonyms.first }

      before do
        AuthenticationMethods::PseudonymAttributes.reset
        AuthenticationMethods::AccessTokenAttributes.reset
        allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
        allow_any_instance_of(Account).to receive(:elevated_auth_provider_global_id)
          .and_return(elevated_provider.global_id.to_s)
        user_session(user, user_pseudonym)
      end

      context "and the user logged in via the elevated provider" do
        let(:params) { { tool_proxy_id: tool_proxy.global_id } }

        before do
          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
            .with("enforce_violations").and_return(true)
          AuthenticationMethods::PseudonymAttributes.auth_provider_id = elevated_provider.id
          allow_any_instance_of(Lti::TokenController).to receive(:require_elevated_auth_provider).and_return(true)
        end

        it "returns a token" do
          send_request
          expect(response).to have_http_status(:ok)
          decoded_jwt = Canvas::Security.decode_jwt(response.body).with_indifferent_access
          expect(decoded_jwt[:sub]).to eq tool_proxy.guid
        end
      end

      context "and the user logged in via a different, non-elevated provider" do
        let!(:other_provider) { Account.site_admin.authentication_providers.create!(auth_type: "canvas") }

        before do
          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
            .with("enforce_violations").and_return(true)
          AuthenticationMethods::PseudonymAttributes.auth_provider_id = other_provider.id
        end

        it "returns forbidden" do
          send_request

          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    shared_examples_for "creates an LTI 2 token" do
      let(:user) { site_admin_user }

      before do
        user_session(user)
      end

      it "creates a token" do
        send_request
        decoded_jwt = Canvas::Security.decode_jwt(response.body).with_indifferent_access
        expect(decoded_jwt[:sub]).to eq tool_proxy.guid
      end

      it "returns plain text" do
        send_request
        expect(response.headers["Content-Type"]).to start_with("text/plain")
      end
    end

    context "when basic_launch_lti2_id is provided" do
      let(:params) { { basic_launch_lti2_id: message_handler.global_id } }

      it_behaves_like "creates an LTI 2 token"
    end

    context "when tool_id is provided" do
      let(:params) { { tool_proxy_id: tool_proxy.global_id } }

      it_behaves_like "creates an LTI 2 token"
    end
  end

  describe "#lti_token_form" do
    def send_request
      get "/accounts/self/lti_token"
    end

    context "when user is not logged in" do
      it "redirects to login" do
        send_request

        expect(response).to have_http_status(:redirect)
      end
    end

    context "when user is not site admin" do
      before { user_session(account_admin_user) }

      it "redirects" do
        send_request

        expect(response).to have_http_status(:redirect)
      end
    end

    context "when request uses a user access token" do
      let(:admin_user) { site_admin_user }

      before do
        user_session(admin_user)
        allow_any_instance_of(Lti::TokenController).to receive(:require_session_authentication).and_wrap_original do |method, *args|
          controller_instance = method.receiver
          controller_instance.instance_variable_set(:@access_token, admin_user.access_tokens.create!(purpose: "testing"))
          method.call(*args)
        end
      end

      it "returns forbidden" do
        send_request

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when user is site admin" do
      before { user_session(site_admin_user) }

      it "renders the form" do
        send_request

        expect(response).to have_http_status(:ok)
        expect(response.body).to include("Generate LTI Advantage Access Token")
      end
    end
  end

  describe "#create_lti_token" do
    let(:root_account) { Account.create!(name: "root account") }
    let!(:developer_key) do
      key = DeveloperKey.create!(
        name: "test_key_#{SecureRandom.hex(4)}",
        account: root_account,
        is_lti_key: true,
        public_jwk_url: "http://test.host/jwks"
      )
      enable_developer_key_account_binding!(key)
      key
    end
    let!(:tool) do
      ContextExternalTool.create!(
        context: root_account,
        consumer_key: "key",
        shared_secret: "secret",
        name: "test tool",
        url: "http://www.tool.com/launch",
        developer_key:,
        lti_version: "1.3",
        workflow_state: "public"
      )
    end
    let(:otp_secret) { ROTP::Base32.random }
    let(:user) { site_admin_user }
    let(:params) { { tool_id: tool.global_id, verification_code: "123456" } }
    let(:totp_double) { instance_double(ROTP::TOTP, verify: "123456") }

    def send_request
      post "/accounts/self/lti_token", params:
    end

    context "when user is not logged in" do
      it "redirects to login" do
        send_request

        expect(response).to have_http_status(:redirect)
      end
    end

    context "when user is not site admin" do
      before { user_session(account_admin_user) }

      it "redirects" do
        send_request

        expect(response).to have_http_status(:redirect)
      end
    end

    context "when elevated auth provider is configured on the site_admin account" do
      let!(:elevated_provider) { Account.site_admin.authentication_providers.create!(auth_type: "saml") }
      let(:elevated_user) do
        user_with_pseudonym(active_all: true, account: Account.site_admin).tap do |u|
          Account.site_admin.account_users.create!(user: u)
          u.update!(otp_secret_key: otp_secret)
        end
      end
      let(:user_pseudonym) { elevated_user.pseudonyms.first }

      before do
        AuthenticationMethods::PseudonymAttributes.reset
        AuthenticationMethods::AccessTokenAttributes.reset
        allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
        allow_any_instance_of(Account).to receive(:elevated_auth_provider_global_id)
          .and_return(elevated_provider.global_id.to_s)
        allow(LoadAccount).to receive(:from_host).and_return(root_account)
        allow(ROTP::TOTP).to receive(:new).and_return(totp_double)
        user_session(elevated_user, user_pseudonym)
      end

      context "and the user logged in via the elevated provider" do
        before do
          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
            .with("enforce_violations").and_return(true)
          AuthenticationMethods::PseudonymAttributes.auth_provider_id = elevated_provider.id
          allow_any_instance_of(Lti::TokenController).to receive(:require_elevated_auth_provider).and_return(true)
        end

        it "renders the form with the generated token" do
          send_request

          expect(response).to have_http_status(:ok)
          expect(response.body).to include("Token generated successfully")
          expect(response.body).to match(%r{<textarea[^>]*id="lti_access_token"[^>]*>[\s\S]+</textarea>})
        end
      end

      context "and the user logged in via a different, non-elevated provider" do
        let!(:other_provider) { Account.site_admin.authentication_providers.create!(auth_type: "canvas") }

        before do
          allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
            .with("enforce_violations").and_return(true)
          AuthenticationMethods::PseudonymAttributes.auth_provider_id = other_provider.id
        end

        it "redirects" do
          send_request

          expect(response).to have_http_status(:redirect)
        end
      end
    end

    context "when the tool is not an LTI 1.3 tool" do
      let(:non_lti_key) do
        key = DeveloperKey.create!(name: "test_key_#{SecureRandom.hex(4)}", account: root_account)
        enable_developer_key_account_binding!(key)
        key
      end
      let!(:non_lti_tool) do
        ContextExternalTool.create!(
          context: root_account,
          consumer_key: "key",
          shared_secret: "secret",
          name: "non-lti tool",
          url: "http://www.tool.com/launch",
          developer_key: non_lti_key,
          lti_version: "1.3",
          workflow_state: "public"
        )
      end
      let(:params) { { tool_id: non_lti_tool.global_id, verification_code: "123456" } }

      before do
        user.update!(otp_secret_key: otp_secret)
        user_session(user)
        allow(LoadAccount).to receive(:from_host).and_return(root_account)
        allow(ROTP::TOTP).to receive(:new).and_return(totp_double)
      end

      it "returns bad request" do
        send_request

        expect(response).to have_http_status(:bad_request)
      end
    end

    context "when site admin user is logged in" do
      before do
        user.update!(otp_secret_key: otp_secret)
        user_session(user)
        allow(LoadAccount).to receive(:from_host).and_return(root_account)
        allow(ROTP::TOTP).to receive(:new).and_return(totp_double)
      end

      context "when request uses a user access token" do
        before do
          allow_any_instance_of(Lti::TokenController).to receive(:require_session_authentication).and_wrap_original do |method, *args|
            controller_instance = method.receiver
            controller_instance.instance_variable_set(:@access_token, user.access_tokens.create!(purpose: "testing"))
            method.call(*args)
          end
        end

        it "returns forbidden" do
          send_request

          expect(response).to have_http_status(:forbidden)
        end
      end

      context "when user has no OTP configured" do
        before { user.update!(otp_secret_key: nil) }

        it "re-renders the form with an error" do
          send_request

          expect(response).to have_http_status(:forbidden)
          expect(response.body).to include("OTP authentication is not configured")
        end
      end

      context "when OTP code is invalid" do
        before do
          allow(ROTP::TOTP).to receive(:new).and_return(instance_double(ROTP::TOTP, verify: nil))
          allow(user).to receive(:authenticate_one_time_password).and_return(false)
        end

        it "re-renders the form with an error" do
          send_request

          expect(response).to have_http_status(:unauthorized)
          expect(response.body).to include("Invalid OTP code")
        end
      end

      context "when the tool_id does not exist" do
        let(:params) { { tool_id: 0, verification_code: "123456" } }

        it "re-renders the form with an error" do
          send_request

          expect(response).to have_http_status(:not_found)
          expect(response.body).to include("Tool not found")
        end
      end

      context "when the tool belongs to the site admin account" do
        let!(:site_admin_tool) do
          ContextExternalTool.create!(
            context: Account.site_admin,
            consumer_key: "key",
            shared_secret: "secret",
            name: "site admin tool",
            url: "http://www.tool.com/launch",
            developer_key:,
            lti_version: "1.3",
            workflow_state: "public"
          )
        end
        let(:params) { { tool_id: site_admin_tool.global_id, verification_code: "123456" } }

        it "re-renders the form with an error" do
          send_request

          expect(response).to have_http_status(:forbidden)
          expect(response.body).to include("Cannot generate a token")
        end
      end

      context "when the request domain does not match the tool's account" do
        before { allow(LoadAccount).to receive(:from_host).and_return(Account.default) }

        it "re-renders the form with an error" do
          send_request

          expect(response).to have_http_status(:forbidden)
          expect(response.body).to include("domain does not match")
        end
      end

      context "with valid params" do
        it "renders the form with the generated token" do
          send_request

          expect(response).to have_http_status(:ok)
          expect(response.body).to include("Token generated successfully")
          expect(response.body).to match(%r{<textarea[^>]*id="lti_access_token"[^>]*>[\s\S]+</textarea>})
        end
      end
    end
  end
end

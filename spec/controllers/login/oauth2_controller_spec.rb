# frozen_string_literal: true

# rubocop:disable RSpec/SpecFilePathFormat

#
# Copyright (C) 2015 - present Instructure, Inc.
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

describe Login::OAuth2Controller, type: :request do
  let(:aac) { Account.default.authentication_providers.create!(auth_type: "facebook") }

  before do
    aac
    allow(Canvas::Plugin.find(:facebook)).to receive(:settings).and_return({})
  end

  describe "#new" do
    it "redirects to the provider" do
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect
      expect(response.location).to match(%r{^https://www.facebook.com/dialog/oauth\?})
      expect(session[:oauth2_nonce]).not_to be_blank
    end
  end

  describe "#create" do
    let(:token) { instance_double(OAuth2::AccessToken, options: {}) }
    let(:root_account) { Account.default }

    it "checks for a code" do
      get "/login/oauth2/callback", params: { state: "123" }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include("Missing code")
    end

    it "checks for a state" do
      get "/login/oauth2/callback", params: { code: "123" }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include("Missing state")
    end

    it "checks the OAuth2 CSRF token" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      # Intentionally use a different nonce in the JWT to test nonce validation
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce: "different")
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      # Nonce mismatch should result in auth failure (not successful, not redirect)
      expect(response).not_to be_successful
      expect(response).not_to be_redirect
    end

    it "rejects logins that take more than 10 minutes" do
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect
      state = CGI.parse(URI.parse(response.location).query)["state"].first
      expect(state).not_to be_nil

      expect_any_instantiation_of(aac).not_to receive(:get_token)
      Timecop.travel(15.minutes) do
        get "/login/oauth2/callback", params: { code: "abc", state: }
        expect(response).to redirect_to(login_url)
        expect(flash[:delegated_message]).to include("took too long")
      end
    end

    it "does not destroy existing sessions if it's a bogus request" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      # Make a bogus callback request with empty state parameter
      get "/login/oauth2/callback", params: { code: "abc", state: "" }
      expect(response).not_to be_successful
      # Verify that the session was not destroyed by checking the nonce is still present
      expect(session[:oauth2_nonce]).to eq [nonce]
    end

    it "works" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      # Extract the nonce that was set in the response
      # The response should have set oauth2_nonce in the session
      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!

      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      # ensure the session was reset
      expect(session[:sentinel]).to be_nil
    end

    it "handles multi-valued identifiers from providers" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return(["user"])
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!

      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      # ensure the session was reset
      expect(session[:sentinel]).to be_nil
    end

    it "allows the provider to substitute a different provider" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      account2 = Account.create!(name: "elsewhere")
      aac2 = account2.authentication_providers.create!(auth_type: "saml")

      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})
      expect_any_instantiation_of(aac).to receive(:alternate_provider_for_token).with(token).and_return(aac2)
      user_with_pseudonym(username: "user", active_all: 1, account: account2)
      @pseudonym.authentication_provider = aac2
      @pseudonym.save!
      # the user needs an association with this account to work
      aac.pseudonyms.create!(user: @user, unique_id: "user2", account: Account.default)

      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      expect(flash[:notice]).to eql "You are logged in at #{Account.default.name} using your credentials from #{account2.name}"
    end

    it "redirects to MFA if the account requires it" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present
      Account.default.settings[:mfa_settings] = :required
      Account.default.save!
      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!

      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_otp_url)
    end

    it "allows the provider to skip MFA dynamically" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present
      Account.default.settings[:mfa_settings] = :required
      Account.default.save!
      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})
      expect_any_instantiation_of(aac).to receive(:mfa_passed?).with(token).and_return(true)
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!

      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      # ensure the session was reset
      expect(session[:sentinel]).to be_nil
    end

    it "doesn't allow deleted users to login" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present
      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!
      @user.update!(workflow_state: "deleted")

      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include("doesn't have an account")
    end

    it "redirects to login if no user found" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})

      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)

      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include("doesn't have an account")
    end

    it "redirects to login if no user information returned" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return(nil)
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})

      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)

      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include("no unique ID")
    end

    it "(safely) displays an error message from the server" do
      get "/login/oauth2/callback", params: { error_description: "failed<script></script>" }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to eq "failed"
    end

    it "provisions automatically when enabled" do
      aac.update_attribute(:jit_provisioning, true)

      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect_any_instantiation_of(aac).to receive(:get_token).and_return(token)
      expect_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
      expect_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})

      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)

      expect(Account.default.pseudonyms.active.by_unique_id("user")).not_to be_exists
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      p = Account.default.pseudonyms.active.by_unique_id("user").first!
      expect(p.authentication_provider).to eq aac
    end

    it "redirects to login any time an expired token is noticed" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect(Canvas::Security).to receive(:decode_jwt).at_least(:once).and_raise(Canvas::Security::TokenExpired)
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!
      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include "took too long"
    end

    it "redirects to login when an _actual_ external timeout occurs" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      allow(Setting).to receive(:get).and_call_original
      allow(Setting).to receive(:get).with("service_oauth:#{aac.global_id}_timeout", nil).and_return(0.01)
      aac.client_id = "invalid"
      allow_any_instance_of(Net::HTTP).to receive(:start) { sleep 1 } # rubocop:disable Lint/NoSleep
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!
      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include "timeout occurred"
    end

    it "redirects to login when an external timeout occurs" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect_any_instantiation_of(aac).to receive(:get_token).and_raise(Timeout::Error.new)
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!
      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include "timeout occurred"
    end

    it "redirects to login when a circuit breaker timeout occurs" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      expect(Canvas).to receive(:timeout_protection).and_raise(Canvas::TimeoutCutoff.new(1))
      expect(Canvas::Errors).not_to receive(:capture)
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!
      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include "timeout occurred"
    end

    it "retries when an external timeout occurs" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      aac.settings["oauth2_timeout_retries"] = 1
      aac.save!
      aac.reload
      expect_any_instantiation_of(aac).to receive(:get_token).and_raise(Timeout::Error.new).twice
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!
      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include "timeout occurred"
    end

    it "does not retry for circuit breaker timeouts" do
      # First request to establish session and get nonce
      get "/login/oauth2", params: { auth_type: "facebook" }
      expect(response).to be_redirect

      nonce = session[:oauth2_nonce]&.first
      expect(nonce).to be_present

      aac.settings["oauth2_timeout_retries"] = 1
      aac.save!
      aac.reload
      allow(Canvas).to receive(:timeout_protection).and_raise(Canvas::TimeoutCutoff.new(1))
      user_with_pseudonym(username: "user", active_all: 1)
      @pseudonym.authentication_provider = aac
      @pseudonym.save!
      session[:sentinel] = true
      jwt = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)
      get "/login/oauth2/callback", params: { code: "abc", state: jwt }
      expect(response).to redirect_to(login_url)
      expect(flash[:delegated_message]).to include "timeout occurred"
    end

    context "when the authentication provider pseudonym validation fails" do
      let(:retry_url) { "https://test.instructure.com/retry" }

      before do
        allow(aac).to receive(:validate_found_pseudonym!).and_raise(RetriableOAuthValidationError)
        allow_any_instantiation_of(aac).to receive(:get_token).and_return(token)
        allow_any_instantiation_of(aac).to receive(:unique_id).with(token).and_return("user")
        allow_any_instantiation_of(aac).to receive(:provider_attributes).with(token).and_return({})
        user_with_pseudonym(username: "user", active_all: 1)
        @pseudonym.authentication_provider = aac
        @pseudonym.save!
      end

      before do
        # Initialize session by making a request first
        get "/login/oauth2", params: { auth_type: "facebook" }
        expect(response).to be_redirect
        session[:sentinel] = true
      end

      it "redirects to the specified retry_url" do
        nonce = session[:oauth2_nonce]&.first
        expect(nonce).to be_present
        state = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)

        expect(aac).to receive(:validation_error_retry_url).and_return(retry_url)

        get "/login/oauth2/callback", params: { code: "abc", state: }
        expect(response).to redirect_to(retry_url)
        expect(session[:sentinel]).to be_nil
      end

      context "but the authentication provider does not specify a retry_url" do
        before do
          allow(aac).to receive(:validation_error_retry_url).and_return(nil)
        end

        it "redirects to the login page" do
          nonce = session[:oauth2_nonce]&.first
          expect(nonce).to be_present
          state = Canvas::Security.create_jwt(aac_id: aac.global_id, nonce:)

          get "/login/oauth2/callback", params: { code: "abc", state: }
          expect(response).to redirect_to(login_url)
          expect(session[:sentinel]).to be_nil
        end
      end
    end
  end
end
# rubocop:enable RSpec/SpecFilePathFormat

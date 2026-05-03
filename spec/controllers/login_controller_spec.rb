# frozen_string_literal: true

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

require_relative "../apis/api_spec_helper"

describe LoginController do
  describe "#new" do
    it "redirects to dashboard if already logged in" do
      user_session(user_with_pseudonym(active: true))
      get "new"
      expect(response).to redirect_to(dashboard_url)
    end

    it "sets merge params correctly in the session" do
      user_with_pseudonym(active: true)
      @cc = @user.communication_channels.create!(path: "jt+1@instructure.com")
      get "new", params: { confirm: @cc.confirmation_code, expected_user_id: @user.id }
      expect(response).to be_redirect
      expect(session[:confirm]).to eq @cc.confirmation_code
      expect(session[:expected_user_id]).to eq @user.id
    end

    it "redirects to discovery_page_url when discovery page is allowed and active" do
      allow(Account.default).to receive_messages(discovery_page_allowed?: true,
                                                 discovery_page_active?: true,
                                                 discovery_page_url: "https://identity.example.com/discover")

      allow(InstStatsd::Statsd).to receive(:distributed_increment)
      expect(InstStatsd::Statsd).to receive(:distributed_increment)
        .with("auth.new.discovery_page_redirect.v2", tags: { auth_type: nil, target_auth_type: nil, domain: "test.host" })
      get "new"
      expect(response).to redirect_to("https://identity.example.com/discover")
    end

    it "does not redirect to discovery_page_url when authentication_provider param is present" do
      allow(Account.default).to receive_messages(discovery_page_allowed?: true,
                                                 discovery_page_active?: true,
                                                 discovery_page_url: "https://identity.example.com/discover")
      get "new", params: { authentication_provider: "canvas" }
      expect(response).to redirect_to(canvas_login_url)
    end

    it "respects auth_discovery_url" do
      Account.default.auth_discovery_url = "https://google.com/"
      Account.default.save!

      allow(InstStatsd::Statsd).to receive(:distributed_increment)
      expect(InstStatsd::Statsd).to receive(:distributed_increment)
        .with("auth.new.discovery_redirect.v2", tags: { auth_type: nil, target_auth_type: nil, domain: "test.host" })

      get "new"
      expect(response).to redirect_to("https://google.com/")
    end

    it "passes delegated message on to discovery url" do
      Account.default.auth_discovery_url = "https://google.com/"
      Account.default.save!

      flash_hash = ActionDispatch::Flash::FlashHash.new
      flash_hash[:delegated_message] = "hi"
      allow(controller).to receive(:flash).and_return(flash_hash)
      get "new"
      expect(response).to redirect_to("https://google.com/?message=hi")
    end

    it "handles legacy canvas_login=1 param" do
      account_with_cas(account: Account.default)

      get "new", params: { canvas_login: "1" }
      expect(response).to redirect_to(canvas_login_url)
    end

    it "handles legacy SAML AAC-specific :id" do
      # it should ignore an auth_discovery_url
      Account.default.auth_discovery_url = "https://google.com/"
      Account.default.save!

      account_with_saml(account: Account.default)
      aac = Account.default.authentication_providers.first
      get "new", params: { id: aac }
      expect(response).to redirect_to(saml_login_url(aac))
    end

    it "redirects to Canvas auth by default" do
      get "new"
      expect(response).to redirect_to(canvas_login_url)
    end

    it "redirects to CAS if it's the default" do
      account_with_cas(account: Account.default)

      get "new"
      expect(response).to redirect_to(controller.url_for(controller: "login/cas", action: :new))
    end

    it "redirects to Facebook if it's the default" do
      Account.default.authentication_providers.create!(auth_type: "facebook")
      Account.default.authentication_providers.first.move_to_bottom

      get "new"
      expect(response).to redirect_to(facebook_login_url)
    end

    it "redirects based on authentication_provider param" do
      Account.default.authentication_providers.create!(auth_type: "facebook")
      account_with_cas(account: Account.default)

      get "new", params: { authentication_provider: "cas" }
      expect(response).to redirect_to(controller.url_for(controller: "login/cas", action: :new))
    end

    it "redirects based on authentication_provider id param" do
      ap2 = Account.default.authentication_providers.create!(auth_type: "cas")
      account_with_cas(account: Account.default)

      get "new", params: { authentication_provider: ap2.id }
      expect(response).to redirect_to(controller.url_for(controller: "login/cas", action: :new, id: ap2.id))
    end

    it "passes pseudonym_session[unique_id] to redirect to populate username textbox" do
      get "new", params: { "pseudonym_session" => { "unique_id" => "test" } }
      expect(response).to redirect_to(
        controller.url_for(controller: "login/canvas", action: :new) + "?login_hint=test"
      )
    end

    it "passes login_hint to redirect to populate username textbox" do
      get "new", params: { "login_hint" => "test" }
      expect(response).to redirect_to(
        controller.url_for(controller: "login/canvas", action: :new) + "?login_hint=test"
      )
    end

    it "passes pseudonym_session[unique_id] to redirect from current username" do
      user_with_pseudonym(username: "test2", active: 1)
      user_session(@user, @pseudonym)
      get "new", params: { "pseudonym_session" => { "unique_id" => "test" }, :force_login => 1 }
      expect(response).to redirect_to(
        controller.url_for(controller: "login/canvas", action: :new) + "?login_hint=test2"
      )
    end

    context "given an html request" do
      before { get :new, format: :html }

      it "response with an html content type" do
        expect(response.headers.fetch("Content-Type")).to match(%r{\Atext/html})
      end
    end

    context "given a pdf request" do
      before { get :new, format: :pdf }

      it "response with an html content type" do
        expect(response.headers.fetch("Content-Type")).to match(%r{\Atext/html})
      end
    end
  end

  describe "#session_token" do
    it "doesn't explode on a bad input url" do
      user_session(user_with_pseudonym(active: true))
      request.headers.merge!({ "CONTENT_TYPE" => "application/json", "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}" })
      get "session_token", format: :json, params: { return_to: "not-a url" }
      expect(response.status.to_i).to eq(400)
    end

    describe "when user needs to accept terms of service" do
      it "returns a payload with requires_terms_acceptance of true" do
        user_session user_with_pseudonym(active: true)
        request.headers.merge!({ "CONTENT_TYPE" => "application/json", "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}" })
        allow_any_instance_of(Account).to receive(:require_acceptance_of_terms?).and_return(true)

        get "session_token", format: :json
        expect(response.parsed_body["requires_terms_acceptance"]).to be(true)
      end
    end

    describe "when user does not need to accept terms of service" do
      it "returns a payload with requires_terms_acceptance of false" do
        user_session user_with_pseudonym(active: true)
        request.headers.merge!({ "CONTENT_TYPE" => "application/json", "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}" })
        allow_any_instance_of(Account).to receive(:require_acceptance_of_terms?).and_return(false)

        get "session_token", format: :json
        expect(response.parsed_body["requires_terms_acceptance"]).to be(false)
      end
    end

    describe "handling mobile web view" do
      it "sets the token with true" do
        user_session user_with_pseudonym(active: true)
        request.headers.merge!({ "CONTENT_TYPE" => "application/json", "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}" })
        allow_any_instance_of(Account).to receive(:require_acceptance_of_terms?).and_return(false)

        get "session_token", format: :json, params: { mobile_consent: "true" }
        parsed_body = response.parsed_body
        stoken = SessionToken.parse(parsed_body["session_url"].split("session_token=").last)
        expect(stoken.consent_from_mobile).to be(true)
      end

      it "sets the token with false" do
        user_session user_with_pseudonym(active: true)
        request.headers.merge!({ "CONTENT_TYPE" => "application/json", "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}" })
        allow_any_instance_of(Account).to receive(:require_acceptance_of_terms?).and_return(false)

        get "session_token", format: :json, params: { mobile_consent: "false" }
        parsed_body = response.parsed_body
        stoken = SessionToken.parse(parsed_body["session_url"].split("session_token=").last)
        expect(stoken.consent_from_mobile).to be(false)
      end

      it "sets the token with nil if not a mobile web view" do
        user_session user_with_pseudonym(active: true)
        request.headers.merge!({ "CONTENT_TYPE" => "application/json", "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}" })
        allow_any_instance_of(Account).to receive(:require_acceptance_of_terms?).and_return(false)

        get "session_token", format: :json
        parsed_body = response.parsed_body
        stoken = SessionToken.parse(parsed_body["session_url"].split("session_token=").last)
        expect(stoken.consent_from_mobile).to be_nil
      end
    end

    it "rejects javascript scheme" do
      user_session user_with_pseudonym(active: true)
      request.headers.merge!({ "CONTENT_TYPE" => "application/json", "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}" })
      allow_any_instance_of(Account).to receive(:require_acceptance_of_terms?).and_return(false)

      get "session_token", format: :json, params: { return_to: "javascript://localhost/" }
      expect(response).to have_http_status :forbidden
    end

    describe "elevated auth provider enforcement" do
      let(:account) { Account.default }
      let(:elevated_provider) { account.canvas_authentication_provider }
      let(:log_flag_enabled) { false }
      let(:enforce_flag_enabled) { false }
      let(:session_token_flag_enabled) { true }

      before do
        user_with_pseudonym(active: true, account:)
        user_session(@user, @pseudonym)
        allow_any_instance_of(Account).to receive(:require_acceptance_of_terms?).and_return(false)

        AuthenticationMethods::PseudonymAttributes.reset

        site_admin = Account.site_admin
        allow(site_admin).to receive(:feature_enabled?).and_call_original
        allow(site_admin).to receive(:feature_enabled?)
          .with(:log_elevated_auth_provider_violations).and_return(log_flag_enabled)
        allow(site_admin).to receive(:feature_enabled?)
          .with(:enforce_no_elevated_auth_provider_violations).and_return(enforce_flag_enabled)
        allow(site_admin).to receive(:feature_enabled?)
          .with(:require_elevated_auth_provider_for_session_token).and_return(session_token_flag_enabled)
        allow(Account).to receive(:site_admin).and_return(site_admin)
      end

      def set_bearer_header
        request.headers.merge!(
          "CONTENT_TYPE" => "application/json",
          "HTTP_AUTHORIZATION" => "Bearer #{access_token_for_user(@user)}"
        )
      end

      context "when no elevated provider is configured" do
        let(:enforce_flag_enabled) { true }

        it "allows the request" do
          set_bearer_header
          get "session_token", format: :json
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

          before { AuthenticationMethods::PseudonymAttributes.auth_provider_id = elevated_provider.id }

          it "allows the request" do
            set_bearer_header
            get "session_token", format: :json
            expect(response).to have_http_status(:ok)
            expect(response.parsed_body).to have_key("session_url")
          end
        end

        context "and the session does not use the elevated provider" do
          context "with both flags off" do
            it "allows the request" do
              set_bearer_header
              get "session_token", format: :json
              expect(response).to have_http_status(:ok)
            end
          end

          context "with only the log flag on" do
            let(:log_flag_enabled) { true }

            it "allows the request" do
              set_bearer_header
              get "session_token", format: :json
              expect(response).to have_http_status(:ok)
            end
          end

          context "with the enforce flag on" do
            let(:enforce_flag_enabled) { true }

            it "blocks json requests with 403 unauthorized" do
              set_bearer_header
              get "session_token", format: :json
              expect(response).to have_http_status(:forbidden)
              expect(response.parsed_body["status"]).to eq "unauthorized"
            end

            it "redirects html requests to root_url with a flash error" do
              get "session_token"
              expect(response).to redirect_to(root_url)
              expect(flash[:error][:html]).to include("requires using an elevated authentication provider")
            end

            context "but the session_token flag is off" do
              let(:session_token_flag_enabled) { false }

              it "bypasses the elevated auth provider check" do
                set_bearer_header
                get "session_token", format: :json
                expect(response).to have_http_status(:ok)
              end
            end
          end
        end
      end
    end
  end

  describe "#logout" do
    before do
      user = user_with_pseudonym(active: true)
      user_session(user, @pseudonym)
    end

    it "logs out" do
      delete "destroy"
      expect(response).to redirect_to(login_url)
    end

    it "follows SAML logout redirect to IdP" do
      account_with_saml(account: Account.default, saml_log_out_url: "https://www.google.com/")
      session[:login_aac] = Account.default.authentication_providers.first.id
      delete "destroy"
      expect(response).to have_http_status :found
      expect(response.location).to match(%r{^https://www.google.com/\?SAMLRequest=})
    end

    it "follows CAS logout redirect to CAS server" do
      account_with_cas(account: Account.default)
      session[:login_aac] = Account.default.authentication_providers.first.id
      delete "destroy"
      expect(response).to have_http_status :found
      expect(response.location).to match(%r{localhost/cas/})
    end

    it "returns you to Canvas login if you logged in via Canvas, but something else is the primary provider" do
      account_with_saml(account: Account.default, saml_log_out_url: "https://www.google.com/")
      session[:login_aac] = Account.default.canvas_authentication_provider.id
      delete "destroy"
      expect(response).to have_http_status :found
      expect(response.location).to match(%r{/login/canvas$})
    end
  end

  describe "#logout_landing" do
    it "redirects to /login if not logged in" do
      get "logout_landing"
      expect(response).to redirect_to(login_url)
    end

    it "renders logout landing if just logged out" do
      flash[:logged_out] = true
      get "logout_landing"
      expect(response).to redirect_to(login_url)
    end

    it "renders if you are logged in" do
      user_session(user_factory)
      get "logout_landing"
      expect(response).to be_successful
      expect(response).to render_template(:logout_confirm)
    end
  end
end

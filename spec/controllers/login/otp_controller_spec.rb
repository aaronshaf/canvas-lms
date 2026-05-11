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

require "rotp"

describe Login::OtpController, type: :request do
  describe "#new" do
    before :once do
      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
    end

    before do
      user_session(@user, @pseudonym)
    end

    context "verification" do
      it "shows enrollment for unenrolled, required user" do
        Account.default.settings[:mfa_settings] = :required
        Account.default.save!

        # First request establishes session, then set pending_otp for verification flow
        get "/login/otp"
        session[:pending_otp] = true
        get "/login/otp"
        expect(response).to be_successful
        expect(session[:pending_otp_secret_key]).not_to be_nil
      end

      it "asks for verification of enrolled, optional user" do
        Account.default.settings[:mfa_settings] = :optional
        Account.default.save!

        @user.otp_secret_key = ROTP::Base32.random
        @user.save!

        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        get "/login/otp"
        expect(response).to be_successful
      end

      describe "sends otp to sms channel" do
        before do
          Account.default.settings[:mfa_settings] = :required
          Account.default.save!
          @user.otp_secret_key = ROTP::Base32.random
        end

        it "with a carrier domain (deprecated)" do
          cc = @user.otp_communication_channel = @user.communication_channels.sms.create!(path: "1234567890@txt.att.net")
          expect_any_instantiation_of(cc).to receive(:send_otp!)
          @user.save!

          allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
            { pending_otp: true }
          )
          get "/login/otp"
          expect(response).to be_successful
        end

        it "without a carrier domain" do
          cc = @user.otp_communication_channel = @user.communication_channels.sms.create!(path: "1234567890")
          expect_any_instantiation_of(cc).to receive(:send_otp!)
          @user.save!

          allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
            { pending_otp: true }
          )
          get "/login/otp"
          expect(response).to be_successful
        end
      end
    end

    context "enrollment" do
      it "generates a secret key" do
        get "/login/otp"
        expect(session[:pending_otp_secret_key]).not_to be_nil
        expect(@user.reload.otp_secret_key).to be_nil
      end

      it "generates a new secret key for re-enrollment" do
        @user.otp_secret_key = ROTP::Base32.random
        @user.save!

        get "/login/otp"
        expect(session[:pending_otp_secret_key]).not_to be_nil
        expect(session[:pending_otp_secret_key]).not_to eq @user.reload.otp_secret_key
      end
    end

    context "when the pseudonym must reset its password" do
      before do
        # re-fetch to drop the in-memory `password` attr set during creation,
        # which would otherwise trip the password_must_differ_when_reset_required validation
        Pseudonym.find(@pseudonym.id).update!(must_reset_password: true)
      end

      it "does not redirect to the password reset page" do
        get "/login/otp"
        expect(response).to be_successful
        expect(response).not_to redirect_to(set_password_url)
      end
    end

    context "when rendering JSON response" do
      it "returns a JSON response" do
        @secret_key = ROTP::Base32.random
        get "/login/otp.json"
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to be_a(Hash)
      end

      it "returns otp_configuring as true when configuring is active" do
        @secret_key = ROTP::Base32.random
        # When user requests the new OTP page, they get configuring state
        get "/login/otp"
        expect(response).to be_successful
        # Verify response shows OTP setup form
        expect(response.body).to match(/authenticat/i)
      end

      it "conditionally includes pending_otp_communication_channel_id in the JSON response based on session state" do
        @secret_key = ROTP::Base32.random
        @user.communication_channels.sms.create!(path: "1234567890")
        # Make request to show we can create SMS channel during OTP setup
        get "/login/otp"
        expect(response).to render_template(:new)
      end

      it "returns a success response when OTP is verified and pending OTP is deleted" do
        @secret_key = ROTP::Base32.random
        verification_code = ROTP::TOTP.new(@secret_key).now
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp_secret_key: @secret_key, pending_otp: true }
        )
        post "/login/otp", params: { otp_login: { verification_code: }, format: :json }
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to include("location" => dashboard_url(login_success: 1))
      end

      it "returns a configuration notice if no OTP is pending" do
        @secret_key = ROTP::Base32.random
        verification_code = ROTP::TOTP.new(@secret_key).now
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp_secret_key: @secret_key, pending_otp: nil }
        )
        post "/login/otp", params: { otp_login: { verification_code: }, format: :json }
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq({ "otp_configured" => true })
      end

      it "returns an error message if the OTP verification fails" do
        @secret_key = ROTP::Base32.random
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp_secret_key: @secret_key }
        )
        post "/login/otp", params: { otp_login: { verification_code: "invalid_code" }, format: :json }
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.parsed_body).to eq({ "error" => "Invalid verification code, please try again" })
      end
    end
  end

  describe "#create" do
    context "enrollment" do
      before :once do
        user_with_pseudonym
      end

      before do
        user_session(@user, @pseudonym)
        @secret_key = ROTP::Base32.random
      end

      it "saves the pending key" do
        @user.one_time_passwords.create!
        @user.otp_communication_channel_id = @user.communication_channels.sms.create!(path: "bob")

        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp_secret_key: @secret_key }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }
        expect(response).to redirect_to settings_profile_url
        expect(@user.reload.otp_secret_key).to eq @secret_key
        expect(@user.otp_communication_channel).to be_nil
        expect(@user.one_time_passwords).not_to be_exists
      end

      it "stores the request IP in mfa_verified_ips" do
        session_hash = { pending_otp_secret_key: @secret_key }
        allow_any_instance_of(Login::OtpController).to receive(:session) do
          session_hash
        end
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }
        expect(session_hash[:mfa_verified_ips]).to include(request.remote_ip)
      end

      it "evicts the oldest IP when the verified list is full" do
        session_hash = { pending_otp_secret_key: @secret_key, mfa_verified_ips: %w[1.1.1.1 2.2.2.2 3.3.3.3 4.4.4.4 5.5.5.5] }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }, env: { "REMOTE_ADDR" => "6.6.6.6" }
        expect(session_hash[:mfa_verified_ips]).to eq %w[2.2.2.2 3.3.3.3 4.4.4.4 5.5.5.5 6.6.6.6]
      end

      it "does not duplicate an IP already in the verified list" do
        session_hash = { pending_otp_secret_key: @secret_key, mfa_verified_ips: %w[1.1.1.1 3.3.3.3 2.2.2.2] }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }, env: { "REMOTE_ADDR" => "3.3.3.3" }
        expect(session_hash[:mfa_verified_ips]).to eq %w[1.1.1.1 2.2.2.2 3.3.3.3]
      end

      it "stores the request UA hash in mfa_verified_uas" do
        session_hash = { pending_otp_secret_key: @secret_key }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }, env: { "HTTP_USER_AGENT" => "Mozilla/5.0 (test browser)" }
        expect(session_hash[:mfa_verified_uas]).to include(Digest::MD5.hexdigest("Mozilla/5.0 (test browser)"))
      end

      it "evicts the oldest UA when the verified list is full" do
        session_hash = { pending_otp_secret_key: @secret_key, mfa_verified_uas: %w[a b c d e] }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }, env: { "HTTP_USER_AGENT" => "browser-6" }
        expect(session_hash[:mfa_verified_uas]).to eq ["b", "c", "d", "e", Digest::MD5.hexdigest("browser-6")]
      end

      it "does not duplicate a UA already in the verified list" do
        ua3 = Digest::MD5.hexdigest("browser-3")
        session_hash = { pending_otp_secret_key: @secret_key, mfa_verified_uas: ["a", ua3, "b"] }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }, env: { "HTTP_USER_AGENT" => "browser-3" }
        expect(session_hash[:mfa_verified_uas]).to eq ["a", "b", ua3]
      end

      it "continues to the dashboard if part of the login flow" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp_secret_key: @secret_key, pending_otp: true }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
      end

      it "saves a pending sms" do
        @cc = @user.communication_channels.sms.create!(path: "bob")
        code = ROTP::TOTP.new(@secret_key).now
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp_secret_key: @secret_key, pending_otp_communication_channel_id: @cc.id }
        )
        # make sure we get 5 minutes of drift
        expect_any_instance_of(ROTP::TOTP).to receive(:verify).with(code.to_s, drift_behind: 300, drift_ahead: 300).once.and_return(true)
        post "/login/otp", params: { otp_login: { verification_code: code.to_s } }
        expect(response).to redirect_to settings_profile_url
        expect(@user.reload.otp_secret_key).to eq @secret_key
        expect(@user.otp_communication_channel).to eq @cc
        expect(@cc.reload).to be_active
      end

      it "does not fail if the sms is already active" do
        @cc = @user.communication_channels.sms.create!(path: "bob")
        @cc.confirm!
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp_secret_key: @secret_key, pending_otp_communication_channel_id: @cc.id }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@secret_key).now } }
        expect(response).to redirect_to settings_profile_url
        expect(@user.reload.otp_secret_key).to eq @secret_key
        expect(@user.otp_communication_channel).to eq @cc
        expect(@cc.reload).to be_active
      end

      it "does not treat a redis-cached code as idempotent success while still configuring" do
        skip "needs redis" unless Canvas.redis_enabled?

        code = ROTP::TOTP.new(@secret_key).now
        Canvas.redis.set("otp_used:#{@user.global_id}:#{code}", "1")

        post "/login/otp", params: { otp_login: { verification_code: code } }
        expect(response).to redirect_to otp_login_url
        expect(flash[:error]).to eq "Invalid verification code, please try again"
      end
    end

    context "verification" do
      before :once do
        Account.default.settings[:mfa_settings] = :required
        Account.default.save!

        user_with_pseudonym(active_all: 1, password: "qwertyuiop")
      end

      before do
        @user.otp_secret_key = ROTP::Base32.random
        @user.save!
        expect_any_instance_of(CommunicationChannel).not_to receive(:send_otp!)
        user_session(@user, @pseudonym)
      end

      it "verifies a code" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        code = ROTP::TOTP.new(@user.otp_secret_key).now
        post "/login/otp", params: { otp_login: { verification_code: code } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
        expect(cookies["canvas_otp_remember_me"]).to be_nil
        expect(Canvas.redis.get("otp_used:#{@user.global_id}:#{code}")).to eq "1" if Canvas.redis_enabled?
        expect(request.env.fetch("extra-request-cost").to_f >= 150).to be_truthy
      end

      it "is not blocked by an IP mismatch" do
        session_hash = { pending_otp: true, mfa_verified_ips: ["1.2.3.4"] }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
        override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) do
          code = ROTP::TOTP.new(@user.otp_secret_key).now
          post "/login/otp", params: { otp_login: { verification_code: code } }, env: { "REMOTE_ADDR" => "9.9.9.9" }
        end
        expect(response).to redirect_to dashboard_url(login_success: 1)
      end

      it "stores the request IP in the session as mfa_verified_ips" do
        code = ROTP::TOTP.new(@user.otp_secret_key).now
        post "/login/otp", params: { otp_login: { verification_code: code } }
        expect(session[:mfa_verified_ips]).to include(request.remote_ip)
      end

      it "is not blocked by a UA mismatch" do
        session_hash = { pending_otp: true, mfa_verified_uas: [Digest::MD5.hexdigest("Mozilla/5.0 (old browser)")] }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
        override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) do
          code = ROTP::TOTP.new(@user.otp_secret_key).now
          post "/login/otp", params: { otp_login: { verification_code: code } }, env: { "HTTP_USER_AGENT" => "Mozilla/5.0 (new browser)" }
        end
        expect(response).to redirect_to dashboard_url(login_success: 1)
      end

      it "stores the request UA hash in the session as mfa_verified_uas" do
        code = ROTP::TOTP.new(@user.otp_secret_key).now
        post "/login/otp", params: { otp_login: { verification_code: code } }, env: { "HTTP_USER_AGENT" => "Mozilla/5.0 (test browser)" }
        expect(session[:mfa_verified_uas]).to include(Digest::MD5.hexdigest("Mozilla/5.0 (test browser)"))
      end

      it "verifies a code entered with spaces" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        code = ROTP::TOTP.new(@user.otp_secret_key).now
        post "/login/otp", params: { otp_login: { verification_code: "#{code[0..2]} #{code[3..]}" } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
        expect(cookies["canvas_otp_remember_me"]).to be_nil
        expect(Canvas.redis.get("otp_used:#{@user.global_id}:#{code}")).to eq "1" if Canvas.redis_enabled?
        expect(request.env.fetch("extra-request-cost").to_f >= 150).to be_truthy
      end

      it "verifies a backup code" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        code = @user.one_time_passwords.create!.code
        post "/login/otp", params: { otp_login: { verification_code: code } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
        expect(cookies["canvas_otp_remember_me"]).to be_nil
        expect(Canvas.redis.get("otp_used:#{@user.global_id}:#{code}")).to eq "1" if Canvas.redis_enabled?
        expect(request.env.fetch("extra-request-cost").to_f >= 150).to be_truthy
      end

      it "sets a cookie" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@user.otp_secret_key).now, remember_me: "1" } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
        lines = response["Set-Cookie"]
        expect(lines.join.downcase).to include("samesite=none")
        expect(cookies["canvas_otp_remember_me"]).not_to be_nil
        expect(request.env.fetch("extra-request-cost").to_f >= 150).to be_truthy
      end

      it "adds the current ip to existing ips" do
        session_mock = { pending_otp: true }
        allow_any_instance_of(Login::OtpController).to receive(:session) { session_mock }
        cookies["canvas_otp_remember_me"] = @user.otp_secret_key_remember_me_cookie(Time.now.utc, nil, "ip1")
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@user.otp_secret_key).now, remember_me: "1" } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
        # Verify remember-me cookie is set in response
        expect(response.cookies["canvas_otp_remember_me"]).to be_present
      end

      it "fails for an incorrect token" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        post "/login/otp", params: { otp_login: { verification_code: "123456" } }
        expect(response).to redirect_to(otp_login_url)
      end

      it "allows 30 seconds of drift by default" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        expect_any_instance_of(ROTP::TOTP).to receive(:verify).with("123456", drift_behind: 30, drift_ahead: 30).once
        post "/login/otp", params: { otp_login: { verification_code: "123456" } }
      end

      it "allows 5 minutes of drift for SMS" do
        @user.otp_communication_channel = @user.communication_channels.sms.create!(path: "bob")
        @user.save!
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        expect_any_instance_of(ROTP::TOTP).to receive(:verify).with("123456", drift_behind: 300, drift_ahead: 300).once
        post "/login/otp", params: { otp_login: { verification_code: "123456" } }
      end

      it "rejects a replay of a cached code even when it would otherwise verify" do
        skip "needs redis" unless Canvas.redis_enabled?

        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        Canvas.redis.set("otp_used:#{@user.global_id}:123456", "1")
        expect_any_instance_of(ROTP::TOTP).not_to receive(:verify)
        post "/login/otp", params: { otp_login: { verification_code: "123456" } }
        expect(response).to redirect_to(otp_login_url)
      end

      it "shows a configuration success notice if no pending OTP and configuration is completed" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: nil }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@user.otp_secret_key).now } }
        expect(response).to redirect_to settings_profile_url
        expect(flash[:notice]).to eq "Multi-factor authentication configured"
      end

      it "shows an error message and redirects to OTP login if verification code is invalid" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        post "/login/otp", params: { otp_login: { verification_code: "invalid_code" } }
        expect(response).to redirect_to otp_login_url
        expect(flash[:error]).to eq "Invalid verification code, please try again"
      end

      it "successfully logs in the user if session[:pending_otp] is deleted" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@user.otp_secret_key).now } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
      end

      it "deletes session[:pending_otp] after successful verification" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@user.otp_secret_key).now } }
        expect(response).to be_redirect
      end

      it "redirects to profile settings if configuration is complete and no pending OTP" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: nil, pending_otp_secret_key: nil }
        )
        post "/login/otp", params: { otp_login: { verification_code: ROTP::TOTP.new(@user.otp_secret_key).now } }
        expect(response).to redirect_to settings_profile_url
        expect(flash[:notice]).to eq "Multi-factor authentication configured"
      end

      it "redirects to dashboard after successful OTP verification when MFA is fully configured" do
        pending_secret_key = ROTP::Base32.random
        @user.update(otp_secret_key: pending_secret_key)
        verification_code = ROTP::TOTP.new(@user.otp_secret_key).now
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true, pending_otp_secret_key: pending_secret_key, pending_otp_communication_channel_id: 123 }
        )
        post "/login/otp", params: { otp_login: { verification_code: } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
      end

      it "redirects to login/otp with an error message if OTP verification fails due to incomplete MFA configuration" do
        allow_any_instance_of(Login::OtpController).to receive(:session).and_return(
          { pending_otp: true, pending_otp_secret_key: nil, pending_otp_communication_channel_id: nil }
        )
        verification_code = "123456"
        post "/login/otp", params: { otp_login: { verification_code: } }
        expect(response).to redirect_to login_otp_url
        expect(flash[:error]).to eq "Invalid verification code, please try again"
      end
    end
  end

  describe "#cancel_otp" do
    before :once do
      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
    end

    context "when user is logged in" do
      before do
        user_session(@user, @pseudonym)
      end

      it "should clear the pending OTP session and respond with success" do
        # Establish session first with a GET request, then set pending OTP state
        get "/login/otp"
        session[:pending_otp] = true
        session[:pending_otp_secret_key] = "test_secret_key"
        session[:pending_otp_communication_channel_id] = 1

        delete "/login/otp/cancel"
        expect(response).to be_successful
        expect(session[:pending_otp]).to be_nil
        expect(session[:pending_otp_secret_key]).to be_nil
        expect(session[:pending_otp_communication_channel_id]).to be_nil
        json_response = response.parsed_body
        expect(json_response["message"]).to eq "Multi-factor authentication process has been cancelled."
      end

      it "should respond with success even if there is no pending OTP" do
        # Establish session first with a GET request
        get "/login/otp"
        session[:pending_otp] = nil

        delete "/login/otp/cancel"
        expect(response).to be_successful
        json_response = response.parsed_body
        expect(json_response["message"]).to eq "Multi-factor authentication process has been cancelled."
      end
    end

    context "when user is logged out" do
      it "should return unauthorized status for a user not logged in" do
        delete "/login/otp/cancel"
        expect(response).to redirect_to(login_url)
      end
    end
  end

  describe "#send_verification" do
    before :once do
      Account.default.settings[:mfa_settings] = :optional
      Account.default.save!

      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
      @user.otp_secret_key = ROTP::Base32.random
      @user.save!
    end

    before do
      user_session(@user)
    end

    it "requires an authenticated user" do
      remove_user_session
      post "/users/self/mfa/send_otp"
      expect(response).to have_http_status(:unauthorized)
      json = response.parsed_body
      expect(json["error"]).to eq "Unauthorized"
    end

    it "returns error if user does not have MFA configured" do
      @user.otp_secret_key = nil
      @user.save!
      post "/users/self/mfa/send_otp"
      expect(response).to have_http_status(:unprocessable_content)
      json = response.parsed_body
      expect(json["error"]).to include("Multi-factor authentication is not configured")
    end

    it "returns otp_not_required for authenticator app users" do
      # User has MFA but no communication channel (using authenticator app)
      post "/users/self/mfa/send_otp"
      expect(response).to be_successful
      json = response.parsed_body
      expect(json["otp_not_required"]).to be true
    end

    it "sends OTP to SMS channel and returns masked phone number" do
      cc = @user.communication_channels.sms.create!(path: "1234567890")
      @user.otp_communication_channel = cc
      @user.save!

      expect_any_instantiation_of(cc).to receive(:send_otp!)

      post "/users/self/mfa/send_otp"
      expect(response).to be_successful
      json = response.parsed_body
      expect(json["otp_sent"]).to be true
      expect(json["channel_type"]).to eq "sms"
      expect(json["masked_path"]).to eq "******7890"
    end

    it "sends OTP to email channel and returns masked email" do
      cc = @user.communication_channels.email.create!(path: "user@example.com")
      cc.confirm!
      @user.otp_communication_channel = cc
      @user.save!

      expect_any_instantiation_of(cc).to receive(:send_otp!)

      post "/users/self/mfa/send_otp"
      expect(response).to be_successful
      json = response.parsed_body
      expect(json["otp_sent"]).to be true
      expect(json["channel_type"]).to eq "email"
      expect(json["masked_path"]).to eq "u***@example.com"
    end

    it "sends backup email for otp_impaired channels" do
      cc = @user.communication_channels.sms.create!(path: "1234567890@txt.att.net")
      @user.otp_communication_channel = cc
      @user.save!

      expect_any_instantiation_of(cc).to receive(:send_otp!)
      # Backup email is only sent if the channel is marked as otp_impaired
      # which requires checking the otp_impaired? method on the channel

      post "/users/self/mfa/send_otp"
      expect(response).to be_successful
    end

    it "increments request cost for rate limiting" do
      cc = @user.communication_channels.sms.create!(path: "1234567890")
      @user.otp_communication_channel = cc
      @user.save!

      allow_any_instantiation_of(cc).to receive(:send_otp!)

      post "/users/self/mfa/send_otp"
      expect(request.env.fetch("extra-request-cost").to_f).to eq 100
    end

    it "sends OTP to the currently logged-in user" do
      # Create admin with MFA and SMS channel
      @admin = user_with_pseudonym(active_all: 1, unique_id: "admin")
      @admin.otp_secret_key = ROTP::Base32.random
      admin_cc = @admin.communication_channels.sms.create!(path: "9876543210")
      @admin.otp_communication_channel = admin_cc
      @admin.save!
      Account.default.account_users.create!(user: @admin)

      # Admin logs in and sends OTP to themselves
      user_session(@admin)
      expect_any_instantiation_of(admin_cc).to receive(:send_otp!)

      post "/users/self/mfa/send_otp"
      expect(response).to be_successful
      json = response.parsed_body
      expect(json["masked_path"]).to eq "******3210"
    end
  end

  describe "#destroy" do
    before :once do
      Account.default.settings[:mfa_settings] = :optional
      Account.default.save!

      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
      @user.otp_secret_key = ROTP::Base32.random
      @user.otp_communication_channel = @user.communication_channels.sms.create!(path: "bob")
      @user.generate_one_time_passwords
      @user.save!
    end

    before do
      # Disable feature flag for tests that expect the old behavior
      Account.site_admin.disable_feature!(:require_mfa_verification_for_removal)
      user_session(@user)
    end

    it "deletes self" do
      delete "/users/self/mfa"
      expect(response).to be_successful
      expect(@user.reload.otp_secret_key).to be_nil
      expect(@user.otp_communication_channel).to be_nil
      expect(@user.one_time_passwords).not_to be_exists
    end

    it "deletes self as id" do
      delete "/users/#{@user.id}/mfa"
      expect(response).to be_successful
      expect(@user.reload.otp_secret_key).to be_nil
      expect(@user.otp_communication_channel).to be_nil
    end

    it "is not able to delete self if required" do
      Account.default.settings[:mfa_settings] = :required
      Account.default.save!
      delete "/users/self/mfa"
      expect(response).not_to be_successful
      expect(@user.reload.otp_secret_key).not_to be_nil
      expect(@user.otp_communication_channel).not_to be_nil
    end

    it "is not able to delete self as id if required" do
      Account.default.settings[:mfa_settings] = :required
      Account.default.save!
      delete "/users/#{@user.id}/mfa"
      expect(response).not_to be_successful
      expect(@user.reload.otp_secret_key).not_to be_nil
      expect(@user.otp_communication_channel).not_to be_nil
    end

    it "is not able to delete another user" do
      @other_user = @user
      @admin = user_with_pseudonym(active_all: 1, unique_id: "user2")
      user_session(@admin)
      delete "/users/#{@other_user.id}/mfa"
      expect(response).not_to be_successful
      expect(@other_user.reload.otp_secret_key).not_to be_nil
      expect(@other_user.otp_communication_channel).not_to be_nil
    end

    it "is able to delete another user with permission" do
      @other_user = @user
      @admin = user_with_pseudonym(active_all: 1, unique_id: "user2")
      mfa_role = custom_account_role("mfa_role", account: Account.default)

      Account.default.role_overrides.create!(role: mfa_role, permission: "reset_any_mfa", enabled: true)
      Account.default.account_users.create!(user: @admin, role: mfa_role)

      user_session(@admin)
      delete "/users/#{@other_user.id}/mfa"
      expect(response).to be_successful
      expect(@other_user.reload.otp_secret_key).to be_nil
      expect(@other_user.otp_communication_channel).to be_nil
    end

    it "is able to delete another user with site_admin" do
      @other_user = @user
      @admin = user_with_pseudonym(active_all: 1, unique_id: "user2", account: Account.site_admin)
      mfa_role = custom_account_role("mfa_role", account: Account.site_admin)

      Account.site_admin.role_overrides.create!(role: mfa_role, permission: "reset_any_mfa", enabled: true)
      Account.site_admin.account_users.create!(user: @admin, role: mfa_role)

      user_session(@admin)
      delete "/users/#{@other_user.id}/mfa"
      expect(response).to be_successful
      expect(@other_user.reload.otp_secret_key).to be_nil
      expect(@other_user.otp_communication_channel).to be_nil
    end

    it "is not able to delete another user from different account" do
      @other_user = @user
      account1 = Account.create!
      @admin = user_with_pseudonym(active_all: 1, unique_id: "user2", account: account1)
      mfa_role = custom_account_role("mfa_role", account: account1)

      account1.role_overrides.create!(role: mfa_role, permission: "reset_any_mfa", enabled: true)
      account1.account_users.create!(user: @admin, role: mfa_role)
      user_session(@admin)

      delete "/users/#{@other_user.id}/mfa"
      expect(response).not_to be_successful
      expect(@other_user.reload.otp_secret_key).not_to be_nil
      expect(@other_user.otp_communication_channel).not_to be_nil
    end

    it "is able to delete another user as admin" do
      # even if required
      Account.default.settings[:mfa_settings] = :required
      Account.default.save!

      @other_user = @user
      @admin = user_with_pseudonym(active_all: 1, unique_id: "user2")
      Account.default.account_users.create!(user: @admin)
      user_session(@admin)
      delete "/users/#{@other_user.id}/mfa"
      expect(response).to be_successful
      expect(@other_user.reload.otp_secret_key).to be_nil
      expect(@other_user.otp_communication_channel).to be_nil
    end

    it "enforces IP check on destroy" do
      session_hash = { mfa_verified_ips: ["1.2.3.4"] }
      allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
      override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) do
        delete "/users/self/mfa", env: { "REMOTE_ADDR" => "9.9.9.9" }
      end
      expect(response).to redirect_to(otp_login_url)
      expect(@user.reload.otp_secret_key).not_to be_nil
    end

    it "enforces UA check on destroy" do
      session_hash = { mfa_verified_ips: ["127.0.0.1"], mfa_verified_uas: [Digest::MD5.hexdigest("Mozilla/5.0 (old browser)")] }
      allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
      override_dynamic_settings({ private: { canvas: { "mfa_ua_enforce_all_mfa_users" => true } } }) do
        delete "/users/self/mfa", env: { "HTTP_USER_AGENT" => "Mozilla/5.0 (new browser)" }
      end
      expect(response).to redirect_to(otp_login_url)
      expect(@user.reload.otp_secret_key).not_to be_nil
    end

    it "allows destroy when both the IP and UA hash match" do
      session_hash = { mfa_verified_ips: ["127.0.0.1"], mfa_verified_uas: [Digest::MD5.hexdigest("Mozilla/5.0 (test browser)")] }
      allow_any_instance_of(Login::OtpController).to receive(:session) { session_hash }
      override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true, "mfa_ua_enforce_all_mfa_users" => true } } }) do
        delete "/users/self/mfa", env: { "HTTP_USER_AGENT" => "Mozilla/5.0 (test browser)" }
      end
      expect(response).to be_successful
      expect(@user.reload.otp_secret_key).to be_nil
    end

    context "with require_mfa_verification_for_removal feature flag" do
      before do
        Account.site_admin.enable_feature!(:require_mfa_verification_for_removal)
      end

      after do
        Account.site_admin.disable_feature!(:require_mfa_verification_for_removal)
      end

      it "requires verification code when feature flag is enabled" do
        delete "/users/self/mfa"
        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json["error"]).to include("Verification code is required")
        expect(@user.reload.otp_secret_key).not_to be_nil
      end

      it "rejects removal with invalid verification code" do
        delete "/users/self/mfa", params: { verification_code: "000000" }
        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json["error"]).to include("Invalid verification code")
        expect(@user.reload.otp_secret_key).not_to be_nil
      end

      it "accepts valid TOTP code and removes MFA" do
        code = ROTP::TOTP.new(@user.otp_secret_key).now
        delete "/users/self/mfa", params: { verification_code: code }
        expect(response).to be_successful
        expect(@user.reload.otp_secret_key).to be_nil
        expect(@user.otp_communication_channel).to be_nil
      end

      it "accepts verification code with spaces" do
        code = ROTP::TOTP.new(@user.otp_secret_key).now
        spaced_code = "#{code[0..2]} #{code[3..]}"
        delete "/users/self/mfa", params: { verification_code: spaced_code }
        expect(response).to be_successful
        expect(@user.reload.otp_secret_key).to be_nil
      end

      it "accepts backup code and removes MFA" do
        backup_code = @user.one_time_passwords.first.code
        delete "/users/self/mfa", params: { verification_code: backup_code }
        expect(response).to be_successful
        expect(@user.reload.otp_secret_key).to be_nil
        expect(@user.otp_communication_channel).to be_nil
      end

      it "uses 30 seconds drift for TOTP verification" do
        # Remove SMS channel so we use authenticator app (30 second drift)
        @user.otp_communication_channel = nil
        @user.save!

        expect_any_instance_of(ROTP::TOTP).to receive(:verify)
          .with("123456", drift_behind: 30, drift_ahead: 30)
          .and_call_original
        delete "/users/self/mfa", params: { verification_code: "123456" }
        # Expect failure since 123456 is not a valid code
        expect(response).to have_http_status(:unprocessable_content)
      end

      it "uses 5 minutes drift for SMS-based MFA" do
        expect_any_instance_of(ROTP::TOTP).to receive(:verify)
          .with("123456", drift_behind: 300, drift_ahead: 300)
          .and_return(false)
        delete "/users/self/mfa", params: { verification_code: "123456" }
      end

      context "when admin is removing another user's MFA" do
        before :once do
          @target_user = @user
          @admin = user_with_pseudonym(active_all: 1, unique_id: "admin")
          @admin.otp_secret_key = ROTP::Base32.random
          @admin.save!
          Account.default.account_users.create!(user: @admin)
        end

        before do
          user_session(@admin)
        end

        it "requires admin's verification code when admin has MFA, not target user's" do
          target_code = ROTP::TOTP.new(@target_user.otp_secret_key).now
          delete "/users/#{@target_user.id}/mfa", params: { verification_code: target_code }
          expect(response).to have_http_status(:unprocessable_content)
          expect(@target_user.reload.otp_secret_key).not_to be_nil
        end

        it "accepts admin's verification code to remove target user's MFA" do
          admin_code = ROTP::TOTP.new(@admin.otp_secret_key).now
          delete "/users/#{@target_user.id}/mfa", params: { verification_code: admin_code }
          expect(response).to be_successful
          expect(@target_user.reload.otp_secret_key).to be_nil
        end

        it "allows admin without MFA to remove target user's MFA" do
          @admin.otp_secret_key = nil
          @admin.save!
          delete "/users/#{@target_user.id}/mfa"
          expect(response).to be_successful
          expect(@target_user.reload.otp_secret_key).to be_nil
        end
      end
    end

    context "without require_mfa_verification_for_removal feature flag" do
      it "allows removal without verification code" do
        Account.site_admin.disable_feature!(:require_mfa_verification_for_removal)
        delete "/users/self/mfa"
        expect(response).to be_successful
        expect(@user.reload.otp_secret_key).to be_nil
      end
    end
  end
end

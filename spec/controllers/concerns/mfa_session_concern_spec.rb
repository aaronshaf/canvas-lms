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

RSpec.describe MfaSessionConcern do
  controller(ApplicationController) do
    def index
      render json: { ok: true }
    end
  end

  shared_examples "emits mfa_ip_mismatch event" do |user_type:|
    it "emits canvas.mfa_ip_mismatch tagged user_type:#{user_type}" do
      allow(InstStatsd::Statsd).to receive(:event)
      expect(InstStatsd::Statsd).to receive(:event)
        .with("MFA IP Mismatch", "canvas.mfa_ip_mismatch", type: :mfa_ip_mismatch, alert_type: :warning, tags: hash_including(user_type:))
      get :index, format: :html
    end
  end

  shared_examples "enforces mfa ip" do
    it "requires re-entering OTP" do
      get :index, format: :html
      expect(response).to redirect_to(otp_login_url)
      expect(session[:pending_otp]).to be_truthy
    end
  end

  shared_examples "allows request through" do
    it "allows the request through without redirecting" do
      get :index, format: :html
      expect(response).to be_successful
    end
  end

  let(:user) { user_model }
  let(:pseudonym) { user.pseudonyms.create!(unique_id: "user@example.com", password: "qwertyuiop", password_confirmation: "qwertyuiop") }

  before do
    Account.site_admin.enable_feature!(:mfa_event_collection)
    Account.default.settings[:mfa_settings] = :optional
    Account.default.save!
    user_session(user, pseudonym)
  end

  context "the IP is in the verified list" do
    before do
      session[:mfa_verified_ips] = [request.remote_ip]
    end

    it_behaves_like "allows request through"
  end

  it "allows the request when the IP is in the verified list" do
    get :index, format: :html
    expect(response).to be_successful
  end

  context "when mfa_event_collection feature flag is disabled" do
    before do
      Account.site_admin.disable_feature!(:mfa_event_collection)
      user.otp_secret_key = "secret"
      user.save!
      session[:mfa_verified_ips] = ["1.2.3.4"]
      request.env["REMOTE_ADDR"] = "9.9.9.9"
    end

    it "does not emit any mfa events" do
      allow(InstStatsd::Statsd).to receive(:event)
      get :index, format: :html
      expect(InstStatsd::Statsd).not_to have_received(:event).with(a_string_starting_with("MFA"), anything, anything)
    end
  end

  it "allows the request when the user does not have Canvas MFA enrolled, regardless of mfa_verified_ips" do
    request.env["REMOTE_ADDR"] = "9.9.9.9"
    expect(user.canvas_mfa?).to be false
    get :index, format: :html
    expect(response).to be_successful
  end

  it "allows the request when the user does not have Canvas MFA enrolled" do
    session[:mfa_verified_ips] = ["1.2.3.4"]
    request.env["REMOTE_ADDR"] = "9.9.9.9"
    expect(user.canvas_mfa?).to be false
    get :index, format: :html
    expect(response).to be_successful
  end

  context "when the account has MFA disabled but the user previously enrolled in Canvas MFA" do
    around do |example|
      override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) { example.run }
    end

    before do
      Account.default.settings[:mfa_settings] = :disabled
      Account.default.save!
      user.otp_secret_key = "secret"
      user.save!
      session[:mfa_verified_ips] = ["1.2.3.4"]
      request.env["REMOTE_ADDR"] = "9.9.9.9"
    end

    it "does not redirect to OTP even though the IP changed" do
      get :index, format: :html
      expect(response).to be_successful
      expect(response).not_to redirect_to(otp_login_url)
    end

    it "does not emit any MFA events" do
      allow(InstStatsd::Statsd).to receive(:event)
      get :index, format: :html
      expect(InstStatsd::Statsd).not_to have_received(:event).with(a_string_starting_with("MFA"), anything, anything)
    end
  end

  context "when the auth provider opted out of Canvas MFA for this session" do
    before do
      user.otp_secret_key = "secret"
      user.save!
      session[:login_aac_skip_canvas_mfa] = true
      session[:mfa_verified_ips] = ["1.2.3.4"]
      request.env["REMOTE_ADDR"] = "9.9.9.9"
    end

    around do |example|
      override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) { example.run }
    end

    it_behaves_like "allows request through"

    it "does not emit any mfa events" do
      allow(InstStatsd::Statsd).to receive(:event)
      get :index, format: :html
      expect(InstStatsd::Statsd).not_to have_received(:event).with(a_string_starting_with("MFA"), anything, anything)
    end
  end

  context "when authenticated via API token" do
    before do
      routes.draw { get "api/v1/check_mfa_test" => "anonymous#index" }
      user.otp_secret_key = "secret"
      user.save!
      session[:mfa_verified_ips] = ["1.2.3.4"]
      session[:mfa_verified_uas] = [Digest::MD5.hexdigest("a different browser")]
      request.env["REMOTE_ADDR"] = "9.9.9.9"
      enable_developer_key_account_binding!(DeveloperKey.default)
      token = user.access_tokens.create!(purpose: "test")
      request.headers["Authorization"] = "Bearer #{token.full_token}"
    end

    around do |example|
      override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true, "mfa_ua_enforce_all_mfa_users" => true } } }) { example.run }
    end

    it_behaves_like "allows request through"

    it "does not emit mfa mismatch events" do
      allow(InstStatsd::Statsd).to receive(:event)
      get :index
      expect(InstStatsd::Statsd).not_to have_received(:event).with("MFA IP Mismatch", anything, anything)
      expect(InstStatsd::Statsd).not_to have_received(:event).with("MFA UA Mismatch", anything, anything)
    end
  end

  context "when mfa_verified_ips is absent (pre-existing session)" do
    before do
      user.otp_secret_key = "secret"
      user.save!
      request.env["REMOTE_ADDR"] = "9.9.9.9"
    end

    context "with no enforcement keys set" do
      around { |example| override_dynamic_settings({}) { example.run } }

      it_behaves_like "allows request through"
    end

    context "with mfa_ip_enforce_all_mfa_users: true" do
      around do |example|
        override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) { example.run }
      end

      it_behaves_like "enforces mfa ip"
    end
  end

  context "when IP differs from stored MFA IPs" do
    before do
      user.otp_secret_key = "secret"
      user.save!
      session[:mfa_verified_ips] = ["1.2.3.4"]
      request.env["REMOTE_ADDR"] = "9.9.9.9"
    end

    context "with no enforcement keys set" do
      around { |example| override_dynamic_settings({}) { example.run } }

      it_behaves_like "emits mfa_ip_mismatch event", user_type: "regular"
      it_behaves_like "allows request through"
    end

    context "with mfa_ip_enforce_site_admins: true" do
      around do |example|
        override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_site_admins" => true } } }) { example.run }
      end

      context "for a site admin" do
        let(:user) { site_admin_user }

        it_behaves_like "emits mfa_ip_mismatch event", user_type: "site_admin"
        it_behaves_like "enforces mfa ip"

        context "with enforce_session_fingerprinting turned off" do
          before do
            Account.default.disable_feature!(:enforce_session_fingerprinting)
          end

          it_behaves_like "emits mfa_ip_mismatch event", user_type: "site_admin"
          it_behaves_like "allows request through"
        end
      end

      context "for an account admin" do
        let(:user) { account_admin_user(account: Account.default) }

        it_behaves_like "emits mfa_ip_mismatch event", user_type: "account_admin"
        it_behaves_like "allows request through"
      end

      context "for a regular user" do
        it_behaves_like "emits mfa_ip_mismatch event", user_type: "regular"
        it_behaves_like "allows request through"
      end

      context "when a site admin is masquerading as a regular user" do
        let(:masquerader) { site_admin_user }

        before do
          Account.site_admin.settings[:mfa_settings] = :optional
          Account.site_admin.save!
          masquerader.pseudonyms.create!(unique_id: "admin@instructure.com", account: Account.site_admin)
          masquerader.otp_secret_key = "secret"
          masquerader.save!
          controller.instance_variable_set(:@real_current_user, masquerader)
        end

        it_behaves_like "emits mfa_ip_mismatch event", user_type: "site_admin"
        it_behaves_like "enforces mfa ip"
      end
    end

    context "with mfa_ip_enforce_account_admins: true" do
      around do |example|
        override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_account_admins" => true } } }) { example.run }
      end

      context "for a site admin" do
        let(:user) { site_admin_user }

        it_behaves_like "emits mfa_ip_mismatch event", user_type: "site_admin"
        it_behaves_like "allows request through"
      end

      context "for an account admin" do
        let(:user) { account_admin_user(account: Account.default) }

        it_behaves_like "emits mfa_ip_mismatch event", user_type: "account_admin"
        it_behaves_like "enforces mfa ip"
      end

      context "for a regular user" do
        it_behaves_like "emits mfa_ip_mismatch event", user_type: "regular"
        it_behaves_like "allows request through"
      end
    end

    context "with mfa_ip_enforce_all_mfa_users: true" do
      around do |example|
        override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) { example.run }
      end

      context "for a site admin" do
        let(:user) { site_admin_user }

        it_behaves_like "emits mfa_ip_mismatch event", user_type: "site_admin"
        it_behaves_like "enforces mfa ip"
      end

      context "for an account admin" do
        let(:user) { account_admin_user(account: Account.default) }

        it_behaves_like "emits mfa_ip_mismatch event", user_type: "account_admin"
        it_behaves_like "enforces mfa ip"
      end

      context "for a regular user" do
        it_behaves_like "emits mfa_ip_mismatch event", user_type: "regular"
        it_behaves_like "enforces mfa ip"
      end
    end
  end

  context "user agent verification" do
    let(:ua) { "Mozilla/5.0 (test browser)" }
    let(:ua_md5) { Digest::MD5.hexdigest(ua) }

    before do
      user.otp_secret_key = "secret"
      user.save!
      request.env["HTTP_USER_AGENT"] = ua
    end

    it "allows the request when both the IP and the UA hash are in the verified lists" do
      session[:mfa_verified_ips] = [request.remote_ip]
      session[:mfa_verified_uas] = [ua_md5]
      override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true, "mfa_ua_enforce_all_mfa_users" => true } } }) do
        get :index, format: :html
      end
      expect(response).to be_successful
    end

    it "emits canvas.mfa_request even when both IP and UA match" do
      session[:mfa_verified_ips] = [request.remote_ip]
      session[:mfa_verified_uas] = [ua_md5]
      allow(InstStatsd::Statsd).to receive(:event)
      expect(InstStatsd::Statsd).to receive(:event)
        .with("MFA Request", "canvas.mfa_request", type: :mfa_request, alert_type: :info, tags: hash_including(user_type: "regular"))
      get :index, format: :html
    end

    it "compares against the MD5 hash, not the raw UA string" do
      session[:mfa_verified_ips] = [request.remote_ip]
      session[:mfa_verified_uas] = [ua]
      override_dynamic_settings({ private: { canvas: { "mfa_ua_enforce_all_mfa_users" => true } } }) do
        get :index, format: :html
      end
      expect(response).to redirect_to(otp_login_url)
    end

    context "when only the UA differs from stored UAs (IP matches)" do
      before do
        session[:mfa_verified_ips] = [request.remote_ip]
        session[:mfa_verified_uas] = [Digest::MD5.hexdigest("a different browser")]
      end

      it "emits canvas.mfa_ua_mismatch tagged user_type:regular" do
        allow(InstStatsd::Statsd).to receive(:event)
        expect(InstStatsd::Statsd).to receive(:event)
          .with("MFA UA Mismatch", "canvas.mfa_ua_mismatch", type: :mfa_ua_mismatch, alert_type: :warning, tags: hash_including(user_type: "regular"))
        get :index, format: :html
      end

      it "does not emit canvas.mfa_ip_mismatch" do
        allow(InstStatsd::Statsd).to receive(:event)
        get :index, format: :html
        expect(InstStatsd::Statsd).not_to have_received(:event).with("MFA IP Mismatch", anything, anything)
      end

      context "with no UA enforcement keys set" do
        around { |example| override_dynamic_settings({}) { example.run } }

        it_behaves_like "allows request through"
      end

      context "with mfa_ua_enforce_all_mfa_users: true" do
        around do |example|
          override_dynamic_settings({ private: { canvas: { "mfa_ua_enforce_all_mfa_users" => true } } }) { example.run }
        end

        it_behaves_like "enforces mfa ip"
      end

      context "with mfa_ua_enforce_site_admins: true" do
        around do |example|
          override_dynamic_settings({ private: { canvas: { "mfa_ua_enforce_site_admins" => true } } }) { example.run }
        end

        context "for a site admin" do
          let(:user) { site_admin_user }

          it_behaves_like "enforces mfa ip"
        end

        context "for a regular user" do
          it_behaves_like "allows request through"
        end
      end

      context "with mfa_ua_enforce_account_admins: true" do
        around do |example|
          override_dynamic_settings({ private: { canvas: { "mfa_ua_enforce_account_admins" => true } } }) { example.run }
        end

        context "for an account admin" do
          let(:user) { account_admin_user(account: Account.default) }

          it_behaves_like "enforces mfa ip"
        end

        context "for a regular user" do
          it_behaves_like "allows request through"
        end
      end
    end

    context "when both IP and UA differ from stored values" do
      before do
        session[:mfa_verified_ips] = ["1.2.3.4"]
        session[:mfa_verified_uas] = [Digest::MD5.hexdigest("a different browser")]
        request.env["REMOTE_ADDR"] = "9.9.9.9"
      end

      it "emits both canvas.mfa_ip_mismatch and canvas.mfa_ua_mismatch" do
        allow(InstStatsd::Statsd).to receive(:event)
        expect(InstStatsd::Statsd).to receive(:event)
          .with("MFA IP Mismatch", "canvas.mfa_ip_mismatch", type: :mfa_ip_mismatch, alert_type: :warning, tags: hash_including(user_type: "regular"))
        expect(InstStatsd::Statsd).to receive(:event)
          .with("MFA UA Mismatch", "canvas.mfa_ua_mismatch", type: :mfa_ua_mismatch, alert_type: :warning, tags: hash_including(user_type: "regular"))
        get :index, format: :html
      end

      context "with only mfa_ip_enforce_all_mfa_users: true" do
        around do |example|
          override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) { example.run }
        end

        it_behaves_like "enforces mfa ip"
      end

      context "with only mfa_ua_enforce_all_mfa_users: true" do
        around do |example|
          override_dynamic_settings({ private: { canvas: { "mfa_ua_enforce_all_mfa_users" => true } } }) { example.run }
        end

        it_behaves_like "enforces mfa ip"
      end

      context "with neither IP nor UA enforcement keys set" do
        around { |example| override_dynamic_settings({}) { example.run } }

        it_behaves_like "allows request through"
      end

      context "when enforcement triggers" do
        around do |example|
          override_dynamic_settings({ private: { canvas: { "mfa_ua_enforce_all_mfa_users" => true } } }) { example.run }
        end

        it "stores the current location so the user returns there after entering OTP" do
          get :index, format: :html
          expect(session[:return_to]).to be_present
        end
      end
    end
  end

  context "when enforce_session_fingerprinting is disabled and there is a mismatch" do
    let(:ua) { "Mozilla/5.0 (test browser)" }
    let(:ua_md5) { Digest::MD5.hexdigest(ua) }

    before do
      user.otp_secret_key = "secret"
      user.save!
      Account.default.disable_feature!(:enforce_session_fingerprinting)
      request.env["HTTP_USER_AGENT"] = ua
    end

    context "when IP differs from stored MFA IPs" do
      before do
        session[:mfa_verified_ips] = ["1.2.3.4"]
        session[:mfa_verified_uas] = [ua_md5]
        request.env["REMOTE_ADDR"] = "9.9.9.9"
      end

      it "stores the current IP in mfa_verified_ips so subsequent requests don't re-log" do
        get :index, format: :html
        expect(session[:mfa_verified_ips]).to include("9.9.9.9")
      end

      it "allows the request through" do
        get :index, format: :html
        expect(response).to be_successful
      end
    end

    context "when UA differs from stored MFA UAs" do
      before do
        session[:mfa_verified_ips] = [request.remote_ip]
        session[:mfa_verified_uas] = [Digest::MD5.hexdigest("an old browser")]
      end

      it "stores the current UA hash in mfa_verified_uas so subsequent requests don't re-log" do
        get :index, format: :html
        expect(session[:mfa_verified_uas]).to include(ua_md5)
      end

      it "allows the request through" do
        get :index, format: :html
        expect(response).to be_successful
      end
    end
  end

  context "when enforce_session_fingerprinting is enabled and enforcement triggers" do
    before do
      user.otp_secret_key = "secret"
      user.save!
      session[:mfa_verified_ips] = ["1.2.3.4"]
      request.env["REMOTE_ADDR"] = "9.9.9.9"
    end

    around do |example|
      override_dynamic_settings({ private: { canvas: { "mfa_ip_enforce_all_mfa_users" => true } } }) { example.run }
    end

    it "does not add the current IP to mfa_verified_ips" do
      get :index, format: :html
      expect(session[:mfa_verified_ips]).not_to include("9.9.9.9")
    end
  end

  context "canvas_mfa_required?" do
    it "does not search all of the user's pseudonyms" do
      user.otp_secret_key = "secret"
      user.save!
      expect(user).not_to receive(:mfa_settings)

      get :index, format: :html
    end
  end
end

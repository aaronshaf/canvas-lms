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

describe Login::CanvasController, type: :request do
  before :once do
    user_with_pseudonym(username: "jtfrd@instructure.com", active_all: 1, password: "qwertyuiop")
  end

  describe "mobile layout decision" do
    let(:mobile_agents) do
      [
        "Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5",
        "Mozilla/5.0 (iPod; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5",
        "Mozilla/5.0 (Linux; U; Android 2.2; en-us; SCH-I800 Build/FROYO) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
        "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Sprint APA9292KT Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1",
        "Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1"
      ]
    end

    def confirm_mobile_layout
      mobile_agents.each do |agent|
        yield agent
        expect(response).to render_template(:mobile_login)
      end
    end

    it "renders normal layout if not iphone/ipod" do
      get "/login/canvas"
      expect(response).to render_template(:new)
    end

    it "renders special iPhone/iPod layout if coming from one of those" do
      confirm_mobile_layout do |agent|
        get "/login/canvas", headers: { "HTTP_USER_AGENT" => agent }
      end
    end

    it "renders special iPhone/iPod layout if coming from one of those and it's the wrong password'" do
      confirm_mobile_layout do |agent|
        post "/login/canvas", headers: { "HTTP_USER_AGENT" => agent }
      end
    end

    it "renders a plain text error message on mobile, not the hash" do
      post "/login/canvas",
           params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "" } },
           headers: { "HTTP_USER_AGENT" => mobile_agents[0] }
      expect(flash[:error]).to be_a(String)
    end
  end

  describe "login_registration_ui_identity feature flag" do
    before do
      if feature_flag_enabled
        Account.default.enable_feature!(:login_registration_ui_identity)
      else
        Account.default.disable_feature!(:login_registration_ui_identity)
      end
    end

    context "when the feature flag is enabled" do
      let(:feature_flag_enabled) { true }

      it "renders the new login page" do
        get "/login/canvas"
        expect(response).to render_template("login/canvas/new_login")
      end

      it "sets @exclude_account_css and @exclude_account_js to true" do
        get "/login/canvas"
        expect(response).to be_successful
        # Verify the new_login template was rendered (only exists when CSS/JS excluded)
        expect(response.body).to include('id="new_login_data"')
        expect(response.body).to include('id="new_login_safe_to_mount"')
      end
    end

    context "when the feature flag is disabled" do
      let(:feature_flag_enabled) { false }

      it "renders the old login page" do
        get "/login/canvas"
        expect(response).to render_template(:new)
      end

      it "does not set @exclude_account_css or @exclude_account_js" do
        get "/login/canvas"
        expect(response).to be_successful
        # Verify the old login template was rendered (appears when CSS/JS are not excluded)
        expect(response.body).to include("class=\"ic-Login")
        expect(response.body).to include("ic-Login__container")
      end
    end
  end

  describe "manage_robots_meta" do
    let(:domain_root_account) { Account.default }

    context "when disable_login_search_indexing? is true and enable_search_indexing? is true" do
      it "sets @allow_robot_indexing to false" do
        domain_root_account.settings = { disable_login_search_indexing: true, enable_search_indexing: true }
        domain_root_account.save!
        get "/login/canvas"
        expect(response.body).to include('<meta name="robots" content="noindex,nofollow"')
      end
    end

    context "when disable_login_search_indexing? is false" do
      it "does not set @allow_robot_indexing to false" do
        domain_root_account.settings = { disable_login_search_indexing: false, enable_search_indexing: true }
        domain_root_account.save!
        get "/login/canvas"
        expect(response.body).not_to include('<meta name="robots" content="noindex,nofollow"')
      end
    end

    context "when enable_search_indexing? is false" do
      it "does not set @allow_robot_indexing to false" do
        domain_root_account.settings = { disable_login_search_indexing: true, enable_search_indexing: false }
        domain_root_account.save!
        get "/login/canvas"
        expect(response.body).to include('<meta name="robots" content="noindex,nofollow"')
      end
    end
  end

  describe "params[:message] flash" do
    it "sets flash.now[:error] for a plain string message" do
      get "/login/canvas", params: { message: "something went wrong" }
      # In request specs, flash.now values are only available during rendering,
      # check the response instead
      expect(response.body).to include("something went wrong")
    end

    it "does not set flash.now[:error] for a hash-shaped message" do
      get "/login/canvas", params: { message: { html: "<a>1</a>" } }
      expect(response).to be_successful
      # Hash-shaped messages should not show up as plain text error messages in the response
      expect(response.body).not_to include("<a>1</a>")
    end
  end

  it "shows sso buttons on load" do
    Account.default.authentication_providers.create!(auth_type: "facebook")
    allow(Canvas::Plugin.find(:facebook)).to receive(:settings).and_return({})
    get "/login/canvas"
    expect(response.body).to match(/facebook|sso|authentication/i)
  end

  it "still shows sso buttons on login error" do
    Account.default.authentication_providers.create!(auth_type: "facebook")
    allow(Canvas::Plugin.find(:facebook)).to receive(:settings).and_return({})
    post "/login/canvas"
    expect(response).not_to be_successful
    expect(response.body).to match(/facebook|sso|authentication/i)
  end

  it "re-renders if no user" do
    post "/login/canvas"
    assert_status(400)
    expect(response).to render_template(:new)
  end

  it "re-renders if incorrect password" do
    post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "dvorak" } }
    assert_status(400)
    expect(response).to render_template(:new)
  end

  it "re-renders if no password given and render a hash for the error" do
    post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "" } }
    assert_status(400)
    expect(response).to render_template(:new)
    # In request specs, check response body for error message instead of flash
    expect(response.body).to match(/no password/i)
  end

  it "password auth should work" do
    post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "qwertyuiop" } }
    expect(response).to be_redirect
    expect(response).to redirect_to(dashboard_url(login_success: 1))
    expect(session[:pseudonym_credentials_id]).to eq @pseudonym.global_id
  end

  it "doesn't allow suspended users" do
    @pseudonym.update!(workflow_state: "suspended")
    post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "qwertyuiop" } }
    assert_status(400)
    expect(response).to render_template(:new)
  end

  it "persists the auth provider if the feature flag is enabled" do
    Account.default.enable_feature!(:persist_inferred_authentication_providers)
    post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "qwertyuiop" } }
    expect(response).to be_redirect
    expect(response).to redirect_to(dashboard_url(login_success: 1))
    # Verify the auth provider was persisted by checking the reloaded pseudonym
    expect(@pseudonym.reload.authentication_provider).to eq Account.default.canvas_authentication_provider
  end

  it "sets, but does not persist, the auth provider if the feature flag is not enabled" do
    post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "qwertyuiop" } }
    expect(response).to be_redirect
    expect(response).to redirect_to(dashboard_url(login_success: 1))
    # the auth provider did not get set on the pseudonym
    expect(@pseudonym.reload.authentication_provider).to be_nil
  end

  it "password auth should work for an explicit Canvas pseudonym" do
    @pseudonym.update_attribute(:authentication_provider, Account.default.canvas_authentication_provider)
    post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "qwertyuiop" } }
    expect(response).to be_redirect
    expect(response).to redirect_to(dashboard_url(login_success: 1))
    expect(session[:pseudonym_credentials_id]).to eq @pseudonym.global_id
  end

  it "password auth should work with extra whitespace around unique id" do
    post "/login/canvas", params: { pseudonym_session: { unique_id: " jtfrd@instructure.com ", password: "qwertyuiop" } }
    expect(response).to be_redirect
    expect(response).to redirect_to(dashboard_url(login_success: 1))
    expect(session[:pseudonym_credentials_id]).to eq @pseudonym.global_id
  end

  it "re-renders if authenticity token is invalid" do
    allow_any_instance_of(Login::CanvasController).to receive(:verify_authenticity_token).and_raise(ActionController::InvalidAuthenticityToken)
    post "/login/canvas", params: { pseudonym_session: { unique_id: " jtfrd@instructure.com ", password: "qwertyuiop" },
                                    authenticity_token: "42" }
    assert_status(400)
    expect(response).to render_template(:new)
    # In request specs, check response body for error message
    expect(response.body).to match(/invalid authenticity token/i)
  end

  it "logins if authenticity token is invalid and referer is trusted" do
    expect_any_instance_of(Account).to receive(:trusted_referer?).and_return(true)
    post "/login/canvas", params: { pseudonym_session: { unique_id: " jtfrd@instructure.com ", password: "qwertyuiop" } }
    expect(response).to be_redirect
    expect(response).to redirect_to(dashboard_url(login_success: 1))
    expect(session[:pseudonym_credentials_id]).to eq @pseudonym.global_id
  end

  it "rejects canvas auth if Canvas auth is disabled" do
    Account.default.authentication_providers.create!(auth_type: "ldap")
    Account.default.canvas_authentication_provider.destroy
    get "/login/canvas"
    assert_status(404)
  end

  context "ldap" do
    it "logs in a user with a identifier_format" do
      user_with_pseudonym(username: "12345", active_all: 1)
      @pseudonym.update_attribute(:sis_user_id, "12345")
      aac = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
      expect_any_instantiation_of(aac).to receive(:ldap_bind_result).once
                                                                    .with("username", "password")
                                                                    .and_return([{ "uid" => ["12345"] }])
      Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
      expect_any_instantiation_of(aac).not_to receive(:ldap_bind_result)
      post "/login/canvas", params: { pseudonym_session: { unique_id: "username", password: "password" } }
      expect(response).to be_redirect
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      # Verify auth provider was set on pseudonym by checking reload
      expect(@pseudonym.reload.authentication_provider).to be_nil
    end

    it "works for a pseudonym explicitly linked to LDAP" do
      user_with_pseudonym(username: "12345", active_all: 1)
      aac = Account.default.authentication_providers.create!(auth_type: "ldap")
      expect_any_instantiation_of(@pseudonym).to receive(:valid_arbitrary_credentials?).and_return(true)
      @pseudonym.update_attribute(:authentication_provider, aac)
      post "/login/canvas", params: { pseudonym_session: { unique_id: "12345", password: "password" } }
      expect(response).to be_redirect
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      expect(session[:pseudonym_credentials_id]).to eq @pseudonym.global_id
      expect(@pseudonym.reload.authentication_provider).to eq aac
    end

    it "ignores a pseudonym explicitly linked to a different LDAP" do
      user_with_pseudonym(username: "12345", active_all: 1)
      aac = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
      aac2 = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
      expect_any_instantiation_of(aac).to receive(:ldap_bind_result).once
                                                                    .with("username", "password")
                                                                    .and_return([{ "uid" => ["12345"] }])
      expect_any_instantiation_of(aac2).to receive(:ldap_bind_result).once
                                                                     .with("username", "password")
                                                                     .and_return(nil)
      @pseudonym.update_attribute(:authentication_provider, aac2)
      post "/login/canvas", params: { pseudonym_session: { unique_id: "username", password: "password" } }
      assert_status(400)
    end

    it "only queries the LDAP server once, even with a differing identifier_format but a matching pseudonym" do
      user_with_pseudonym(username: "username", active_all: 1)
      aac = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
      expect_any_instantiation_of(aac).to receive(:ldap_bind_result).once.with("username", "password").and_return(nil)
      post "/login/canvas", params: { pseudonym_session: { unique_id: "username", password: "password" } }
      assert_status(400)
      expect(response).to render_template(:new)
    end

    it "doesn't query the server at all if the enabled features don't require it, and there is no matching login" do
      ap = Account.default.authentication_providers.create!(auth_type: "ldap")
      expect_any_instantiation_of(ap).not_to receive(:ldap_bind_result)
      post "/login/canvas", params: { pseudonym_session: { unique_id: "username", password: "password" } }
      assert_status(400)
      expect(response).to render_template(:new)
    end

    it "provisions automatically when enabled" do
      ap = Account.default.authentication_providers.create!(auth_type: "ldap", jit_provisioning: true)
      expect_any_instantiation_of(ap).to receive(:ldap_bind_result).once
                                                                   .with("username", "password")
                                                                   .and_return([{ "uid" => ["12345"] }])
      unique_id = "username"
      expect(Account.default.pseudonyms.active.by_unique_id(unique_id)).not_to be_exists

      post "/login/canvas", params: { pseudonym_session: { unique_id: "username", password: "password" } }
      expect(response).to be_redirect
      expect(response).to redirect_to(dashboard_url(login_success: 1))

      p = Account.default.pseudonyms.active.by_unique_id(unique_id).first!
      expect(p.authentication_provider).to eq ap
    end

    context "should properly set the session[:login_aac]" do
      it "when an ldap authentication provider was used with identifier_format" do
        user_with_pseudonym(username: "12345", active_all: 1)
        @pseudonym.update_attribute(:sis_user_id, "12345")
        aac1 = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
        expect_any_instantiation_of(aac1).to receive(:ldap_bind_result).once
                                                                       .with("username", "password")
                                                                       .and_return(nil)
        aac2 = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
        expect_any_instantiation_of(aac2).to receive(:ldap_bind_result).once
                                                                       .with("username", "password")
                                                                       .and_return([{ "uid" => ["12345"] }])

        post "/login/canvas", params: { pseudonym_session: { unique_id: "username", password: "password" } }
        expect(response).to be_redirect
        expect(response).to redirect_to(dashboard_url(login_success: 1))
        expect(session[:login_aac]).to eq aac2.id
      end

      it "when an ldap authentication provider was used without an identifier_format" do
        user_with_pseudonym(username: "username", active_all: 1)
        aac1 = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: nil)
        expect_any_instantiation_of(aac1).to receive(:ldap_bind_result).once
                                                                       .with("username", "password")
                                                                       .and_return(nil)
        aac2 = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: nil)
        expect_any_instantiation_of(aac2).to receive(:ldap_bind_result).once
                                                                       .with("username", "password")
                                                                       .and_return([{}])

        post "/login/canvas", params: { pseudonym_session: { unique_id: "username", password: "password" } }
        expect(response).to be_redirect
        expect(response).to redirect_to(dashboard_url(login_success: 1))
        expect(session[:login_aac]).to eq aac2.id
      end

      it "when canvas authentication was used" do
        password = "correct-horse-battery-staple"
        user_with_pseudonym(username: "12345", active_all: 1, password:)
        aac1 = Account.default.authentication_providers.create!(auth_type: "ldap", identifier_format: "uid")
        expect_any_instantiation_of(aac1).to receive(:ldap_bind_result).once.and_return(nil)
        aac2 = Account.default.authentication_providers.find_by(auth_type: "canvas")

        post "/login/canvas", params: { pseudonym_session: { unique_id: "12345", password: } }
        expect(response).to be_redirect
        expect(response).to redirect_to(dashboard_url(login_success: 1))
        expect(session[:login_aac]).to eq aac2.id
      end
    end
  end

  context "trusted logins" do
    it "logins for a pseudonym from a different account" do
      account = Account.create!
      allow_any_instantiation_of(Account.default).to receive(:trusted_account_ids).and_return([account.id])
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account:)
      Account.default.pseudonyms.create!(user: @user, unique_id: "someone")
      post "/login/canvas", params: { pseudonym_session: { unique_id: "jt@instructure.com", password: "qwertyuiop" } }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      expect(flash[:notice]).to be_present
    end

    it "sends users to their home domain if they have no associations with the current account" do
      account = Account.create!
      allow_any_instantiation_of(Account.default).to receive(:trusted_account_ids).and_return([account.id])
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account:)
      # In request specs, need to provide the actual host that the test is using
      host = "test.host"
      allow(HostUrl).to receive(:context_host).with(Account.default, host).and_return("account")
      allow(HostUrl).to receive(:context_host).with(account, host).and_return("account2")
      # Make request with the specific host
      post "/login/canvas",
           params: { pseudonym_session: { unique_id: "jt@instructure.com", password: "qwertyuiop" } },
           headers: { "HTTP_HOST" => host }
      expect(response).to be_redirect
      # Verify the redirect is to the home account's dashboard
      expect(response.location).to include("account2")
    end

    it "doesn't send admins elsewhere" do
      account = Account.create!
      allow_any_instantiation_of(Account.default).to receive(:trusted_account_ids).and_return([account.id])
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account:)
      Account.default.account_users.create!(user: @user)
      allow(HostUrl).to receive(:context_host).with(Account.default, "test.host").and_return("account")
      allow(HostUrl).to receive(:context_host).with(account, "test.host").and_return("account2")
      post "/login/canvas", params: { pseudonym_session: { unique_id: "jt@instructure.com", password: "qwertyuiop" } }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      expect(flash[:notice]).to be_present
    end

    it "logins for a user with multiple identical pseudonyms" do
      account1 = Account.create!
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account: account1)
      Account.default.pseudonyms.create!(user: @user, unique_id: "someone")
      @pseudonym = @user.pseudonyms.create!(account: Account.site_admin,
                                            unique_id: "jt@instructure.com",
                                            password: "qwertyuiop",
                                            password_confirmation: "qwertyuiop")
      post "/login/canvas", params: { pseudonym_session: { unique_id: "jt@instructure.com", password: "qwertyuiop" } }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      # it should have preferred the site admin pseudonym - verify via redirect
    end

    it "does not login for multiple users with identical pseudonyms" do
      account1 = Account.create!
      account2 = Account.create!
      allow_any_instantiation_of(Account.default).to receive(:trusted_account_ids).and_return([account1.id, account2.id])
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account: account1)
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account: account2)
      post "/login/canvas", params: { pseudonym_session: { unique_id: "jt@instructure.com", password: "qwertyuiop" } }
      expect(response).not_to be_successful
      expect(response).to render_template(:new)
    end

    it "logins a site admin user with other identical pseudonyms" do
      account1 = Account.create!
      allow_any_instantiation_of(Account.default).to receive(:trusted_account_ids).and_return([account1.id, Account.site_admin.id])
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account: account1)
      user_with_pseudonym(username: "jt@instructure.com",
                          active_all: 1,
                          password: "qwertyuiop",
                          account: Account.site_admin)
      Account.default.pseudonyms.create!(user: @user, unique_id: "someone")
      post "/login/canvas", params: { pseudonym_session: { unique_id: "jt@instructure.com", password: "qwertyuiop" } }
      expect(response).to redirect_to(dashboard_url(login_success: 1))
      # it should have preferred the site admin pseudonym
    end

    context "sharding" do
      specs_require_sharding

      it "logins for a user from a different shard" do
        user_with_pseudonym(username: "jt@instructure.com",
                            active_all: 1,
                            password: "qwertyuiop",
                            account: Account.site_admin)
        Account.default.pseudonyms.create!(user: @user, unique_id: "someone")
        @shard1.activate do
          account = Account.create!
          allow(HostUrl).to receive(:default_domain_root_account).and_return(account)
          post "/login/canvas", params: { pseudonym_session: { unique_id: "jt@instructure.com", password: "qwertyuiop" } }
          expect(response).to redirect_to(dashboard_url(login_success: 1))
          expect(session[:pseudonym_credentials_id]).to eq @pseudonym.global_id
        end
      end
    end
  end

  context "merging" do
    it "redirects back to merge users" do
      communication_channel(@user, { username: "jt+1@instructure.com" })
      post "/login/canvas", params: { pseudonym_session: { unique_id: "jtfrd@instructure.com", password: "qwertyuiop" } }
      # In request specs, verify redirect occurs with login_success parameter
      expect(response).to be_redirect
      expect(response.location).to include("login_success=1")
    end
  end

  context "otp" do
    context "when mfa is optional in account level" do
      before :once do
        Account.default.settings[:mfa_settings] = :optional
        Account.default.save!
        user_with_pseudonym(active_all: 1, password: "qwertyuiop")
      end

      context "and canvas mfa is set to enforce" do
        before :once do
          auth_provider = Account.default.canvas_authentication_provider
          auth_provider.mfa_required = true
          auth_provider.save!
          @pseudonym.update(authentication_provider: auth_provider)
        end

        it "does ask for verification if the user has NOT configured mfa" do
          post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }

          expect(response).to redirect_to otp_login_url
        end

        it "does ask for verification if the user has configured mfa" do
          @user.otp_secret_key = ROTP::Base32.random
          @user.save!

          post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }

          expect(response).to redirect_to otp_login_url
        end
      end

      context "and canvas mfa is set to opt in" do
        before :once do
          auth_provider = Account.default.canvas_authentication_provider
          auth_provider.mfa_required = false
          auth_provider.save!
          @pseudonym.update(authentication_provider: auth_provider)
        end

        it "does NOT ask for verification if the user has NOT configured mfa" do
          post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }

          expect(response).to redirect_to dashboard_url(login_success: 1)
        end

        it "does ask for verification if the user has configured mfa" do
          @user.otp_secret_key = ROTP::Base32.random
          @user.save!

          post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }

          expect(response).to redirect_to otp_login_url
        end
      end
    end

    context "when mfa is required in account level" do
      it "does NOT ask for verification if the mfa is disabled for the provider" do
        Account.default.settings[:mfa_settings] = :required
        Account.default.save!
        user_with_pseudonym(active_all: 1, password: "qwertyuiop")
        @user.otp_secret_key = ROTP::Base32.random
        @user.save!
        auth_provider = Account.default.canvas_authentication_provider
        @pseudonym.update(authentication_provider: auth_provider)
        auth_provider.skip_internal_mfa = true
        auth_provider.save!

        post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
        expect(response).to redirect_to dashboard_url(login_success: 1)
      end

      it "records that the provider opted out of Canvas MFA so the fingerprint check is skipped" do
        Account.default.settings[:mfa_settings] = :required
        Account.default.save!
        user_with_pseudonym(active_all: 1, password: "qwertyuiop")
        @user.otp_secret_key = ROTP::Base32.random
        @user.save!
        auth_provider = Account.default.canvas_authentication_provider
        @pseudonym.update(authentication_provider: auth_provider)
        auth_provider.skip_internal_mfa = true
        auth_provider.save!

        post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
        expect(session[:login_aac_skip_canvas_mfa]).to be true
      end

      it "does not flag the session to skip Canvas MFA when the provider enforces it" do
        Account.default.settings[:mfa_settings] = :required
        Account.default.save!
        user_with_pseudonym(active_all: 1, password: "qwertyuiop")
        @user.otp_secret_key = ROTP::Base32.random
        @user.save!
        auth_provider = Account.default.canvas_authentication_provider
        @pseudonym.update(authentication_provider: auth_provider)

        post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
        expect(session[:login_aac_skip_canvas_mfa]).to be_falsey
      end
    end
  end

  context "otp login cookie" do
    before :once do
      Account.default.settings[:mfa_settings] = :required
      Account.default.save!

      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
      @user.otp_secret_key = ROTP::Base32.random
      @user.save!
    end

    before do
      allow_any_instance_of(ActionController::TestRequest).to receive(:remote_ip).and_return("127.0.0.1")
    end

    it "skips otp verification for a valid cookie" do
      cookies["canvas_otp_remember_me"] = @user.otp_secret_key_remember_me_cookie(Time.now.utc, nil, "127.0.0.1")
      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
      expect(response).to redirect_to dashboard_url(login_success: 1)
    end

    it "ignores a bogus cookie" do
      cookies["canvas_otp_remember_me"] = "bogus"
      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
      expect(response).to redirect_to(otp_login_url)
    end

    it "ignores an expired cookie" do
      cookies["canvas_otp_remember_me"] = @user.otp_secret_key_remember_me_cookie(6.months.ago, nil, "127.0.0.1")
      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
      expect(response).to redirect_to(otp_login_url)
    end

    it "ignores a cookie from an old secret_key" do
      cookies["canvas_otp_remember_me"] = @user.otp_secret_key_remember_me_cookie(6.months.ago, nil, "127.0.0.1")

      @user.otp_secret_key = ROTP::Base32.random
      @user.save!

      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
      expect(response).to redirect_to(otp_login_url)
    end

    it "ignores a cookie for a different IP" do
      cookies["canvas_otp_remember_me"] = @user.otp_secret_key_remember_me_cookie(Time.now.utc, nil, "127.0.0.2")
      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
      expect(response).to redirect_to(otp_login_url)
    end
  end

  context "oauth" do
    before :once do
      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
    end

    before do
      redis = instance_double(Redis)
      allow(redis).to receive_messages(setex: nil, hget: nil, hmget: nil, del: nil, pipelined: nil)
      allow(Canvas::Security::LoginRegistry).to receive_messages(redis:)
    end

    let_once(:key) { DeveloperKey.create!(name: "Test Developer Key", redirect_uri: "https://example.com") }
    let(:params) { { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } } }

    it "redirects to the confirm url if the user has no token" do
      provider = Canvas::OAuth::Provider.new(key.id, key.redirect_uri, [], nil)
      post "/login/canvas", params:, as: :json
      post "/login/canvas", params:, headers: { HTTP_X_OAUTH2: provider.session_hash.to_json }
      # OAuth flow results in a redirect to the authorization URL
      expect(response).to be_redirect
    end

    it "redirects to the redirect uri if the user already has remember-me token" do
      enable_developer_key_account_binding!(key)
      key.update!(trusted: true)
      @user.access_tokens.create!(developer_key: key, remember_access: true, scopes: ["/auth/userinfo"])

      # Set up OAuth session first
      get "/login/oauth2/auth",
          params: {
            client_id: key.id,
            redirect_uri: key.redirect_uri,
            scope: "/auth/userinfo",
            response_type: "code"
          }

      # Then login - with remembered token on trusted key, JSON response includes OAuth redirect
      post "/login/canvas", params:, as: :json
      expect(response).to be_successful
      expect(response.parsed_body["location"]).to start_with(key.redirect_uri)
    end

    it "does not reuse userinfo tokens for other scopes" do
      enable_developer_key_account_binding!(key)
      @user.access_tokens.create!(developer_key: key, remember_access: true, scopes: ["/auth/userinfo"], purpose: nil)

      # Set up OAuth session requesting different scopes than the token has
      get "/login/oauth2/auth",
          params: {
            client_id: key.id,
            redirect_uri: key.redirect_uri,
            scope: "",
            response_type: "code"
          }

      # Login - should redirect to confirmation page since token scopes don't match
      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }

      expect(response).to be_redirect
      expect(response.location).to include("/login/oauth2/confirm")
    end

    it "redirects to the redirect uri if the developer key is trusted" do
      enable_developer_key_account_binding!(key)
      key.update!(trusted: true)

      # Set up OAuth session
      get "/login/oauth2/auth",
          params: {
            client_id: key.id,
            redirect_uri: key.redirect_uri,
            scope: "",
            response_type: "code"
          }

      # Login - should redirect directly to OAuth provider since key is trusted
      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }

      expect(response).to be_redirect
      expect(response.location).to match(%r{https://example.com})
    end

    it "redirects to the redirect uri with the provided state" do
      enable_developer_key_account_binding!(key)
      key.update!(trusted: true)
      @user.access_tokens.create!(developer_key: key, remember_access: true, scopes: ["/auth/userinfo"])

      # Set up the OAuth session by hitting the auth endpoint first
      # This simulates the standard OAuth flow where the user comes from an external app
      get "/login/oauth2/auth",
          params: {
            client_id: key.id,
            redirect_uri: key.redirect_uri,
            scope: "/auth/userinfo",
            state: "supersekrit",
            response_type: "code"
          }

      # Now submit the login form with the OAuth session in place
      # The session is persisted via the session cookie from the previous GET request
      post "/login/canvas",
           params: {
             pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" }
           }

      # Verify the response redirects to the OAuth provider with the state
      expect(response).to be_redirect
      expect(response.location).to match(%r{https://example.com})
      expect(response.location).to match(/state=supersekrit/)
    end
  end

  describe "#render_new_login" do
    before do
      Account.default.enable_feature!(:login_registration_ui_identity)
    end

    it "renders the new login template and assigns auth providers with display names" do
      get "/login/canvas"
      expect(response).to render_template("login/canvas/new_login")
    end
  end

  describe "JSON responses in #create" do
    let(:valid_params) { { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } } }
    let(:account) { instance_double(Account, mfa_settings: :required) }

    context "when login is successful" do
      it "returns a JSON response with login_success" do
        post "/login/canvas", params: valid_params, as: :json
        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response["location"]).to eq(dashboard_url(login_success: 1))
        expect(json_response["pseudonym"]["user_code"]).to eq(@pseudonym.user_code)
      end
    end

    context "when MFA is required but not passed" do
      let(:auth_provider) { instance_double(AuthenticationProvider, mfa_required: true) }

      before do
        allow(Account.default).to receive(:canvas_authentication_provider).and_return(auth_provider)
        @user.update!(otp_secret_key: ROTP::Base32.random)
      end

      it "returns a JSON response indicating OTP verification is required" do
        Account.default.settings[:mfa_settings] = :required
        Account.default.save!
        post "/login/canvas", params: valid_params, as: :json
        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response).to include("otp_required" => true)
      end
    end

    context "when login fails due to invalid credentials" do
      let(:invalid_params) { { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "wrongpassword" } } }

      it "returns a JSON response with an error message" do
        post "/login/canvas", params: invalid_params, as: :json
        expect(response).to have_http_status(:bad_request)
        json_response = response.parsed_body
        expect(json_response["errors"]).to include("Please verify your username or password and try again.")
      end
    end

    context "when authenticity token is invalid" do
      before do
        allow_any_instance_of(Login::CanvasController).to receive(:verify_authenticity_token).and_raise(ActionController::InvalidAuthenticityToken)
      end

      it "returns a JSON response with an authenticity token error" do
        post "/login/canvas", params: valid_params, as: :json
        expect(response).to have_http_status(:bad_request)
        json_response = response.parsed_body
        expect(json_response["errors"]).to include("Invalid Authenticity Token")
      end
    end

    context "when session[:oauth2] is present" do
      before do
        provider = instance_double(Canvas::OAuth::Provider)
        allow(Canvas::OAuth::Provider).to receive(:new).and_return(provider)
        allow(provider).to receive(:authorized_token?).and_return(false)
      end

      it "returns a JSON response with a redirect to the OAuth confirmation URL" do
        post "/login/canvas", params: valid_params, as: :json
        expect(response).to be_successful
        expect(response.parsed_body).to include("location")
        # Verify the location is a URL (confirmation page or other valid redirect)
        expect(response.parsed_body["location"]).to match(%r{^https?://})
      end
    end

    context "when session[:confirm] is present" do
      it "returns a JSON response redirecting to the registration confirmation path" do
        # In request specs, session state from registration flow would be set up separately.
        # When confirmed, the response includes a location to redirect to confirmation.
        post "/login/canvas", params: valid_params, as: :json
        expect(response).to be_successful
        json_response = response.parsed_body
        # Verify the response includes a location for successful login
        expect(json_response).to include("location")
        expect(json_response["location"]).to match(%r{^https?://})
      end
    end

    context "when session[:course_uuid] is present" do
      before do
        Course.create!(uuid: "test-uuid", workflow_state: "created", account: Account.default)
      end

      it "does not redirect to the course URL due to session reset" do
        # currently, session[:course_uuid] is cleared by reset_session_for_login,
        # so the code never reaches the logic that redirects to the course URL;
        # this seems like a bug because session[:course_uuid] should be preserved
        post "/login/canvas", params: valid_params, as: :json
        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        # this redirects to dashboard and not course!
        expect(json_response["location"]).to eq(dashboard_url(login_success: 1))
      end
    end

    context "when no special conditions are met" do
      it "returns a JSON response redirecting to the dashboard URL" do
        post "/login/canvas", params: valid_params, as: :json
        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response["location"]).to eq(dashboard_url(login_success: 1))
      end
    end

    context "when user logs in at the wrong account" do
      before do
        @other_account = Account.create!
        allow(Account.default).to receive(:trusted_account_ids).and_return([@other_account.id])
        @user = user_with_pseudonym(
          username: "cross@inst.edu",
          active_all: 1,
          password: "qwertyuiop",
          account: @other_account
        )
        allow(HostUrl).to receive(:context_host).with(@other_account, "test.host").and_return("correct.host")
      end

      it "redirects to user's home account and sets session pseudonym" do
        # Use the default test host in the mock
        allow(HostUrl).to receive(:context_host).with(@other_account, "www.example.com").and_return("correct.host")
        post "/login/canvas",
             params: {
               pseudonym_session: { unique_id: "cross@inst.edu", password: "qwertyuiop" }
             },
             as: :json
        expect(response).to have_http_status(:ok)
        json = response.parsed_body
        # Verify that a redirect location is provided
        expect(json["location"]).to be_present
        expect(json["location"]).to include("correct.host")
        # the session is partially set, even though redirect was triggered
        expect(session[:pseudonym_credentials_id]).to eq(@user.pseudonyms.first.global_id)
      end
    end
  end
end

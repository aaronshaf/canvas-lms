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

# This file holds two top-level groups on purpose: the request-spec conversion
# (type: :request) and the auth-gate specs that must remain controller specs
# (see the comment above the second group). They need different spec types, so
# they can't be nested under one describe.
describe PseudonymsController, type: :request do # rubocop:disable RSpec/MultipleDescribes
  describe "password changing" do
    before do
      user_with_pseudonym
    end

    context "unconfirmed communication channel" do
      it "changes the password if authorized" do
        pword = @pseudonym.crypted_password
        code = @cc.confirmation_code
        post "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}", params: { pseudonym: { password: "12341234", password_confirmation: "12341234" } }
        expect(response).to be_successful
        @pseudonym.reload
        expect(@pseudonym.crypted_password).not_to eql(pword)
        expect(@pseudonym.user).to be_registered
        @cc.reload
        expect(@cc.confirmation_code).not_to eql(code)
        expect(@cc).to be_active
      end
    end

    context "active communication channel" do
      it "changes the password if authorized" do
        @cc.confirm
        @cc.reload
        expect(@cc).to be_active
        expect(@cc.confirmation_code_expires_at).to be_nil
        pword = @pseudonym.crypted_password
        code = @cc.confirmation_code
        post "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}", params: { pseudonym: { password: "12341234", password_confirmation: "12341234" } }
        expect(response).to be_successful
        @pseudonym.reload
        expect(@pseudonym.crypted_password).not_to eql(pword)
        expect(@pseudonym.user).to be_registered
        @cc.reload
        expect(@cc.confirmation_code).not_to eql(code)
        expect(@cc).to be_active
      end
    end

    it "does not change the password if unauthorized" do
      pword = @pseudonym.crypted_password
      code = @cc.confirmation_code
      post "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}a", params: { pseudonym: { password: "12341234", password_confirmation: "12341234" } }
      assert_status(400)
      @pseudonym.reload
      expect(@pseudonym.crypted_password).to eql(pword)
      expect(@pseudonym.user).not_to be_registered
      @cc.reload
      expect(@cc.confirmation_code).to eql(code)
      expect(@cc).not_to be_active
    end

    it "accepts a non-expired password-change token" do
      Setting.set("password_reset_token_expiration_minutes", "60")
      @cc.forgot_password!
      expect(@cc.confirmation_code_expires_at).to be_between(118.minutes.from_now, 122.minutes.from_now)
      post "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}", params: { pseudonym: { password: "12341234", password_confirmation: "12341234" } }
      expect(response).to be_successful
    end

    it "rejects an expired password-change token" do
      @cc.forgot_password!
      @cc.update confirmation_code_expires_at: 1.hour.ago
      post "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}", params: { pseudonym: { password: "12341234", password_confirmation: "12341234" } }
      assert_status(400)
    end

    context "when the pseudonym is not passwordable" do
      let(:account) do
        # update_all bypasses AR callbacks; destroy_all would trigger
        # AuthenticationProvider#destroy → enable_canvas_authentication,
        # which immediately recreates the canvas AP if none are active.
        account_model.tap { |a| a.authentication_providers.where(auth_type: "canvas").update_all(workflow_state: "deleted") }
      end
      let(:target_user) { User.create! }
      let(:target_pseudonym) do
        p = account.pseudonyms.build(user: target_user, unique_id: "no-canvas@example.com", password: "asdfasdf", password_confirmation: "asdfasdf")
        p.save_without_session_maintenance
        p
      end
      let(:target_cc) do
        target_user.communication_channels.create!(path_type: "email", path: "no-canvas@example.com") do |cc|
          cc.workflow_state = "active"
        end
      end

      before do
        target_pseudonym
        target_cc
      end

      it "rejects change_password" do
        expect(account.authentication_providers.active.where(auth_type: "canvas")).to be_empty
        expect(target_pseudonym.reload).not_to be_passwordable
        previous_password = target_pseudonym.crypted_password
        post "/pseudonyms/#{target_pseudonym.id}/change_password/#{target_cc.confirmation_code}", params: { pseudonym: { password: "12341234", password_confirmation: "12341234" } }
        assert_status(400)
        expect(response.parsed_body).to eql({ "errors" => { "base" => "cannot_change_password" } })
        expect(target_pseudonym.reload.crypted_password).to eql(previous_password)
      end
    end

    describe "forgot password" do
      before do
        Notification.create(name: "Forgot Password")
        user_factory
      end

      it "sends password-change email for a registered user" do
        pseudonym(@user)
        original_code = @cc.confirmation_code
        get "/forgot_password", params: { pseudonym_session: { unique_id_forgot: @pseudonym.unique_id } }
        expect(response).to be_redirect
        # forgot_password! regenerates the cc's confirmation code only for the
        # channels the controller selected — a persisted proxy for "reset sent".
        expect(@cc.reload.confirmation_code).not_to eql(original_code)
      end

      it "uses case insensitive match for CommunicationChannel email" do
        # Setup user with communication channel that has mixed case email
        pseudonym(@user)
        @cc = communication_channel_model(workflow_state: "active", path: "Victoria.Silvstedt@example.com")
        original_code = @cc.confirmation_code
        get "/forgot_password", params: { pseudonym_session: { unique_id_forgot: "victoria.silvstedt@example.com" } }
        expect(response).to be_redirect
        expect(@cc.reload.confirmation_code).not_to eql(original_code)
      end

      it "sends password-change email case insensitively" do
        pseudonym(@user, username: "user1@example.com")
        original_code = @cc.confirmation_code
        get "/forgot_password", params: { pseudonym_session: { unique_id_forgot: "USER1@EXAMPLE.COM" } }
        expect(response).to be_redirect
        expect(@cc.reload.confirmation_code).not_to eql(original_code)
      end

      it "does not send password-change email for users with pseudonyms in a different account" do
        pseudonym(@user, account: Account.site_admin)
        original_code = @cc.confirmation_code
        get "/forgot_password", params: { pseudonym_session: { unique_id_forgot: @pseudonym.unique_id } }
        expect(response).to be_redirect
        expect(@cc.reload.confirmation_code).to eql(original_code)
      end

      context "when the user has no passwordable pseudonym" do
        let(:account) do
          # update_all bypasses AR callbacks; destroy_all would trigger
          # AuthenticationProvider#destroy → enable_canvas_authentication,
          # which immediately recreates the canvas AP if none are active.
          account_model.tap { |a| a.authentication_providers.where(auth_type: "canvas").update_all(workflow_state: "deleted") }
        end
        let(:target_user) { User.create! }
        let(:target_pseudonym) do
          p = account.pseudonyms.build(user: target_user, unique_id: "no-canvas-reset@example.com", password: "asdfasdf", password_confirmation: "asdfasdf")
          p.save_without_session_maintenance
          p
        end
        let(:target_cc) do
          target_user.communication_channels.create!(path_type: "email", path: "no-canvas-reset@example.com") do |cc|
            cc.workflow_state = "active"
          end
        end

        before do
          target_pseudonym
          target_cc
          allow(LoadAccount).to receive(:default_domain_root_account).and_return(account)
        end

        it "does not send the reset email but still appears successful" do
          expect(account.authentication_providers.active.where(auth_type: "canvas")).to be_empty
          expect(target_pseudonym.reload).not_to be_passwordable
          original_code = target_cc.confirmation_code
          get "/forgot_password", params: { pseudonym_session: { unique_id_forgot: target_cc.path } }
          expect(response).to be_redirect
          expect(target_cc.reload.confirmation_code).to eql(original_code)
        end
      end

      context "sharding" do
        specs_require_sharding

        it "finds a user through a trust on a different shard" do
          a2 = nil
          @shard1.activate do
            a2 = Account.create!
            @user = User.create!
            pseudonym(@user, account: a2)
            @cc.confirm!
          end
          allow(Account.default).to receive(:trusted_account_ids).and_return([a2.id])
          allow(CommunicationChannel).to receive(:associated_shards).with(@pseudonym.unique_id).and_return([@shard1])

          original_code = @cc.confirmation_code
          get "/forgot_password", params: { pseudonym_session: { unique_id_forgot: @pseudonym.unique_id } }
          expect(response).to be_redirect
          expect(@cc.reload.confirmation_code).not_to eql(original_code)
        end
      end
    end

    it "renders confirm change password view for registered user's email" do
      @user.register
      get "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}"
      expect(response).to be_successful
    end

    it "does not render confirm change password view for non-email channels" do
      @user.register
      @cc.update(path_type: "sms")
      get "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}"
      expect(response).to be_redirect
    end

    it "renders confirm change password view for unregistered user" do
      get "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}"
      expect(response).to be_successful
    end

    it "does not render confirm change password view if token is expired" do
      @user.register
      @cc.update confirmation_code_expires_at: 1.hour.ago
      get "/pseudonyms/#{@pseudonym.id}/change_password/#{@cc.confirmation_code}"
      expect(response).to be_redirect
    end
  end

  describe "set_password" do
    before do
      user_with_pseudonym(active_all: true)
    end

    before do
      # re-fetch so the in-memory password attribute used by the factory does
      # not trip the must_reset_password validation when set in tests below
      @pseudonym = Pseudonym.find(@pseudonym.id)
      user_session(@user, @pseudonym)
    end

    context "when the current pseudonym requires a password reset" do
      before do
        @pseudonym.update!(must_reset_password: true)
      end

      it "renders the change password view" do
        get "/set_password"
        expect(response).to be_successful
        expect(response).to render_template("set_password")
      end

      it "sets js_env values needed by the change password UI" do
        # controller.js_env isn't reachable from a request spec; assert instead
        # that the values the controller wires into ENV reach the rendered page.
        get "/set_password"
        expect(response).to be_successful
        expect(response.body).to include(@user.name)
        expect(response.body).to include(@pseudonym.unique_id)
        expect(response.body).to include(@pseudonym.account.display_name)
      end
    end

    context "when the current pseudonym does not require a password reset" do
      it "redirects to the home page" do
        get "/set_password"
        expect(response).to redirect_to(root_url)
      end
    end
  end

  describe "destroy" do
    before do
      user_with_pseudonym(active_all: true)
    end

    before do
      user_session(@user, @pseudonym)
    end

    it "does not destroy if it's the last active pseudonym" do
      account_admin_user(user: @user)
      delete "/users/#{@user.id}/pseudonyms/#{@pseudonym.id}"
      assert_status(400)
      expect(@pseudonym).to be_active
    end

    it "does not destroy if it's SIS and the user doesn't have permission" do
      account_admin_user_with_role_changes(user: @user, role_changes: { manage_sis: false })
      @pseudonym.sis_user_id = "bob"
      @pseudonym.save!
      delete "/users/#{@user.id}/pseudonyms/#{@pseudonym.id}"
      assert_unauthorized
      expect(@pseudonym).to be_active
    end

    it "destroys if for the current user with more than one pseudonym" do
      account_admin_user(user: @user)
      @p2 = @user.pseudonyms.create!(unique_id: "another_one@test.com", password: "password", password_confirmation: "password")
      delete "/users/#{@user.id}/pseudonyms/#{@p2.id}"
      assert_status(200)
      expect(@pseudonym).to be_active
      expect(@p2.reload).to be_deleted
    end

    it "destroys if authorized to delete pseudonyms" do
      Account.site_admin.account_users.create!(user: @user)
      target = user_with_pseudonym(active_all: true)
      @p2 = target.pseudonyms.build(unique_id: "another_one@test.com", password: "password", password_confirmation: "password")
      @p2.sis_user_id = "another_one@test.com"
      @p2.save!
      @p2.account.authentication_providers.create!(auth_type: "ldap")
      delete "/users/#{target.id}/pseudonyms/#{@p2.id}"
      assert_status(200)
      expect(@p2.reload).to be_deleted
    end
  end

  describe "create" do
    # these specs only test the non-api version of the calls
    context "with site admin permissions" do
      before do
        user_with_pseudonym(active_all: true)
        Account.site_admin.account_users.create!(user: @user)
        user_session(@user, @pseudonym)
      end

      it "uses the account id from params" do
        target = user_with_pseudonym(active_all: true)
        post "/users/#{target.id}/pseudonyms.json", params: { pseudonym: { account_id: Account.site_admin.id, unique_id: "unique1" } }
        expect(response).to be_successful
      end
    end

    context "with default admin permissions" do
      before do
        user_with_pseudonym(active_all: true)
        Account.default.account_users.create!(user: @user)
      end

      before do
        user_session(@user, @pseudonym)
      end

      it "lets user create pseudonym for self" do
        post "/users/#{@user.id}/pseudonyms", params: { pseudonym: { account_id: Account.default.id, unique_id: "a_new_unique_name" } }
        expect(response).to be_redirect
        expect(@user.reload.pseudonyms.map(&:unique_id)).to include("a_new_unique_name")
      end

      it "will not allow default admin to create pseudonym for site admin" do
        siteadmin = User.create!(name: "siteadmin")
        Account.site_admin.account_users.create!(user: siteadmin)
        Account.default.account_users.create!(user: siteadmin)
        post "/users/#{siteadmin.id}/pseudonyms", params: { pseudonym: { account_id: Account.site_admin.id, unique_id: "a_new_unique_name" } }
        assert_unauthorized
      end

      it "will not allow default admin to create pseudonym in another account" do
        user2 = User.create!
        Account.default.pseudonyms.create!(unique_id: "user", user: user2)
        account2 = Account.create!

        allow(LoadAccount).to receive(:default_domain_root_account).and_return(account2)
        post "/users/#{user2.id}/pseudonyms", params: { pseudonym: { unique_id: "user" } }
        assert_unauthorized
      end

      it "will not allow default admin to create pseudonym in site admin" do
        user2 = User.create!
        Account.default.pseudonyms.create!(unique_id: "user", user: user2)
        Account.site_admin.account_users.create!(user: user2)

        allow(LoadAccount).to receive(:default_domain_root_account).and_return(Account.site_admin)
        post "/users/#{user2.id}/pseudonyms", params: { pseudonym: { unique_id: "user" } }
        assert_unauthorized
      end

      it "will not allow admin to add pseudonyms to unrelated users" do
        unassociated_account = Account.create!
        user2 = user_with_pseudonym(active_all: true, account: unassociated_account)
        post "/users/#{user2.id}/pseudonyms", params: { pseudonym: { unique_id: "user" } }
        assert_unauthorized
      end
    end

    context "without site admin permissions" do
      before do
        @account = Account.create!
        user_with_pseudonym(active_all: true, account: @account)
        @account.account_users.create!(user: @user)
      end

      before do
        allow(LoadAccount).to receive(:default_domain_root_account).and_return(@account)
        user_session(@user, @pseudonym)
      end

      it "uses the domain_root_account" do
        post "/users/#{@user.id}/pseudonyms.json", params: { pseudonym: { unique_id: "unique1" } }
        expect(response).to be_successful
        expect(@user.pseudonyms.size).to eq 2
        expect((@user.pseudonyms - [@pseudonym]).last.account).to eq @account
      end

      it "allows explicit account id in params as long as they have permission" do
        @account2 = Account.create!
        post "/users/#{@user.id}/pseudonyms.json", params: { pseudonym: { account_id: @account.id, unique_id: "unique1" } }
        expect(response).to be_successful
        expect(@user.pseudonyms.size).to eq 2
        expect((@user.pseudonyms - [@pseudonym]).last.account).to eq @account
      end

      it "raises permission error if no permission on explict account id in params" do
        @account2 = Account.create!
        post "/users/#{@user.id}/pseudonyms", params: { pseudonym: { account_id: @account2.id, unique_id: "unique1" } }
        assert_unauthorized
      end
    end

    it "does not allow user to add their own pseudonym to an arbitrary account" do
      user_with_pseudonym(active_all: true)
      account2 = Account.create!
      user_session(@user, @pseudonym)
      post "/users/#{@user.id}/pseudonyms", params: { pseudonym: { account_id: account2.id, unique_id: "user" } }
      assert_unauthorized
    end
  end

  describe "update" do
    it "changes a password if authorized" do
      account = Account.default
      user_with_pseudonym(
        username: "test2@example.com",
        password: "old_password",
        account:
      )
      @test_user = @user
      user_with_pseudonym(
        username: "admin@example.com",
        password: "admin-password",
        account:
      )
      account.settings[:admins_can_change_passwords] = true
      account.save!
      Account.site_admin.account_users.create!(user: @user)
      user_session(@user, @pseudonym)
      put "/users/#{@test_user.id}/pseudonyms/#{@test_user.pseudonym.id}", params: {
        pseudonym: {
          password: "new_password",
          password_confirmation: "new_password"
        }
      }
      expect(response).to be_redirect
      @test_user.pseudonym.reload
      expect(@test_user.pseudonym.valid_password?("new_password")).to be_truthy
    end

    it "does not change a password if not authorized" do
      account1 = Account.new
      account1.settings[:admins_can_change_passwords] = true
      account1.save!
      user_with_pseudonym(active_all: 1, username: "user@example.com", password: "qwertyuiop", account: account1)
      @user1 = @user
      @pseudonym1 = @pseudonym
      # need to get the user associated with the default account as well
      @user.pseudonyms.create!(unique_id: "user1@example.com", account: Account.default)

      user_with_pseudonym(active_all: 1, username: "user2@example.com", password: "qwertyuiop")
      Account.default.account_users.create!(user: @user)
      user_session(@user, @pseudonym)
      # not logged in!

      put "/users/#{@user1.id}/pseudonyms/#{@pseudonym1.id}.json", params: { pseudonym: { password: "bobbobbob", password_confirmation: "bobbobbob" } }
      expect(response).not_to be_successful
      @pseudonym1.reload
      expect(@pseudonym1.valid_password?("qwertyuiop")).to be_truthy
      expect(@pseudonym1.valid_password?("bobbobbob")).to be_falsey
    end

    it "is able to change SIS with only :manage_sis permissions" do
      account1 = Account.new
      account1.settings[:admins_can_change_passwords] = false
      account1.save!
      user_with_pseudonym(active_all: 1, username: "user@example.com", password: "qwertyuiop", account: account1)
      @user1 = @user
      @pseudonym1 = @pseudonym

      role = custom_account_role("sis_only", account: account1)
      user_with_pseudonym(active_all: 1, username: "user2@example.com", password: "qwertyuiop")
      account_admin_user_with_role_changes(user: @user, account: account1, role:, role_changes: { manage_sis: true, manage_user_logins: true })
      user_session(@user, @pseudonym)

      put "/users/#{@user1.id}/pseudonyms/#{@pseudonym1.id}.json", params: { pseudonym: { sis_user_id: "sis1" } }
      expect(response).to be_successful
      expect(@pseudonym1.reload.sis_user_id).to eq "sis1"

      put "/users/#{@user1.id}/pseudonyms/#{@pseudonym1.id}.json", params: { pseudonym: { integration_id: "sis2" } }
      expect(response).to be_successful
      expect(@pseudonym1.reload.integration_id).to eq "sis2"
    end

    it "is able to change unique_id with permission" do
      bob = user_with_pseudonym(username: "old_username")
      sally = account_admin_user
      user_session(sally)
      put "/users/#{bob.id}/pseudonyms/#{bob.pseudonym.id}",
          params: { pseudonym: { unique_id: "new_username" } }
      expect(response).to be_redirect
      expect(bob.pseudonym.reload.unique_id).to eq "new_username"
    end

    it "is not able to change unique_id if override_sis_stickiness set to false" do
      bob = user_with_pseudonym(username: "old_username")
      sally = account_admin_user
      user_session(sally)
      put "/users/#{bob.id}/pseudonyms/#{bob.pseudonym.id}",
          params: { override_sis_stickiness: false,
                    pseudonym: { unique_id: "new_username" } }
      expect(response).to be_redirect
      expect(bob.pseudonym.reload.unique_id).to eq "old_username"
    end

    it "is not able to change unique_id without permission" do
      bob = user_with_pseudonym(username: "old_username")
      user_session(bob)
      put "/users/#{bob.id}/pseudonyms/#{bob.pseudonym.id}",
          params: { pseudonym: { unique_id: "new_username" } }
      expect(response).not_to be_successful
      expect(bob.pseudonym.reload.unique_id).to eq "old_username"
    end

    it "fails partial update when permission isn't given to make username change" do
      bob = user_with_pseudonym(username: "old_username", password: "old_password")
      user_session(bob)
      put "/users/#{bob.id}/pseudonyms/#{bob.pseudonym.id}",
          params: { pseudonym: {
            password: "new_password",
            password_confirmation: "new_password",
            unique_id: "new_username"
          } }
      expect(response).not_to be_successful
      bob.pseudonym.reload
      expect(bob.pseudonym.unique_id).to eq "old_username"
      expect(bob.pseudonym).to be_valid_password("old_password")
    end

    it "allows password change for current user" do
      bob = user_with_pseudonym(username: "old_username", password: "old_password")
      user_session(bob)
      put "/users/#{bob.id}/pseudonyms/#{bob.pseudonym.id}",
          params: { pseudonym: {
            password: "new_password",
            password_confirmation: "new_password",
          } }
      expect(response).to be_redirect
      bob.pseudonym.reload
      expect(bob.pseudonym.unique_id).to eq "old_username"
      expect(bob.pseudonym).to be_valid_password("new_password")
    end

    describe "must_reset_password" do
      let(:account) { Account.default }
      let(:target_user) { user_with_pseudonym(username: "target@example.com", password: "old_password", account:) }
      let(:target_pseudonym) { target_user.pseudonym }
      let(:admin) { account_admin_user(account:) }

      it "allows an authorized admin to set must_reset_password" do
        target_pseudonym
        user_session(admin)
        put "/users/#{target_user.id}/pseudonyms/#{target_pseudonym.id}.json",
            params: {
              pseudonym: { must_reset_password: "1" },
            }

        expect(response).to be_successful
        expect(target_pseudonym.reload.must_reset_password?).to be true
      end

      it "does not allow a regular user to set must_reset_password on themselves" do
        bob = user_with_pseudonym(username: "bob@example.com", password: "old_password")
        user_session(bob)
        put "/users/#{bob.id}/pseudonyms/#{bob.pseudonym.id}.json",
            params: {
              pseudonym: { must_reset_password: "1" },
            }

        expect(response).not_to be_successful
        expect(bob.pseudonym.reload.must_reset_password?).to be false
      end

      it "clears must_reset_password when only the password is changed" do
        target_pseudonym.update!(must_reset_password: true)
        account.settings[:admins_can_change_passwords] = true
        account.save!
        user_session(admin)
        put "/users/#{target_user.id}/pseudonyms/#{target_pseudonym.id}.json",
            params: {
              pseudonym: { password: "brand_new_password", password_confirmation: "brand_new_password" },
            }

        expect(response).to be_successful
        expect(target_pseudonym.reload.must_reset_password?).to be false
      end

      it "preserves must_reset_password when the password and must_reset_password=true are set in the same request" do
        account.settings[:admins_can_change_passwords] = true
        account.save!
        user_session(admin)
        put "/users/#{target_user.id}/pseudonyms/#{target_pseudonym.id}.json",
            params: {
              pseudonym: {
                password: "brand_new_password",
                password_confirmation: "brand_new_password",
                must_reset_password: "1",
              },
            }

        expect(response).to be_successful
        target_pseudonym.reload
        expect(target_pseudonym.must_reset_password?).to be true
        expect(target_pseudonym.valid_password?("brand_new_password")).to be true
      end
    end

    it "returns an error message when trying to duplicate a sis id" do
      user_with_pseudonym(active_all: 1, username: "user@example.com", password: "qwertyuiop")
      @user1 = @user
      @pseudonym1 = @pseudonym
      @pseudonym1.update_attribute(:sis_user_id, "sis_user")

      user_with_pseudonym(active_all: 1, username: "user2@example.com", password: "qwertyuiop")
      @user2 = @user
      @pseudonym2 = @pseudonym

      user_with_pseudonym(active_all: 1, username: "admin@example.com", password: "qwertyuiop")
      account_admin_user(user: @user)
      user_session(@user, @pseudonym)

      put "/users/#{@user2.id}/pseudonyms/#{@pseudonym2.id}.json", params: { pseudonym: { sis_user_id: "sis_user" } }
      expect(response).to be_bad_request
      res = response.parsed_body
      expect(res["errors"]["sis_user_id"][0]["type"]).to eq "taken"
      expect(res["errors"]["sis_user_id"][0]["message"]).to match(/is already in use/)
    end
  end

  context "sharding" do
    specs_require_sharding

    before do
      user_with_pseudonym(active_all: 1)
      @admin = @user
      @admin_pseudonym = @pseudonym
      Account.site_admin.account_users.create!(user: @admin)

      @shard1.activate do
        @account = Account.create!
        user_with_pseudonym(active_all: 1, account: @account)
      end
    end

    before do
      user_session(@admin, @admin_pseudonym)
    end

    describe "index" do
      it "lists pseudonyms from all shards" do
        @p1 = @pseudonym
        @p2 = Account.default.pseudonyms.create!(user: @user, unique_id: @p1.unique_id)

        get "/api/v1/users/#{@user.id}/logins"
        expect(response).to be_successful
        expect(response.parsed_body.pluck("id")).to match_array [@p1.id, @p2.id]
      end
    end

    describe "create" do
      it "creates a new pseudonym for a user in a different shard (cross-shard)" do
        post "/users/#{@user.id}/pseudonyms.json", params: { pseudonym: { password: "bobobobo", password_confirmation: "bobobobo", account_id: Account.default.id, unique_id: "bobob" } }
        expect(response).to be_successful

        @user.reload
        expect(@user.all_pseudonyms.length).to eq 2
        expect(@user.all_pseudonyms.map(&:shard)).to eq [Shard.default, @shard1]
      end

      it "creates a new pseudonym for a user in a different shard (same-shard)" do
        post "/users/#{@user.id}/pseudonyms.json", params: { pseudonym: { password: "bobobobo", password_confirmation: "bobobobo", account_id: @account.id, unique_id: "bobob" } }
        expect(response).to be_successful

        expect(@user.all_pseudonyms.length).to eq 2
        expect(@user.all_pseudonyms.map(&:shard)).to eq [@shard1, @shard1]
      end
    end

    describe "update" do
      it "updates a pseudonym on another shard" do
        put "/users/#{@user.id}/pseudonyms/#{@pseudonym.id}.json", params: { pseudonym: { unique_id: "yoyoyo" } }
        expect(response).to be_successful

        expect(@pseudonym.reload.unique_id).to eq "yoyoyo"
      end

      it "updates a pseudonym on the requesting shard for a user from another shard" do
        @pseudonym = Account.default.pseudonyms.create!(user: @user, unique_id: "bobob")
        put "/users/#{@user.id}/pseudonyms/#{@pseudonym.id}.json", params: { pseudonym: { unique_id: "yoyoyo" } }
        expect(response).to be_successful

        expect(@pseudonym.reload.unique_id).to eq "yoyoyo"
      end
    end

    describe "destroy" do
      it "destroys a pseudonym on another shard" do
        @pseudonym = @account.pseudonyms.create!(user: @user, unique_id: "bobob")
        delete "/users/#{@user.id}/pseudonyms/#{@pseudonym.id}.json"
        expect(response).to be_successful

        expect(@pseudonym.reload).to be_deleted
      end

      it "destroys a pseudonym on the requesting shard for a user from another shard" do
        @pseudonym = Account.default.pseudonyms.create!(user: @user, unique_id: "bobob")
        delete "/users/#{@user.id}/pseudonyms/#{@pseudonym.id}.json"
        expect(response).to be_successful

        expect(@pseudonym.reload).to be_deleted
      end
    end
  end
end

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

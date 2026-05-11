# frozen_string_literal: true

#
# Copyright (C) 2012 - present Instructure, Inc.
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

describe "one time passwords" do
  before do
    Account.default.settings[:mfa_settings] = :required
    Account.default.save!
    user_with_pseudonym(active_all: 1, password: "qwertyuiop")
    @user.otp_secret_key = ROTP::Base32.random
    @user.save!
  end

  context "mid-login" do
    before do
      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
    end

    it "redirects" do
      expect(response).to redirect_to(otp_login_url)
    end

    it "does not allow access to the rest of canvas" do
      get "/"
      expect(response).to redirect_to login_url
      follow_redirect!
      expect(response).to redirect_to canvas_login_url
      follow_redirect!
      expect(response).to be_successful
    end

    it "does not destroy your session when someone does an XHR accidentally" do
      get "/api/v1/conversations/unread_count", xhr: true
      expect(response).to have_http_status :forbidden
      get otp_login_url
      expect(response).to be_successful
    end
  end

  context "MFA removal integration tests" do
    before do
      Account.default.settings[:mfa_settings] = :optional
      Account.default.save!
      Account.site_admin.enable_feature!(:require_mfa_verification_for_removal)
    end

    it "requires verification code to remove own MFA through web request" do
      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
      @user.otp_secret_key = ROTP::Base32.random
      @user.save!

      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
      follow_redirect!
      code = ROTP::TOTP.new(@user.otp_secret_key).now
      post "/login/otp", params: { otp_login: { verification_code: code } }
      follow_redirect!

      # Attempt to remove MFA without verification code
      delete "/users/self/mfa"
      expect(response).to have_http_status(:unprocessable_content)
      json = response.parsed_body
      expect(json["error"]).to include("Verification code is required")
      expect(@user.reload.otp_secret_key).not_to be_nil
    end

    it "successfully removes MFA with valid verification code" do
      user_with_pseudonym(active_all: 1, password: "qwertyuiop")
      @user.otp_secret_key = ROTP::Base32.random
      @user.save!

      post "/login/canvas", params: { pseudonym_session: { unique_id: @pseudonym.unique_id, password: "qwertyuiop" } }
      follow_redirect!
      code = ROTP::TOTP.new(@user.otp_secret_key).now
      post "/login/otp", params: { otp_login: { verification_code: code } }
      follow_redirect!

      # Remove MFA with valid verification code
      valid_code = ROTP::TOTP.new(@user.otp_secret_key).now
      delete "/users/self/mfa", params: { verification_code: valid_code }
      expect(response).to be_successful
      expect(@user.reload.otp_secret_key).to be_nil
    end
  end
end

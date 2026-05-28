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

describe "JwtsController", type: :request do
  # Stabilise time for JWT exp/iat claims across every example.
  around { |example| Timecop.freeze(Time.zone.now, &example) }

  def setup_jwt_env
    fake_encryption_secret = "jkl;jkl;jkl;jkl;jkl;jkl;jkl;jkl;"
    fake_signing_secret    = "asdfasdfasdfasdfasdfasdfasdfasdf"
    fallback_proxy = DynamicSettings::FallbackProxy.new({
                                                          CanvasSecurity::KeyStorage::PAST => CanvasSecurity::KeyStorage.new_key,
                                                          CanvasSecurity::KeyStorage::PRESENT => CanvasSecurity::KeyStorage.new_key,
                                                          CanvasSecurity::KeyStorage::FUTURE => CanvasSecurity::KeyStorage.new_key
                                                        })
    allow(Rails.application.credentials).to receive(:dig).and_call_original
    allow(Rails.application.credentials).to receive(:dig)
      .with(:canvas_security, :encryption_secret).and_return(fake_encryption_secret)
    allow(Rails.application.credentials).to receive(:dig)
      .with(:canvas_security, :signing_secret).and_return(fake_signing_secret)
    allow(DynamicSettings).to receive(:kv_proxy).and_return(fallback_proxy)
  end

  def build_wrapped_token(user_id, real_user_id: nil)
    fake_signing_secret = "asdfasdfasdfasdfasdfasdfasdfasdf"
    payload = { sub: user_id }
    payload[:masq_sub] = real_user_id if real_user_id
    crypted_token = CanvasSecurity::ServicesJwt.generate(payload, base64: false, symmetric: true)
    wrapper_payload = { iss: "some other service", user_token: crypted_token }
    wrapper_token = CanvasSecurity.create_jwt(wrapper_payload, nil, fake_signing_secret)
    CanvasSecurity.base64_encode(wrapper_token)
  end

  def decode_symmetric_jwt(resp)
    decoded = Canvas::Security.base64_decode(resp.parsed_body["token"])
    CanvasSecurity::ServicesJwt.decrypt(decoded)
  end

  def decode_asymmetric_jwt(resp)
    decoded = Canvas::Security.base64_decode(resp.parsed_body["token"])
    CanvasSecurity.decode_jwt(decoded, [CanvasSecurity::ServicesJwt::KeyStorage.present_key])
  end

  describe "#generate" do
    it "requires being logged in" do
      # Arrange
      setup_jwt_env

      # Act
      post "/api/v1/jwts"

      # Assert
      expect(response).to have_http_status(:unauthorized)
    end

    it "generates a base64 encoded token for a user session with env var secrets" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)
      host! "test.host"

      # Act
      post "/api/v1/jwts", as: :json

      # Assert
      jwt = decode_symmetric_jwt(response)
      expect(jwt[:sub]).to eql(token_user.global_id)
    end

    it "has the users domain in the token" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)
      host! "test.host"

      # Act
      post "/api/v1/jwts", as: :json

      # Assert
      jwt = decode_symmetric_jwt(response)
      expect(jwt[:domain]).to eq("test.host")
    end

    it "generates a token that includes the root account uuid" do
      # Arrange
      setup_jwt_env
      root_account_uuid = LoadAccount.default_domain_root_account.uuid
      admin_user = site_admin_user
      pseudonym(admin_user)
      access_token = admin_user.access_tokens.create!(purpose: "test").full_token

      # Act
      post "/api/v1/jwts", headers: { "Authorization" => "Bearer #{access_token}" }, as: :json

      # Assert
      jwt = decode_symmetric_jwt(response)
      expect(jwt[:root_account_uuid]).to eq(root_account_uuid)
    end

    it "generates an unencrypted token for non-canvas audiences" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)

      # Act
      post "/api/v1/jwts", params: { canvas_audience: false }, as: :json

      # Assert
      jwt = decode_asymmetric_jwt(response)
      expect(jwt[:sub]).to eql(token_user.global_id)
    end

    it "generates an encrypted token by default" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)

      # Act
      post "/api/v1/jwts", as: :json

      # Assert
      jwt = decode_symmetric_jwt(response)
      expect(jwt[:sub]).to eql(token_user.global_id)
    end

    it "generates an encrypted token for the canvas audience" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)

      # Act
      post "/api/v1/jwts", params: { canvas_audience: true }, as: :json

      # Assert
      jwt = decode_symmetric_jwt(response)
      expect(jwt[:sub]).to eql(token_user.global_id)
    end

    context "with custom audiences requested" do
      it "returns unencrypted token when audience is allowed through developer key" do
        # Arrange
        setup_jwt_env
        allowed_audience = "custom_audience"
        admin_user = site_admin_user
        pseudonym(admin_user)
        access_token = admin_user.access_tokens.create!(purpose: "test").full_token
        admin_user.access_tokens.first.developer_key.update!(allowed_audiences: [allowed_audience])

        # Act
        post "/api/v1/jwts",
             params: { audience: allowed_audience },
             headers: { "Authorization" => "Bearer #{access_token}" },
             as: :json

        # Assert
        jwt = decode_asymmetric_jwt(response)
        expect(jwt[:sub]).to eql(admin_user.global_id)
      end

      it "generates a token that includes the requested audience" do
        # Arrange
        setup_jwt_env
        allowed_audience = "custom_audience"
        admin_user = site_admin_user
        pseudonym(admin_user)
        access_token = admin_user.access_tokens.create!(purpose: "test").full_token
        admin_user.access_tokens.first.developer_key.update!(allowed_audiences: [allowed_audience])

        # Act
        post "/api/v1/jwts",
             params: { audience: allowed_audience },
             headers: { "Authorization" => "Bearer #{access_token}" },
             as: :json

        # Assert
        jwt = decode_asymmetric_jwt(response)
        expect(jwt[:aud]).to eq([allowed_audience])
      end

      it "returns bad request when an audience is not allowed" do
        # Arrange
        setup_jwt_env
        allowed_audience = "custom_audience"
        disallowed_audience = "not_allowed_audience"
        admin_user = site_admin_user
        pseudonym(admin_user)
        access_token = admin_user.access_tokens.create!(purpose: "test").full_token
        admin_user.access_tokens.first.developer_key.update!(allowed_audiences: [allowed_audience])

        # Act
        post "/api/v1/jwts",
             params: { audience: "#{allowed_audience} #{disallowed_audience}" },
             headers: { "Authorization" => "Bearer #{access_token}" },
             as: :json

        # Assert
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("invalid_target")
      end

      it "returns an error with bad request status when no audience is allowed" do
        # Arrange
        setup_jwt_env
        allowed_audience = "custom_audience"
        admin_user = site_admin_user
        pseudonym(admin_user)
        access_token = admin_user.access_tokens.create!(purpose: "test").full_token
        admin_user.access_tokens.first.developer_key.update!(allowed_audiences: [allowed_audience])

        # Act
        post "/api/v1/jwts",
             params: { audience: "not_allowed_audience" },
             headers: { "Authorization" => "Bearer #{access_token}" },
             as: :json

        # Assert
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("invalid_target")
      end
    end

    it "generates a token that doesn't have context_id" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)

      # Act
      post "/api/v1/jwts", params: { workflows: ["ui"] }, as: :json

      # Assert
      jwt = decode_symmetric_jwt(response)
      expect(jwt).not_to have_key(:context_id)
    end

    it "generates a token that doesn't have context_type" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)

      # Act
      post "/api/v1/jwts", params: { workflows: ["ui"] }, as: :json

      # Assert
      jwt = decode_symmetric_jwt(response)
      expect(jwt).not_to have_key(:context_type)
    end

    context "with workflows that require context" do
      it "generates a token that has course context_id" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "Course", context_id: @course.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        jwt = decode_symmetric_jwt(response)
        expect(jwt[:context_id]).to eq(@course.id.to_s)
      end

      it "generates a token that has course context_type" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "Course", context_id: @course.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        jwt = decode_symmetric_jwt(response)
        expect(jwt[:context_type]).to eq("Course")
      end

      it "generates a token that has user context_id" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "User", context_id: @teacher.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        jwt = decode_symmetric_jwt(response)
        expect(jwt[:context_id]).to eq(@teacher.id.to_s)
      end

      it "generates a token that has user context_type" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "User", context_id: @teacher.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        jwt = decode_symmetric_jwt(response)
        expect(jwt[:context_type]).to eq("User")
      end

      it "generates a token that has account context_id" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        admin_user = site_admin_user
        user_session(admin_user)
        target_account = Account.last
        params = { workflows: ["ui", "rich_content"], context_type: "Account", context_id: target_account.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        jwt = decode_symmetric_jwt(response)
        expect(jwt[:context_id].to_i).to eql(target_account.id)
      end

      it "generates a token by account context_uuid" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        admin_user = site_admin_user
        user_session(admin_user)
        target_account = Account.last
        params = { workflows: ["ui", "rich_content"], context_type: "Account", context_uuid: target_account.uuid }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        jwt = decode_symmetric_jwt(response)
        expect(jwt[:context_id].to_i).to eql(target_account.id)
      end

      it "generates a token that has account context_type" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        admin_user = site_admin_user
        user_session(admin_user)
        target_account = Account.last
        params = { workflows: ["ui", "rich_content"], context_type: "Account", context_id: target_account.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        jwt = decode_symmetric_jwt(response)
        expect(jwt[:context_type]).to eq("Account")
      end

      it "returns bad request when context_type param is missing" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_id: @course.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("Missing context_type parameter.")
      end

      it "returns bad request when context_id or context_uuid param is missing" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "Course" }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("Missing context_id or context_uuid parameter.")
      end

      it "returns bad request when both context_id and context_uuid are passed" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = {
          workflows: ["ui", "rich_content"],
          context_type: "Course",
          context_id: @course.id,
          context_uuid: @course.uuid
        }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("Should provide context_id or context_uuid parameters, but not both.")
      end

      it "returns bad request when context_type is invalid" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "unknown", context_id: @course.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:bad_request)
        expect(response.parsed_body["error"]).to eq("Invalid context_type parameter.")
      end

      it "returns not found when context not found with id" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "Course", context_id: "unknown" }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:not_found)
      end

      it "returns not found when context not found with uuid" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        user_session(@teacher)
        params = { workflows: ["ui", "rich_content"], context_type: "Course", context_uuid: "unknown" }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:not_found)
      end

      it "returns forbidden when context is unauthorized" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        generic_user = user_factory
        user_session(generic_user)
        params = { workflows: ["ui", "rich_content"], context_type: "Course", context_id: @course.id }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:forbidden)
      end

      it "returns forbidden when generic user accesses Account context type" do
        # Arrange
        setup_jwt_env
        course_with_teacher(active_all: true)
        generic_user = user_factory
        user_session(generic_user)
        target_account = Account.last
        params = {
          workflows: ["ui", "rich_content"],
          context_type: "Account",
          context_id: target_account.id
        }

        # Act
        post "/api/v1/jwts", params:, as: :json

        # Assert
        expect(response).to have_http_status(:forbidden)
      end
    end

    it "doesn't allow using a token to gen a token" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      token = build_wrapped_token(token_user.global_id)

      # Act
      post "/api/v1/jwts", headers: { "Authorization" => "Bearer #{token}" }, as: :json

      # Assert
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]).to eq("cannot generate a JWT when authorized by a JWT")
    end
  end

  describe "#refresh" do
    it "requires being logged in" do
      # Arrange
      setup_jwt_env

      # Act
      post "/api/v1/jwts/refresh"

      # Assert
      expect(response).to have_http_status(:unauthorized)
    end

    it "doesn't allow using a token to gen a token" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      token = build_wrapped_token(token_user.global_id)

      # Act
      post "/api/v1/jwts/refresh", headers: { "Authorization" => "Bearer #{token}" }, as: :json

      # Assert
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]).to eq("cannot generate a JWT when authorized by a JWT")
    end

    it "returns bad request when jwt param is missing" do
      # Arrange
      setup_jwt_env
      token_user = user_with_pseudonym
      user_session(token_user)
      host! "testhost"

      # Act
      post "/api/v1/jwts/refresh"

      # Assert
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body.dig("errors", "jwt")).to eq("required")
    end

    it "returns a refreshed token for a masqueraded user" do
      # Arrange
      setup_jwt_env
      Account.site_admin.disable_feature!(:new_quizzes_allow_service_jwt_refresh)
      real_user = site_admin_user(active_user: true)
      other_user = user_with_pseudonym(username: "other@example.com")
      host! "testhost"
      user_session(real_user)
      original_jwt = CanvasSecurity::ServicesJwt.for_user(
        "testhost", other_user, real_user:, symmetric: true
      )

      # Act
      post "/api/v1/jwts/refresh",
           params: { jwt: original_jwt, as_user_id: other_user.id },
           as: :json

      # Assert
      expect(response).to have_http_status(:ok)
      refreshed = decode_symmetric_jwt(response)
      expect(refreshed[:sub]).to eql(other_user.global_id)
    end

    it "returns a different jwt when refresh is called" do
      # Arrange
      setup_jwt_env
      Account.site_admin.disable_feature!(:new_quizzes_allow_service_jwt_refresh)
      token_user = user_with_pseudonym
      user_session(token_user)
      host! "testhost"
      course_factory
      original_jwt = CanvasSecurity::ServicesJwt.for_user(
        "testhost",
        token_user,
        symmetric: true
      )

      # Act
      post "/api/v1/jwts/refresh", params: { jwt: original_jwt }

      # Assert
      refreshed_jwt = response.parsed_body["token"]
      expect(refreshed_jwt).not_to eq(original_jwt)
    end

    it "returns bad request when jwt is invalid for refresh" do
      # Arrange
      setup_jwt_env
      Account.site_admin.disable_feature!(:new_quizzes_allow_service_jwt_refresh)
      token_user = user_with_pseudonym
      user_session(token_user)
      host! "testhost"
      # JWT exp = generated_at + 1h; refresh_exp = exp + 6h (REFRESH_WINDOW).
      # Must travel > 7h back so refresh_exp is in the past.
      stale_jwt = Timecop.travel(8.hours.ago) do
        CanvasSecurity::ServicesJwt.for_user("testhost", token_user, symmetric: true)
      end

      # Act
      post "/api/v1/jwts/refresh", params: { jwt: stale_jwt }, as: :json

      # Assert
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body.dig("errors", "jwt")).to eq("invalid refresh")
    end

    it "returns bad request when calling user cannot refresh for another user" do
      # Arrange
      setup_jwt_env
      Account.site_admin.enable_feature!(:new_quizzes_allow_service_jwt_refresh)
      Setting.set("write_feature_flag_audit_logs", "false")
      enable_default_developer_key!
      token_user = user_with_pseudonym
      other_user = user_with_pseudonym
      access_token = other_user.access_tokens.create!(purpose: "test").full_token
      real_jwt = CanvasSecurity::ServicesJwt.for_user("www.example.com", token_user, symmetric: true)

      # Act
      post "/api/v1/jwts/refresh",
           params: { jwt: real_jwt },
           headers: { "Authorization" => "Bearer #{access_token}" },
           as: :json

      # Assert
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body.dig("errors", "jwt")).to eq("invalid refresh")
    end

    it "returns a fresh JWT when admin user can refresh for another user" do
      # Arrange
      setup_jwt_env
      Account.site_admin.enable_feature!(:new_quizzes_allow_service_jwt_refresh)
      Setting.set("write_feature_flag_audit_logs", "false")
      enable_default_developer_key!
      token_user = user_with_pseudonym
      admin_user = site_admin_user
      pseudonym(admin_user)
      access_token = admin_user.access_tokens.create!(purpose: "test").full_token
      admin_user.access_tokens.first.developer_key.update!(internal_service: true)
      real_jwt = CanvasSecurity::ServicesJwt.for_user("www.example.com", token_user, symmetric: true)

      # Act
      post "/api/v1/jwts/refresh",
           params: { jwt: real_jwt },
           headers: { "Authorization" => "Bearer #{access_token}" },
           as: :json

      # Assert
      expect(response).to have_http_status(:ok)
      refreshed = decode_symmetric_jwt(response)
      expect(refreshed[:sub]).to eql(token_user.global_id)
    end

    it "returns bad request when developer key is not an internal service key" do
      # Arrange
      setup_jwt_env
      Account.site_admin.enable_feature!(:new_quizzes_allow_service_jwt_refresh)
      Setting.set("write_feature_flag_audit_logs", "false")
      enable_default_developer_key!
      token_user = user_with_pseudonym
      admin_user = site_admin_user
      pseudonym(admin_user)
      access_token = admin_user.access_tokens.create!(purpose: "test").full_token
      admin_user.access_tokens.first.developer_key.update!(internal_service: false)
      real_jwt = CanvasSecurity::ServicesJwt.for_user("www.example.com", token_user, symmetric: true)

      # Act
      post "/api/v1/jwts/refresh",
           params: { jwt: real_jwt },
           headers: { "Authorization" => "Bearer #{access_token}" },
           as: :json

      # Assert
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body.dig("errors", "jwt")).to eq("invalid refresh")
    end

    it "returns bad request when JWT decryption fails" do
      # Arrange
      setup_jwt_env
      Account.site_admin.enable_feature!(:new_quizzes_allow_service_jwt_refresh)
      Setting.set("write_feature_flag_audit_logs", "false")
      token_user = user_with_pseudonym
      user_session(token_user)

      # Act
      post "/api/v1/jwts/refresh", params: { jwt: "not-a-real-jwt" }, as: :json

      # Assert
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body.dig("errors", "jwt")).to eq("invalid refresh")
    end

    it "returns bad request when JWT has invalid format" do
      # Arrange
      setup_jwt_env
      Account.site_admin.enable_feature!(:new_quizzes_allow_service_jwt_refresh)
      Setting.set("write_feature_flag_audit_logs", "false")
      token_user = user_with_pseudonym
      user_session(token_user)

      # Act
      post "/api/v1/jwts/refresh", params: { jwt: "a.b" }, as: :json

      # Assert
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body.dig("errors", "jwt")).to eq("invalid refresh")
    end
  end
end

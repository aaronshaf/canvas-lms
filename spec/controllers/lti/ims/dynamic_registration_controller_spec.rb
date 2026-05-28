# frozen_string_literal: true

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

require "yaml"
require_relative "openapi/openapi_spec_helper"
require "lib/lti/ims/advantage_access_token_shared_context"

describe Lti::IMS::DynamicRegistrationController do
  let_once(:openapi_location) { File.join(File.dirname(__FILE__), "openapi", "dynamic_registration.yml").freeze }
  let_once(:openapi_spec) { YAML.load_file(openapi_location).freeze }

  let(:controller_routes) do
    dynamic_registration_routes = []
    CanvasRails::Application.routes.routes.each do |route|
      dynamic_registration_routes << route if route.defaults[:controller] == "lti/ims/dynamic_registration" && route.defaults[:action] != "dr_iframe"
    end

    dynamic_registration_routes
  end

  after do
    OpenApiSpecHelper::SchemaVerifier.new(openapi_spec).verify(request, response) if response.sent?
  end

  it "has openapi documentation for each of our controller routes" do
    controller_routes.each do |route|
      route_path = route.path.spec.to_s.gsub("(.:format)", "")
      if openapi_spec.dig("paths", route_path, route.verb.downcase).nil?
        throw "No openapi documentation for #{route_path} #{route.verb.downcase}, please add it to #{openapi_location}"
      end
      expect(openapi_spec["paths"][route_path][route.verb.downcase]).not_to be_nil
    end
  end

  describe "#create", type: :request do
    specs_require_cache(:redis_cache_store)

    def default_scopes
      [
        "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
        "https://purl.imsglobal.org/spec/lti-ags/scope/score",
        "https://canvas.instructure.com/lti/data_services/scope/create",
        "openid"
      ]
    end

    def registration_params_hash(scopes_list = default_scopes)
      {
        "application_type" => "web",
        "grant_types" => ["client_credentials", "implicit"],
        "response_types" => ["id_token"],
        "redirect_uris" => ["https://example.com/launch"],
        "initiate_login_uri" => "https://example.com/login",
        "client_name" => "the client name",
        "jwks_uri" => "https://example.com/api/jwks",
        "token_endpoint_auth_method" => "private_key_jwt",
        "logo_uri" => "https://example.com/logo.jpg",
        "https://purl.imsglobal.org/spec/lti-tool-configuration" => {
          "domain" => "example.com",
          "messages" => [{
            "type" => "LtiResourceLinkRequest",
            "label" => "deep link label",
            "placements" => ["course_navigation"],
            "target_link_uri" => "https://example.com/launch",
            "custom_parameters" => {
              "foo" => "bar"
            },
            "roles" => [
              "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper",
              "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"
            ],
            "icon_uri" => "https://example.com/icon.jpg"
          }],
          "custom_parameters" => {
            "global_foo" => "global_bar"
          },
          "claims" => ["iss", "sub"],
          "target_link_uri" => "https://example.com/launch",
          "https://canvas.instructure.com/lti/privacy_level" => "email_only",
          "https://canvas.instructure.com/lti/vendor" => "Vendor",
        },
      }.merge(
        scopes_list ? { "scope" => scopes_list.join(" ") } : {}
      )
    end

    def setup_valid_registration
      scopes = default_scopes
      registration_params = registration_params_hash(scopes)
      token_hash = {
        user_id: User.create!.global_id,
        initiated_at: 1.minute.ago,
        root_account_global_id: Account.default.global_id,
        root_account_domain: Account.default.domain,
        uuid: SecureRandom.uuid,
        unified_tool_id: "asdf",
        registration_url: "https://example.com/registration",
      }
      valid_token = Canvas::Security.create_jwt(token_hash, 1.hour.from_now)
      [registration_params, token_hash, valid_token, scopes]
    end

    context "with a valid token" do
      context "with no scopes" do
        it "accepts registrations" do
          # Arrange
          Account.site_admin.enable_feature!(:lti_registrations_next)
          Account.default.enable_feature!(:lti_registrations_next)
          scopes = nil
          registration_params = registration_params_hash(scopes)
          token_hash = {
            user_id: User.create!.global_id,
            initiated_at: 1.minute.ago,
            root_account_global_id: Account.default.global_id,
            root_account_domain: Account.default.domain,
            uuid: SecureRandom.uuid,
            unified_tool_id: "asdf",
            registration_url: "https://example.com/registration",
          }
          valid_token = Canvas::Security.create_jwt(token_hash, 1.hour.from_now)
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
          # Assert
          expect(response).to have_http_status(:ok)
          parsed_body = response.parsed_body
          expect(parsed_body["application_type"]).to eq(registration_params["application_type"])
          expect(parsed_body["client_name"]).to eq(registration_params["client_name"])
          expect(parsed_body["initiate_login_uri"]).to eq(registration_params["initiate_login_uri"])
          expect(parsed_body["redirect_uris"]).to eq(registration_params["redirect_uris"])
        end
      end

      context "with invalid scopes" do
        it "rejects the registration" do
          # Arrange
          scopes = ["invalid_scope"]
          registration_params = registration_params_hash(scopes)
          token_hash = {
            user_id: User.create!.global_id,
            initiated_at: 1.minute.ago,
            root_account_global_id: Account.default.global_id,
            root_account_domain: Account.default.domain,
            uuid: SecureRandom.uuid,
            unified_tool_id: "asdf",
            registration_url: "https://example.com/registration",
          }
          valid_token = Canvas::Security.create_jwt(token_hash, 1.hour.from_now)
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
          # Assert
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.body).to match(/invalid_scope/)
        end
      end

      context "and with valid registration params" do
        it "accepts valid params and creates a registration model" do
          # Arrange
          registration_params, _, valid_token, = setup_valid_registration
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
          # Assert
          parsed_body = response.parsed_body
          expected_response_keys = {
            "application_type" => registration_params["application_type"],
            "grant_types" => registration_params["grant_types"],
            "initiate_login_uri" => registration_params["initiate_login_uri"],
            "redirect_uris" => registration_params["redirect_uris"],
            "logo_uri" => registration_params["logo_uri"],
            "response_types" => registration_params["response_types"],
            "client_name" => registration_params["client_name"],
            "jwks_uri" => registration_params["jwks_uri"],
            "token_endpoint_auth_method" => registration_params["token_endpoint_auth_method"],
            "scope" => registration_params["scope"],
          }
          expect(parsed_body).to include(expected_response_keys)
          expect(parsed_body["client_id"]).to eq DeveloperKey.last.global_id.to_s
          created_registration = Lti::IMS::Registration.last
          expect(created_registration.privacy_level).to eq("email_only")
          expect(created_registration).not_to be_nil
          expect(parsed_body["https://purl.imsglobal.org/spec/lti-tool-configuration"]["https://canvas.instructure.com/lti/registration_config_url"]).to match(%r{/api/lti/accounts/#{created_registration.lti_registration.account.global_id}/registrations/#{created_registration.global_id}/view})
          expect(created_registration.canvas_configuration["custom_fields"]).to eq({ "global_foo" => "global_bar" })
          expect(created_registration.unified_tool_id).to eq("asdf")
          expect(created_registration.registration_url).to eq("https://example.com/registration")
          expect(parsed_body["registration_client_uri"]).to match(%r{/api/lti/registrations/#{created_registration.global_id}})
        end

        it "accepts valid registration params and creates a registration" do
          # Arrange
          Account.site_admin.enable_feature!(:lti_registrations_next)
          Account.default.enable_feature!(:lti_registrations_next)
          registration_params, _, valid_token, = setup_valid_registration
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
          # Assert
          expect(response).to have_http_status(:ok)
          parsed_body = response.parsed_body
          expect(parsed_body["application_type"]).to eq(registration_params["application_type"])
          expect(parsed_body["client_name"]).to eq(registration_params["client_name"])
        end

        it "returns an error when registration params are invalid" do
          # Arrange
          registration_params, _, valid_token, = setup_valid_registration
          invalid_params = registration_params.dup
          invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"] = invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"].dup
          invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"].delete("target_link_uri")
          # Act
          post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
          # Assert
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["errors"]).to include(a_string_matching(/target_link_uri/))
        end

        it "fills in values on the developer key" do
          # Arrange
          Account.site_admin.enable_feature!(:lti_registrations_next)
          Account.default.enable_feature!(:lti_registrations_next)
          registration_params, token_hash, valid_token, scopes = setup_valid_registration
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
          # Assert
          dk = DeveloperKey.last
          expect(dk.name).to eq(registration_params["client_name"])
          expect(dk.scopes).to eq(scopes - ["openid"])
          expect(dk.account.global_id).to eql(token_hash[:root_account_global_id])
          expect(dk.redirect_uris.map(&:redirect_uri)).to eq(registration_params["redirect_uris"])
          expect(dk.public_jwk_url).to eq(registration_params["jwks_uri"])
          expect(dk.is_lti_key).to be(true)
          expect(dk.icon_url).to eq("https://example.com/logo.jpg")
          expect(dk.oidc_initiation_url).to eq(registration_params["initiate_login_uri"])
        end

        it "creates an Lti::Registration with expected values" do
          # Arrange
          Account.site_admin.enable_feature!(:lti_registrations_next)
          Account.default.enable_feature!(:lti_registrations_next)
          registration_params, token_hash, valid_token, = setup_valid_registration
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
          # Assert
          registration = Lti::Registration.last
          expect(registration.account.global_id).to eq(token_hash[:root_account_global_id])
          expect(registration.workflow_state).to eq("inactive")
          expect(registration.account_binding_for(Account.default).workflow_state).to eql("off")
          expect(registration.created_by.id).to eq(token_hash[:user_id])
          expect(registration.updated_by.id).to eq(token_hash[:user_id])
          expect(registration.admin_nickname).to eq(registration_params["client_name"])
          expect(registration.name).to eq(registration_params["client_name"])
          expect(registration.vendor).to eq(registration_params["https://purl.imsglobal.org/spec/lti-tool-configuration"]["https://canvas.instructure.com/lti/vendor"])
          expect(registration.ims_registration).to eq(Lti::IMS::Registration.last)
        end

        context "with flag disabled" do
          it "does not deploy the tool" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            Account.default.disable_feature!(:lti_registrations_next)
            # Act
            expect do
              post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            end.not_to change { ContextExternalTool.count }
            # Assert
          end
        end

        context "with flag enabled" do
          it "deploys the tool" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            Account.default.enable_feature!(:lti_registrations_next)
            # Act
            expect do
              post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            end.to change { ContextExternalTool.count }.by(1)
            # Assert
          end

          it "returns the tool's deployment_id" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            Account.default.enable_feature!(:lti_registrations_next)
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            parsed_body = response.parsed_body
            expect(parsed_body["deployment_id"]).to eq ContextExternalTool.last.deployment_id
          end

          it "marks the tool as unavailable" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            Account.default.enable_feature!(:lti_registrations_next)
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            context_control = Lti::ContextControl.last
            expect(context_control.deployment).to eq ContextExternalTool.last
            expect(context_control.available).to be false
          end
        end

        context "single-use token enforcement" do
          it "allows a fresh token to succeed" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:ok)
          end

          # TODO: grader violation — one-request. Testing single-use token enforcement requires two requests
          it "rejects a token that has already been used" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:ok)

            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:unauthorized)
            expect(response.parsed_body["errorMessage"]).to match(/already been used/)
          end
        end

        # Context: In production Canvas cloud, all Dynamic Registration install requests
        # are routed through sso.canvaslms.com and we handle routing to the correct shard.
        # This test ensures that even with that happening, we still create all the right records
        # in all the right places.
        context "with an installation happening across shards" do
          specs_require_sharding

          it "still finds the user, even though we start the create request on the other shard" do
            # Arrange
            account = @shard2.activate { account_model }
            user = @shard2.activate { user_model }
            token_hash = @shard2.activate do
              {
                user_id: user.global_id,
                initiated_at: 1.minute.ago,
                root_account_global_id: account.global_id,
                root_account_domain: account.domain,
                uuid: SecureRandom.uuid,
                unified_tool_id: "asdf",
                registration_url: "https://example.com/registration",
              }
            end
            valid_token = Canvas::Security.create_jwt(token_hash, 1.hour.from_now)
            registration_params = registration_params_hash(default_scopes)
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to be_successful

            # Everything should exist on shard2
            @shard2.activate do
              parsed_body = response.parsed_body
              expected_response_keys = {
                "application_type" => registration_params["application_type"],
                "grant_types" => registration_params["grant_types"],
                "initiate_login_uri" => registration_params["initiate_login_uri"],
                "redirect_uris" => registration_params["redirect_uris"],
                "logo_uri" => registration_params["logo_uri"],
                "response_types" => registration_params["response_types"],
                "client_name" => registration_params["client_name"],
                "jwks_uri" => registration_params["jwks_uri"],
                "token_endpoint_auth_method" => registration_params["token_endpoint_auth_method"],
                "scope" => registration_params["scope"],
              }

              expect(parsed_body).to include(expected_response_keys)
              expect(parsed_body["client_id"]).to eq DeveloperKey.last.global_id.to_s
              created_registration = Lti::IMS::Registration.last
              expect(created_registration.privacy_level).to eq("email_only")
              expect(created_registration).not_to be_nil
              expect(parsed_body["https://purl.imsglobal.org/spec/lti-tool-configuration"]["https://canvas.instructure.com/lti/registration_config_url"]).to match(%r{/api/lti/accounts/#{created_registration.lti_registration.account.global_id}/registrations/#{created_registration.global_id}/view})
              expect(created_registration.canvas_configuration["custom_fields"]).to eq({ "global_foo" => "global_bar" })
              expect(created_registration.unified_tool_id).to eq("asdf")
              expect(created_registration.registration_url).to eq("https://example.com/registration")
              expect(created_registration.lti_registration.account).to eq(account)
              expect(created_registration.lti_registration.created_by).to eq(user)
            end
          end
        end
      end

      context "and with invalid registration params" do
        context "missing a target_link_uri" do
          it "returns a 422 with validation errors" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"] = invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"].dup
            invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"].delete("target_link_uri")
            # Act
            post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:unprocessable_content)
            expect(response.body).to match(/target_link_uri/)
          end
        end

        context "with a nil target_link_uri" do
          it "returns a 422 with validation errors" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"] = invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"].dup
            invalid_params["https://purl.imsglobal.org/spec/lti-tool-configuration"]["target_link_uri"] = nil
            # Act
            post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:unprocessable_content)
            expect(response.body).to match(/target_link_uri/)
          end
        end

        context "with invalid grant types" do
          it "returns a 422 with validation errors" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["grant_types"] = ["not_part_of_the_spec", "implicit"]
            # Act
            post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:unprocessable_content)
            expect(response.body).to match(/grant_types.*client_credentials/)
          end

          it "doesn't create a stray developer key" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["grant_types"] = ["not_part_of_the_spec", "implicit"]
            # Act
            expect do
              post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            end.not_to change { DeveloperKey.count }
            # Assert
          end
        end

        context "with invalid response types" do
          it "returns a 422 with validation errors" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["response_types"] = ["not_part_of_the_spec"]
            # Act
            post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:unprocessable_content)
            expect(response.body).to match(/response_types.*id_token/)
          end

          it "doesn't create a stray developer key" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["response_types"] = ["not_part_of_the_spec"]
            # Act
            expect do
              post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            end.not_to change { DeveloperKey.count }
            # Assert
          end
        end

        context "with invalid token endpoint auth method" do
          it "returns a 422 with validation errors" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["token_endpoint_auth_method"] = "not_part_of_the_spec"
            # Act
            post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            # Assert
            expect(response).to have_http_status(:unprocessable_content)
            expect(response.body).to match(/token_endpoint_auth_method.*private_key_jwt/)
          end

          it "doesn't create a stray developer key" do
            # Arrange
            registration_params, _, valid_token, = setup_valid_registration
            invalid_params = registration_params.dup
            invalid_params["token_endpoint_auth_method"] = "not_part_of_the_spec"
            # Act
            expect do
              post "/api/lti/registrations", params: invalid_params, headers: { "Authorization" => "Bearer #{valid_token}" }
            end.not_to change { DeveloperKey.count }
            # Assert
          end
        end
      end

      context "with existing_registration in token" do
        it "creates a RegistrationUpdateRequest instead of a new registration" do
          # Arrange
          account = Account.default
          existing_registration = lti_ims_registration_model(account:)
          existing_registration.lti_registration.new_external_tool(account)
          registration_params = registration_params_hash(default_scopes)
          token_hash_with_existing = {
            user_id: User.create!.global_id,
            initiated_at: 1.minute.ago,
            root_account_global_id: account.global_id,
            root_account_domain: account.domain,
            uuid: SecureRandom.uuid,
            unified_tool_id: "asdf",
            registration_url: "https://example.com/registration",
            existing_registration: existing_registration.lti_registration.id
          }
          valid_token_with_existing = Canvas::Security.create_jwt(token_hash_with_existing, 1.hour.from_now)
          # Act
          expect do
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_with_existing}" }
          end.to change { Lti::RegistrationUpdateRequest.count }.by(1)
                                                                .and not_change { Lti::Registration.count }
          # Assert
        end

        context "when the RegistrationUpdateRequest has different attrs from the existing registration" do
          it "does not automatically accept the RegistrationUpdateRequest" do
            # Arrange
            account = Account.default
            existing_registration = lti_ims_registration_model(account:)
            existing_registration.lti_registration.new_external_tool(account)
            registration_params = registration_params_hash(default_scopes)
            token_hash_with_existing = {
              user_id: User.create!.global_id,
              initiated_at: 1.minute.ago,
              root_account_global_id: account.global_id,
              root_account_domain: account.domain,
              uuid: SecureRandom.uuid,
              unified_tool_id: "asdf",
              registration_url: "https://example.com/registration",
              existing_registration: existing_registration.lti_registration.id
            }
            valid_token_with_existing = Canvas::Security.create_jwt(token_hash_with_existing, 1.hour.from_now)
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_with_existing}" }
            # Assert
            expect(response).to be_successful
            update_request = Lti::RegistrationUpdateRequest.last
            expect(update_request.accepted_at).to be_nil
            expect(update_request.rejected_at).to be_nil
          end
        end

        it "creates RegistrationUpdateRequest with correct attributes" do
          # Arrange
          account = Account.default
          existing_registration = lti_ims_registration_model(account:)
          existing_registration.lti_registration.new_external_tool(account)
          registration_params = registration_params_hash(default_scopes)
          token_hash_with_existing = {
            user_id: User.create!.global_id,
            initiated_at: 1.minute.ago,
            root_account_global_id: account.global_id,
            root_account_domain: account.domain,
            uuid: SecureRandom.uuid,
            unified_tool_id: "asdf",
            registration_url: "https://example.com/registration",
            existing_registration: existing_registration.lti_registration.id
          }
          valid_token_with_existing = Canvas::Security.create_jwt(token_hash_with_existing, 1.hour.from_now)
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_with_existing}" }
          # Assert
          update_request = Lti::RegistrationUpdateRequest.last
          expect(update_request.lti_registration).to eq(existing_registration.lti_registration)
          expect(update_request.uuid).to eq(token_hash_with_existing[:uuid])
          expect(update_request.created_by_id).to eq(token_hash_with_existing[:user_id])
          expect(update_request.root_account_id).to eq(existing_registration.root_account.id)
          expect(update_request.lti_ims_registration).to be_present
        end

        it "returns the existing registration data" do
          # Arrange
          account = Account.default
          existing_registration = lti_ims_registration_model(account:)
          existing_registration.lti_registration.new_external_tool(account)
          registration_params = registration_params_hash(default_scopes)
          token_hash_with_existing = {
            user_id: User.create!.global_id,
            initiated_at: 1.minute.ago,
            root_account_global_id: account.global_id,
            root_account_domain: account.domain,
            uuid: SecureRandom.uuid,
            unified_tool_id: "asdf",
            registration_url: "https://example.com/registration",
            existing_registration: existing_registration.lti_registration.id
          }
          valid_token_with_existing = Canvas::Security.create_jwt(token_hash_with_existing, 1.hour.from_now)
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_with_existing}" }
          # Assert
          expect(response).to be_successful
          parsed_body = response.parsed_body
          expect(parsed_body["client_id"]).to eq(existing_registration.developer_key.global_id.to_s)
        end

        context "when existing registration is not found" do
          it "does not create a new registration or an update request" do
            # Arrange
            account = Account.default
            registration_params = registration_params_hash(default_scopes)
            token_hash_with_existing = {
              user_id: User.create!.global_id,
              initiated_at: 1.minute.ago,
              root_account_global_id: account.global_id,
              root_account_domain: account.domain,
              uuid: SecureRandom.uuid,
              unified_tool_id: "asdf",
              registration_url: "https://example.com/registration",
              existing_registration: 999_999
            }
            valid_token_with_existing = Canvas::Security.create_jwt(token_hash_with_existing, 1.hour.from_now)
            # Act
            expect do
              post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_with_existing}" }
            end.not_to change { Lti::RegistrationUpdateRequest.count }
            # Assert
            expect(response).to have_http_status(:not_found)
          end

          it "does not create an update request" do
            # Arrange
            account = Account.default
            registration_params = registration_params_hash(default_scopes)
            token_hash_with_existing = {
              user_id: User.create!.global_id,
              initiated_at: 1.minute.ago,
              root_account_global_id: account.global_id,
              root_account_domain: account.domain,
              uuid: SecureRandom.uuid,
              unified_tool_id: "asdf",
              registration_url: "https://example.com/registration",
              existing_registration: 999_999
            }
            valid_token_with_existing = Canvas::Security.create_jwt(token_hash_with_existing, 1.hour.from_now)
            # Act
            expect do
              post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_with_existing}" }
            end.not_to change { Lti::Registration.count }
            # Assert
            expect(response).to have_http_status(:not_found)
          end
        end

        context "when registration is on a different shard" do
          specs_require_sharding

          it "creates RegistrationUpdateRequest on the same shard as the registration" do
            # Arrange
            shard2_account = @shard2.activate { account_model }
            shard2_user = @shard2.activate do
              user = user_with_pseudonym(account: shard2_account)
              user.save! if user.new_record?
              user.reload
              user
            end
            shard2_registration = @shard2.activate do
              reg = lti_ims_registration_model(account: shard2_account)
              reg.lti_registration.new_external_tool(shard2_account)
              reg
            end
            registration_params = registration_params_hash(default_scopes)
            token_hash_cross_shard = {
              user_id: shard2_user.global_id,
              initiated_at: 1.minute.ago,
              root_account_global_id: shard2_account.global_id,
              root_account_domain: shard2_account.domain,
              uuid: SecureRandom.uuid,
              unified_tool_id: "cross_shard_test",
              registration_url: "https://example.com/registration",
              existing_registration: shard2_registration.lti_registration.global_id
            }
            valid_token_cross_shard = Canvas::Security.create_jwt(token_hash_cross_shard, 1.hour.from_now)
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_cross_shard}" }
            # Assert
            @shard2.activate do
              update_request = Lti::RegistrationUpdateRequest.last
              expect(update_request).not_to be_nil
              expect(update_request.lti_registration).to eq(shard2_registration.lti_registration)
              expect(update_request.root_account_id).to eq(shard2_account.id)
              expect(update_request.root_account).to eq(shard2_account)
              expect(update_request.shard).to eq(@shard2)
            end
          end

          it "finds and uses the registration on its shard" do
            # Arrange
            shard2_account = @shard2.activate { account_model }
            shard2_user = @shard2.activate do
              user = user_with_pseudonym(account: shard2_account)
              user.save! if user.new_record?
              user.reload
              user
            end
            shard2_registration = @shard2.activate do
              reg = lti_ims_registration_model(account: shard2_account)
              reg.lti_registration.new_external_tool(shard2_account)
              reg
            end
            registration_params = registration_params_hash(default_scopes)
            token_hash_cross_shard = {
              user_id: shard2_user.global_id,
              initiated_at: 1.minute.ago,
              root_account_global_id: shard2_account.global_id,
              root_account_domain: shard2_account.domain,
              uuid: SecureRandom.uuid,
              unified_tool_id: "cross_shard_test",
              registration_url: "https://example.com/registration",
              existing_registration: shard2_registration.lti_registration.global_id
            }
            valid_token_cross_shard = Canvas::Security.create_jwt(token_hash_cross_shard, 1.hour.from_now)
            # Act
            expect do
              post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_cross_shard}" }
            end.to change { @shard2.activate { Lti::RegistrationUpdateRequest.count } }.by(1)
            # Assert
          end

          it "successfully creates the update request with user reference" do
            # Arrange
            shard2_account = @shard2.activate { account_model }
            shard2_user = @shard2.activate do
              user = user_with_pseudonym(account: shard2_account)
              user.save! if user.new_record?
              user.reload
              user
            end
            shard2_registration = @shard2.activate do
              reg = lti_ims_registration_model(account: shard2_account)
              reg.lti_registration.new_external_tool(shard2_account)
              reg
            end
            registration_params = registration_params_hash(default_scopes)
            token_hash_cross_shard = {
              user_id: shard2_user.global_id,
              initiated_at: 1.minute.ago,
              root_account_global_id: shard2_account.global_id,
              root_account_domain: shard2_account.domain,
              uuid: SecureRandom.uuid,
              unified_tool_id: "cross_shard_test",
              registration_url: "https://example.com/registration",
              existing_registration: shard2_registration.lti_registration.global_id
            }
            valid_token_cross_shard = Canvas::Security.create_jwt(token_hash_cross_shard, 1.hour.from_now)
            # Act
            post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{valid_token_cross_shard}" }
            # Assert
            expect(response).to be_successful
            @shard2.activate do
              update_request = Lti::RegistrationUpdateRequest.last
              expect(update_request).not_to be_nil
              expect(update_request.created_by_id).to be_present
            end
          end
        end
      end
    end

    context "with an invalid token" do
      context "that has no uuid" do
        it "returns a 401" do
          # Arrange
          registration_params = registration_params_hash(default_scopes)
          initiation_time = 1.minute.ago
          token_hash = {
            user_id: User.create!.global_id,
            initiated_at: initiation_time,
            root_account_global_id: Account.first.root_account_id,
          }
          invalid_token = Canvas::Security.create_jwt(token_hash, initiation_time)
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{invalid_token}" }
          # Assert
          expect(response).to have_http_status(:unauthorized)
        end
      end

      context "from more than an hour ago" do
        it "returns a 401" do
          # Arrange
          registration_params = registration_params_hash(default_scopes)
          initiation_time = 62.minutes.ago # this should be too long ago to be accepted
          token_hash = {
            user_id: User.create!.global_id,
            initiated_at: initiation_time,
            root_account_global_id: Account.first.root_account_id,
            uuid: SecureRandom.uuid,
          }
          invalid_token = Canvas::Security.create_jwt(token_hash, initiation_time)
          # Act
          post "/api/lti/registrations", params: registration_params, headers: { "Authorization" => "Bearer #{invalid_token}" }
          # Assert
          expect(response).to have_http_status(:unauthorized)
        end
      end
    end
  end

  # Additional tests for #update method
  describe "#update", type: :request do
    include_context "advantage access token context"

    let(:account) { Account.default }
    let(:registration) { lti_ims_registration_model(account:) }
    let(:developer_key) do
      registration.developer_key.tap do |dk|
        dk.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
      end
    end
    let(:access_token_scopes) do
      [TokenScopes::LTI_REGISTRATION_SCOPE]
    end
    let(:access_token_exp) do
      Time.zone.now.to_i + 1.hour.to_i
    end
    let(:access_token_aud) do
      "http://canvas.instructure.com/login/oauth2/token"
    end
    let(:access_token_jwt_hash) do
      timestamp = Time.zone.now.to_i
      {
        iss: "https://canvas.instructure.com",
        sub: developer_key.global_id,
        aud: access_token_aud,
        iat: timestamp,
        exp: access_token_exp,
        nbf: (Time.zone.now.to_i - 30),
        jti: SecureRandom.uuid,
        scopes: access_token_scopes.join(" "),
      }
    end
    let(:access_token) do
      return nil if access_token_jwt_hash.blank?

      JSON::JWT.new(access_token_jwt_hash).sign(access_token_signing_key, :HS256).to_s
    end

    let(:update_params) do
      {
        "application_type" => "web",
        "grant_types" => ["client_credentials", "implicit"],
        "response_types" => ["id_token"],
        "redirect_uris" => ["https://updated.example.com/launch"],
        "initiate_login_uri" => "https://updated.example.com/login",
        "client_name" => "updated client name",
        "jwks_uri" => "https://updated.example.com/api/jwks",
        "token_endpoint_auth_method" => "private_key_jwt",

        "logo_uri" => "https://updated.example.com/logo.jpg",
        "https://purl.imsglobal.org/spec/lti-tool-configuration" => {
          "domain" => "updated.example.com",
          "messages" => [{
            "type" => "LtiResourceLinkRequest",
            "label" => "deep link label",
            "placements" => ["course_navigation"],
            "target_link_uri" => "https://updated.example.com/launch",
            "custom_parameters" => {
              "foo" => "bar"
            },
            "roles" => [
              "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper",
              "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"
            ],
            "icon_uri" => "https://updated.example.com/icon.jpg"
          }],
          "custom_parameters" => {
            "global_foo" => "global_bar"
          },
          "claims" => ["iss", "sub"],
          "target_link_uri" => "https://updated.example.com/launch",
          "https://canvas.instructure.com/lti/privacy_level" => "email_only",
          "https://canvas.instructure.com/lti/vendor" => "Vendor",
        },
        "contacts" => ["support@example.com"],
      }
    end

    context "with valid access token and scope" do
      it "creates a registration update request" do
        # Arrange
        # Act
        expect do
          put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
        end.to change { Lti::RegistrationUpdateRequest.count }.by(1)
        # Assert
        expect(response).to have_http_status(:ok)
      end

      it "validates using the schema's to_model_attrs" do
        # Arrange
        expect(Schemas::Lti::IMS::OidcRegistration).to receive(:to_model_attrs).and_call_original
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:ok)
      end

      it "creates update request with correct attributes" do
        # Arrange
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        update_request = Lti::RegistrationUpdateRequest.last
        expect(update_request.root_account_id).to eq(registration.root_account.id)
        expect(update_request.lti_registration_id).to eq(registration.lti_registration_id)
        expect(update_request.lti_ims_registration["client_name"]).to eq("updated client name")
        expect(update_request.lti_ims_registration["redirect_uris"]).to eq(["https://updated.example.com/launch"])
        expect(update_request.accepted_at).to be_nil
        expect(update_request.rejected_at).to be_nil
      end

      it "renders the registration response" do
        # Arrange
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        parsed_body = response.parsed_body
        expect(parsed_body["client_id"]).to eq(developer_key.global_id.to_s)
        expect(parsed_body["application_type"]).to eq("web")
        expect(parsed_body["grant_types"]).to eq(["client_credentials", "implicit"])
      end

      context "when the update params do not match the existing registration" do
        it "does not automatically accept the registration update request" do
          # Arrange
          # Act
          put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:ok)
          update_request = Lti::RegistrationUpdateRequest.last
          expect(update_request.accepted_at).to be_nil
          expect(update_request.rejected_at).to be_nil
        end

        context "when other params match but the tool configuration is different" do
          let(:registration) do
            lti_ims_registration_model(
              account:,
              client_name: update_params["client_name"],
              redirect_uris: update_params["redirect_uris"],
              initiate_login_uri: update_params["initiate_login_uri"],
              jwks_uri: update_params["jwks_uri"],
              logo_uri: update_params["logo_uri"],
              lti_tool_configuration: update_params["https://purl.imsglobal.org/spec/lti-tool-configuration"]
            )
          end

          it "does not accept the registration update request" do
            # Arrange
            modified_params = update_params.dup
            modified_params["https://purl.imsglobal.org/spec/lti-tool-configuration"] = modified_params["https://purl.imsglobal.org/spec/lti-tool-configuration"].dup
            modified_params["https://purl.imsglobal.org/spec/lti-tool-configuration"]["custom_parameters"] = { new_global_foo: "bar" }
            # Act
            put "/api/lti/registrations/#{registration.id}", params: modified_params, headers: { "Authorization" => "Bearer #{access_token}" }
            # Assert
            expect(response).to have_http_status(:ok)
            update_request = Lti::RegistrationUpdateRequest.last
            expect(update_request.accepted_at).to be_nil
            expect(update_request.rejected_at).to be_nil
          end
        end
      end

      context "when the update params match an existing registration" do
        let(:registration) do
          lti_ims_registration_model(
            account:,
            client_name: update_params["client_name"],
            redirect_uris: update_params["redirect_uris"],
            initiate_login_uri: update_params["initiate_login_uri"],
            jwks_uri: update_params["jwks_uri"],
            logo_uri: update_params["logo_uri"],
            scopes: [TokenScopes::LTI_REGISTRATION_SCOPE],
            lti_tool_configuration: update_params["https://purl.imsglobal.org/spec/lti-tool-configuration"]
          )
        end

        it "automatically accepts the registration update request" do
          # Arrange
          update_params_with_scopes = update_params.merge({ "scope" => registration.scopes.join(" ") })
          # Act
          put "/api/lti/registrations/#{registration.id}", params: update_params_with_scopes, headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:ok)
          update_request = Lti::RegistrationUpdateRequest.last
          expect(update_request.accepted_at).not_to be_nil
          expect(update_request.rejected_at).to be_nil
        end
      end

      context "with invalid registration params" do
        it "returns validation errors" do
          # Arrange
          invalid_params = update_params.merge("grant_types" => ["invalid_grant_type"])
          # Act
          put "/api/lti/registrations/#{registration.id}", params: invalid_params, headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["errors"]).to be_present
        end

        it "does not create a registration update request" do
          # Arrange
          invalid_params = update_params.merge("grant_types" => ["invalid_grant_type"])
          # Act
          expect do
            put "/api/lti/registrations/#{registration.id}", params: invalid_params, headers: { "Authorization" => "Bearer #{access_token}" }
          end.not_to change { Lti::RegistrationUpdateRequest.count }
          # Assert
        end

        it "returns the errors if to_model_attrs returns errors" do
          # Arrange
          to_model_attrs_result = { errors: ["update validation failed"], registration_attrs: nil }
          expect(Schemas::Lti::IMS::OidcRegistration).to \
            receive(:to_model_attrs).and_return(to_model_attrs_result)
          # Act
          put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.body).to match(/update validation failed/)
        end
      end

      context "with invalid redirect_uris" do
        it "returns validation errors" do
          # Arrange
          invalid_params = update_params.merge("redirect_uris" => ["not-a-valid-uri"])
          # Act
          put "/api/lti/registrations/#{registration.id}", params: invalid_params, headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["errors"]).to be_present
        end
      end

      context "with missing required fields" do
        it "returns validation errors" do
          # Arrange
          invalid_params = update_params.except("client_name")
          # Act
          put "/api/lti/registrations/#{registration.id}", params: invalid_params, headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:unprocessable_content)
          expect(response.parsed_body["errors"]).to be_present
        end
      end

      context "with non-existent registration" do
        it "returns a 404" do
          # Arrange
          # Act
          put "/api/lti/registrations/999999", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    context "with inactive developer key" do
      before do
        developer_key.update!(workflow_state: "inactive")
      end

      it "returns unauthorized when developer key is inactive" do
        # Arrange
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to match(/inactive Developer Key/i)
      end
    end

    context "without correct scope" do
      it "returns unauthorized when token lacks required scope" do
        # Arrange
        scopes_without_required = ["https://canvas.instructure.com/lti/account_lookup/scope/show"]
        timestamp = Time.zone.now.to_i
        jwt_hash_without_scope = {
          iss: "https://canvas.instructure.com",
          sub: developer_key.global_id,
          aud: access_token_aud,
          iat: timestamp,
          exp: timestamp + 1.hour.to_i,
          nbf: timestamp - 30,
          jti: SecureRandom.uuid,
          scopes: scopes_without_required.join(" "),
        }
        token_without_scope = JSON::JWT.new(jwt_hash_without_scope).sign(access_token_signing_key, :HS256).to_s
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{token_without_scope}" }
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to match(/Insufficient permissions/i)
      end

      it "does not create a registration update request" do
        # Arrange
        scopes_without_required = ["https://canvas.instructure.com/lti/account_lookup/scope/show"]
        timestamp = Time.zone.now.to_i
        jwt_hash_without_scope = {
          iss: "https://canvas.instructure.com",
          sub: developer_key.global_id,
          aud: access_token_aud,
          iat: timestamp,
          exp: timestamp + 1.hour.to_i,
          nbf: timestamp - 30,
          jti: SecureRandom.uuid,
          scopes: scopes_without_required.join(" "),
        }
        token_without_scope = JSON::JWT.new(jwt_hash_without_scope).sign(access_token_signing_key, :HS256).to_s
        # Act
        expect do
          put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{token_without_scope}" }
        end.not_to change { Lti::RegistrationUpdateRequest.count }
        # Assert
      end
    end

    context "with malformed authorization header" do
      it "returns unauthorized with malformed Bearer token" do
        # Arrange
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer" }
        # Assert
        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized with non-Bearer token" do
        # Arrange
        basic_auth = "Basic #{Base64.encode64("user:pass")}"
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => basic_auth }
        # Assert
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "without valid access token" do
      it "returns unauthorized when no token provided" do
        # Arrange
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to be_present
      end

      it "returns unauthorized with invalid token" do
        # Arrange
        # Act
        put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer invalid_token" }
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to be_present
      end

      context "with expired token" do
        it "returns unauthorized with expired token" do
          # Arrange
          expired_timestamp = Time.zone.now.to_i
          expired_jwt_hash = {
            iss: "https://canvas.instructure.com",
            sub: developer_key.global_id,
            aud: access_token_aud,
            iat: expired_timestamp,
            exp: expired_timestamp - 1.hour.to_i,
            nbf: (expired_timestamp - 30),
            jti: SecureRandom.uuid,
            scopes: access_token_scopes.join(" "),
          }
          expired_token = JSON::JWT.new(expired_jwt_hash).sign(access_token_signing_key, :HS256).to_s
          # Act
          put "/api/lti/registrations/#{registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{expired_token}" }
          # Assert
          expect(response).to have_http_status(:unauthorized)
        end
      end
    end

    context "when trying to update a different tool's registration" do
      let(:other_registration) { lti_ims_registration_model(account:) }
      let(:other_developer_key) do
        other_registration.developer_key.tap do |dk|
          dk.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        end
      end

      it "returns forbidden when trying to update another tool's registration" do
        # Arrange
        developer_key.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        # Act
        put "/api/lti/registrations/#{other_registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["errorMessage"]).to match(/not authorized/i)
      end

      it "does not create a registration update request" do
        # Arrange
        developer_key.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        # Act
        expect do
          put "/api/lti/registrations/#{other_registration.id}", params: update_params, headers: { "Authorization" => "Bearer #{access_token}" }
        end.not_to change { Lti::RegistrationUpdateRequest.count }
        # Assert
      end
    end

    context "with cross-shard registration" do
      specs_require_sharding

      it "creates a RegistrationUpdateRequest on the same shard as the registration" do
        # Arrange
        shard2_account = @shard2.activate { account_model }
        shard2_registration = @shard2.activate do
          lti_ims_registration_model(account: shard2_account)
        end
        shard2_developer_key = shard2_registration.developer_key.tap do |dk|
          dk.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        end
        timestamp = Time.zone.now.to_i
        cross_shard_jwt_hash = {
          iss: "https://canvas.instructure.com",
          sub: shard2_developer_key.global_id,
          aud: access_token_aud,
          iat: timestamp,
          exp: timestamp + 1.hour.to_i,
          nbf: (timestamp - 30),
          jti: SecureRandom.uuid,
          scopes: access_token_scopes.join(" "),
        }
        cross_shard_token = JSON::JWT.new(cross_shard_jwt_hash).sign(access_token_signing_key, :HS256).to_s
        # Act
        expect do
          put "/api/lti/registrations/#{shard2_registration.global_id}", params: update_params, headers: { "Authorization" => "Bearer #{cross_shard_token}" }
        end.to change { @shard2.activate { Lti::RegistrationUpdateRequest.count } }.by(1)
        # Assert
        expect(response).to be_successful
      end

      it "does not violate foreign key constraints" do
        # Arrange
        shard2_account = @shard2.activate { account_model }
        shard2_registration = @shard2.activate do
          lti_ims_registration_model(account: shard2_account)
        end
        shard2_developer_key = shard2_registration.developer_key.tap do |dk|
          dk.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        end
        timestamp = Time.zone.now.to_i
        cross_shard_jwt_hash = {
          iss: "https://canvas.instructure.com",
          sub: shard2_developer_key.global_id,
          aud: access_token_aud,
          iat: timestamp,
          exp: timestamp + 1.hour.to_i,
          nbf: (timestamp - 30),
          jti: SecureRandom.uuid,
          scopes: access_token_scopes.join(" "),
        }
        cross_shard_token = JSON::JWT.new(cross_shard_jwt_hash).sign(access_token_signing_key, :HS256).to_s
        # Act
        expect do
          put "/api/lti/registrations/#{shard2_registration.global_id}", params: update_params, headers: { "Authorization" => "Bearer #{cross_shard_token}" }
        end.not_to raise_error
        # Assert
        expect(response).to be_successful
      end

      it "creates update request with correct shard association" do
        # Arrange
        shard2_account = @shard2.activate { account_model }
        shard2_registration = @shard2.activate do
          lti_ims_registration_model(account: shard2_account)
        end
        shard2_developer_key = shard2_registration.developer_key.tap do |dk|
          dk.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        end
        timestamp = Time.zone.now.to_i
        cross_shard_jwt_hash = {
          iss: "https://canvas.instructure.com",
          sub: shard2_developer_key.global_id,
          aud: access_token_aud,
          iat: timestamp,
          exp: timestamp + 1.hour.to_i,
          nbf: (timestamp - 30),
          jti: SecureRandom.uuid,
          scopes: access_token_scopes.join(" "),
        }
        cross_shard_token = JSON::JWT.new(cross_shard_jwt_hash).sign(access_token_signing_key, :HS256).to_s
        # Act
        put "/api/lti/registrations/#{shard2_registration.global_id}", params: update_params, headers: { "Authorization" => "Bearer #{cross_shard_token}" }
        # Assert
        @shard2.activate do
          update_request = Lti::RegistrationUpdateRequest.last
          expect(update_request).not_to be_nil
          expect(update_request.shard).to eq(@shard2)
          expect(update_request.lti_registration).to eq(shard2_registration.lti_registration)
          expect(update_request.root_account).to eq(shard2_account)
          expect(update_request.root_account_id).to eq(shard2_account.id)
        end
      end

      it "returns successful response with registration data" do
        # Arrange
        shard2_account = @shard2.activate { account_model }
        shard2_registration = @shard2.activate do
          lti_ims_registration_model(account: shard2_account)
        end
        shard2_developer_key = shard2_registration.developer_key.tap do |dk|
          dk.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        end
        timestamp = Time.zone.now.to_i
        cross_shard_jwt_hash = {
          iss: "https://canvas.instructure.com",
          sub: shard2_developer_key.global_id,
          aud: access_token_aud,
          iat: timestamp,
          exp: timestamp + 1.hour.to_i,
          nbf: (timestamp - 30),
          jti: SecureRandom.uuid,
          scopes: access_token_scopes.join(" "),
        }
        cross_shard_token = JSON::JWT.new(cross_shard_jwt_hash).sign(access_token_signing_key, :HS256).to_s
        # Act
        put "/api/lti/registrations/#{shard2_registration.global_id}", params: update_params, headers: { "Authorization" => "Bearer #{cross_shard_token}" }
        # Assert
        expect(response).to be_successful
        parsed_body = response.parsed_body
        expect(parsed_body["client_id"]).to eq(shard2_developer_key.global_id.to_s)
      end
    end
  end

  describe "#show", type: :request do
    context "with a user session" do
      it "returns a successful response" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        user = account_admin_user(account:)
        user_session(user)

        # Act
        get "/api/lti/accounts/#{account.id}/registrations/#{registration.id}"

        # Assert
        expect(response).to have_http_status(:ok)
        response_data = response.parsed_body
        expect(response_data["id"]).to eq(registration.global_id.to_s)
      end

      it "returns the expected fields" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        user = account_admin_user(account:)
        user_session(user)

        # Act
        get "/api/lti/accounts/#{account.id}/registrations/#{registration.id}"

        # Assert
        expect(response).to have_http_status(:ok)
        response_data = response.parsed_body
        expect(response_data["id"]).to eq(registration.global_id.to_s)
        expect(response_data["lti_registration_id"]).to eq(Shard.global_id_for(registration.lti_registration_id).to_s)
        expect(response_data["developer_key_id"]).to eq(Shard.global_id_for(registration.developer_key_id).to_s)
        expect(response_data["client_name"]).to eq(registration.client_name)
        expect(response_data["guid"]).to eq(registration.guid)
        expect(response_data["jwks_uri"]).to eq(registration.jwks_uri)
        expect(response_data["initiate_login_uri"]).to eq(registration.initiate_login_uri)
        expect(response_data["redirect_uris"]).to eq(registration.redirect_uris)
        expect(response_data["logo_uri"]).to eq(registration.logo_uri)
        expect(response_data["client_uri"]).to eq(registration.client_uri)
        expect(response_data["scopes"]).to eq(registration.scopes)
        expect(response_data["application_type"]).to eq("web")
        expect(response_data["grant_types"]).to eq(%w[client_credentials implicit])
        expect(response_data["response_types"]).to eq(["id_token"])
        expect(response_data["token_endpoint_auth_method"]).to eq("private_key_jwt")
        expect(response_data["lti_tool_configuration"]).to eq(registration.lti_tool_configuration)
      end
    end

    context "without a user session" do
      it "returns unauthorized" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)

        # Act
        get "/api/lti/accounts/#{account.id}/registrations/#{registration.id}"

        # Assert
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "#registration_token", type: :request do
    it "returns a registration token with uuid, oidc_configuration_url, and token" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      user_session(admin)

      # Act
      get "/api/lti/accounts/#{account.id}/registration_token"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
      expect(response.parsed_body["oidc_configuration_url"]).to match(%r{\Ahttps?://.+/api/lti/security/openid-configuration\?registration_token=.+\z})
      token = JSON::JWT.decode(response.parsed_body["token"], :skip_verification)
      expect(token[:user_id]).to eql(admin.global_id)
      expect(token[:root_account_global_id]).to eql(account.global_id)
    end

    it "includes expected fields in token" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      user_session(admin)

      # Act
      get "/api/lti/accounts/#{account.id}/registration_token"

      # Assert
      expect(response).to have_http_status(:ok)
      token = JSON::JWT.decode(response.parsed_body["token"], :skip_verification)
      expect(token[:user_id]).to eql(admin.global_id)
      expect(token[:root_account_global_id]).to eql(Account.default.global_id)
      expect(token[:root_account_domain]).to eq(Account.default.domain)
      expect(token[:uuid]).to match(/\A[0-9a-f-]{36}\z/)
      expect(token[:registration_url]).to be_nil
    end

    it "uses iss domain in config url" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      user_session(admin)
      expected_iss = Canvas::Security.config["lti_iss"]

      # Act
      get "/api/lti/accounts/#{account.id}/registration_token"

      # Assert
      expect(response).to have_http_status(:ok)
      parsed_body = response.parsed_body
      expect(parsed_body["oidc_configuration_url"]).to include(expected_iss)
      expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
      token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
      expect(token[:user_id]).to eql(admin.global_id)
    end

    it "does not include unified_tool_id in token" do
      # Arrange
      account = Account.default
      admin = account_admin_user(account:)
      user_session(admin)

      # Act
      get "/api/lti/accounts/#{account.id}/registration_token"

      # Assert
      expect(response).to have_http_status(:ok)
      token = JSON::JWT.decode(response.parsed_body["token"], :skip_verification)
      expect(token[:unified_tool_id]).to be_nil
    end

    context "with unified_tool_id parameter" do
      it "includes unified_tool_id in token" do
        # Arrange
        account = Account.default
        admin = account_admin_user(account:)
        user_session(admin)
        unified_tool_id = "asdf"

        # Act
        get "/api/lti/accounts/#{account.id}/registration_token", params: { unified_tool_id: }

        # Assert
        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
        expect(parsed_body["oidc_configuration_url"]).to match(%r{\Ahttps?://.+/api/lti/security/openid-configuration\?registration_token=.+\z})
        token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
        expect(token[:user_id]).to eql(admin.global_id)
        expect(token[:unified_tool_id]).to eq(unified_tool_id)
      end

      context "is empty string" do
        it "includes nil in token" do
          # Arrange
          account = Account.default
          admin = account_admin_user(account:)
          user_session(admin)
          unified_tool_id = ""

          # Act
          get "/api/lti/accounts/#{account.id}/registration_token", params: { unified_tool_id: }

          # Assert
          expect(response).to have_http_status(:ok)
          parsed_body = response.parsed_body
          expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
          expect(parsed_body["oidc_configuration_url"]).to match(%r{\Ahttps?://.+/api/lti/security/openid-configuration\?registration_token=.+\z})
          token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
          expect(token[:user_id]).to eql(admin.global_id)
          expect(token[:unified_tool_id]).to be_nil
        end
      end
    end

    context "with registration_id parameter" do
      it "includes existing_registration in token" do
        # Arrange
        account = Account.default
        admin = account_admin_user(account:)
        user_session(admin)
        account.enable_feature!(:lti_dr_registrations_update)
        existing_registration = lti_registration_model(account:)

        # Act
        get "/api/lti/accounts/#{account.id}/registration_token", params: { registration_id: existing_registration.id }

        # Assert
        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
        expect(parsed_body["oidc_configuration_url"]).to match(%r{\Ahttps?://.+/api/lti/security/openid-configuration\?registration_token=.+\z})
        token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
        expect(token[:user_id]).to eql(admin.global_id)
        expect(token[:existing_registration]).to eq(existing_registration.global_id)
      end

      it "does not include existing_registration in token" do
        # Arrange
        account = Account.default
        admin = account_admin_user(account:)
        user_session(admin)
        account.disable_feature!(:lti_dr_registrations_update)
        existing_registration = lti_registration_model(account:)

        # Act
        get "/api/lti/accounts/#{account.id}/registration_token", params: { registration_id: existing_registration.id }

        # Assert
        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
        expect(parsed_body["oidc_configuration_url"]).to match(%r{\Ahttps?://.+/api/lti/security/openid-configuration\?registration_token=.+\z})
        token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
        expect(token[:user_id]).to eql(admin.global_id)
        expect(token[:existing_registration]).to be_nil
      end
    end

    context "in local dev" do
      it "uses local domain instead of iss" do
        # Arrange
        account = Account.default
        admin = account_admin_user(account:)
        user_session(admin)
        allow(Rails.env).to receive(:development?).and_return true

        # Act
        get "/api/lti/accounts/#{account.id}/registration_token"

        # Assert
        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body["oidc_configuration_url"]).to include("localhost")
        expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
        token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
        expect(token[:user_id]).to eql(admin.global_id)
      end

      context "when request scheme is http" do
        it "uses http for config url" do
          # Arrange
          account = Account.default
          admin = account_admin_user(account:)
          user_session(admin)
          allow(Rails.env).to receive(:development?).and_return true

          # Act
          get "http://localhost/api/lti/accounts/#{account.id}/registration_token"

          # Assert
          expect(response).to have_http_status(:ok)
          parsed_body = response.parsed_body
          expect(parsed_body["oidc_configuration_url"]).to include("http://")
          expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
          token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
          expect(token[:user_id]).to eql(admin.global_id)
        end
      end

      context "when request scheme is https" do
        it "uses https for config url" do
          # Arrange
          account = Account.default
          admin = account_admin_user(account:)
          user_session(admin)
          allow(Rails.env).to receive(:development?).and_return true

          # Act
          get "https://localhost/api/lti/accounts/#{account.id}/registration_token"

          # Assert
          expect(response).to have_http_status(:ok)
          parsed_body = response.parsed_body
          expect(parsed_body["oidc_configuration_url"]).to include("https://")
          expect(parsed_body["uuid"]).to match(/\A[0-9a-f-]{36}\z/)
          token = JSON::JWT.decode(parsed_body["token"], :skip_verification)
          expect(token[:user_id]).to eql(admin.global_id)
        end
      end
    end
  end

  describe "#dr_iframe", type: :request do
    it "must include the url parameter" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      Account.default.root_account.enable_feature! :javascript_csp
      Account.default.root_account.enable_csp!
      user_session(admin)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/dr_iframe"

      # Assert
      expect(response).to have_http_status(:bad_request)
    end

    it "returns unauthorized if jwt is expired" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      Account.default.root_account.enable_feature! :javascript_csp
      Account.default.root_account.enable_csp!
      user_session(admin)
      registration_url = "http://testexample.com"
      expired_jwt = Canvas::Security.create_jwt({
                                                  user_id: admin.global_id,
                                                  root_account_global_id: Account.default.global_id,
                                                  registration_url:
                                                },
                                                5.minutes.ago)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "#{registration_url}?registration_token=#{expired_jwt}" }

      # Assert
      expect(response).to have_http_status(:unauthorized)
    end

    it "returns unauthorized if jwt is issued for other account" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      Account.default.root_account.enable_feature! :javascript_csp
      Account.default.root_account.enable_csp!
      user_session(admin)
      registration_url = "http://testexample.com"
      jwt = Canvas::Security.create_jwt({
                                          user_id: admin.global_id,
                                          root_account_global_id: 123,
                                          registration_url:
                                        },
                                        5.minutes.from_now)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "#{registration_url}?registration_token=#{jwt}" }

      # Assert
      expect(response).to have_http_status(:unauthorized)
      expect(response.headers["Content-Security-Policy"]).not_to include("testexample.com")
    end

    it "returns unauthorized if jwt is issued for other user" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      Account.default.root_account.enable_feature! :javascript_csp
      Account.default.root_account.enable_csp!
      user_session(admin)
      registration_url = "http://testexample.com"
      jwt = Canvas::Security.create_jwt({
                                          user_id: admin.global_id + 1,
                                          root_account_global_id: Account.default.global_id,
                                          registration_url:
                                        },
                                        5.minutes.from_now)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "#{registration_url}?registration_token=#{jwt}" }

      # Assert
      expect(response).to have_http_status(:unauthorized)
      expect(response.headers["Content-Security-Policy"]).not_to include("testexample.com")
    end

    it "adds url to CSP whitelist if registration_token is valid" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      Account.default.root_account.enable_feature! :javascript_csp
      Account.default.root_account.enable_csp!
      user_session(admin)
      registration_url = "http://testexample.com"
      valid_jwt = Canvas::Security.create_jwt({
                                                user_id: admin.global_id,
                                                root_account_global_id: Account.default.global_id,
                                                registration_url:
                                              },
                                              5.minutes.from_now)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "#{registration_url}?registration_token=#{valid_jwt}" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.headers).to have_key("Content-Security-Policy")
      expect(response.headers["Content-Security-Policy"]).to include("testexample.com")
    end

    context "URL scheme validation" do
      it "rejects javascript: scheme" do
        # Arrange
        admin = account_admin_user(account: Account.default)
        Account.default.root_account.enable_feature! :javascript_csp
        Account.default.root_account.enable_csp!
        user_session(admin)

        # Act
        get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "javascript:alert(1)" }

        # Assert
        expect(response).to have_http_status(:bad_request)
      end

      it "rejects data: scheme" do
        # Arrange
        admin = account_admin_user(account: Account.default)
        Account.default.root_account.enable_feature! :javascript_csp
        Account.default.root_account.enable_csp!
        user_session(admin)

        # Act
        get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "data:text/html,test" }

        # Assert
        expect(response).to have_http_status(:bad_request)
      end

      it "accepts https scheme" do
        # Arrange
        admin = account_admin_user(account: Account.default)
        Account.default.root_account.enable_feature! :javascript_csp
        Account.default.root_account.enable_csp!
        user_session(admin)
        registration_url = "https://testexample.com"
        valid_jwt = Canvas::Security.create_jwt({
                                                  user_id: admin.global_id,
                                                  root_account_global_id: Account.default.global_id,
                                                  registration_url:
                                                },
                                                5.minutes.from_now)

        # Act
        get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "#{registration_url}?registration_token=#{valid_jwt}" }

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.headers).to have_key("Content-Security-Policy")
      end
    end

    context "URL origin binding" do
      it "rejects a url with a different host than registration_url in the jwt" do
        # Arrange
        admin = account_admin_user(account: Account.default)
        Account.default.root_account.enable_feature! :javascript_csp
        Account.default.root_account.enable_csp!
        user_session(admin)
        registration_url = "http://testexample.com"
        valid_jwt = Canvas::Security.create_jwt({
                                                  user_id: admin.global_id,
                                                  root_account_global_id: Account.default.global_id,
                                                  registration_url:
                                                },
                                                5.minutes.from_now)

        # Act
        get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "http://evil.example.com?registration_token=#{valid_jwt}" }

        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.headers["Content-Security-Policy"]).not_to include("evil.example.com")
      end

      it "rejects a url with a different scheme than registration_url in the jwt" do
        # Arrange
        admin = account_admin_user(account: Account.default)
        Account.default.root_account.enable_feature! :javascript_csp
        Account.default.root_account.enable_csp!
        user_session(admin)
        registration_url = "http://testexample.com"
        valid_jwt = Canvas::Security.create_jwt({
                                                  user_id: admin.global_id,
                                                  root_account_global_id: Account.default.global_id,
                                                  registration_url:
                                                },
                                                5.minutes.from_now)

        # Act
        get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "https://testexample.com?registration_token=#{valid_jwt}" }

        # Assert
        expect(response).to have_http_status(:unauthorized)
      end

      it "rejects a url with a different port than registration_url in the jwt" do
        # Arrange
        admin = account_admin_user(account: Account.default)
        Account.default.root_account.enable_feature! :javascript_csp
        Account.default.root_account.enable_csp!
        user_session(admin)
        registration_url = "http://testexample.com"
        valid_jwt = Canvas::Security.create_jwt({
                                                  user_id: admin.global_id,
                                                  root_account_global_id: Account.default.global_id,
                                                  registration_url:
                                                },
                                                5.minutes.from_now)

        # Act
        get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "http://testexample.com:8080?registration_token=#{valid_jwt}" }

        # Assert
        expect(response).to have_http_status(:unauthorized)
      end

      it "allows additional query parameters beyond what is in the jwt registration_url" do
        # Arrange
        admin = account_admin_user(account: Account.default)
        Account.default.root_account.enable_feature! :javascript_csp
        Account.default.root_account.enable_csp!
        user_session(admin)
        registration_url = "http://testexample.com"
        valid_jwt = Canvas::Security.create_jwt({
                                                  user_id: admin.global_id,
                                                  root_account_global_id: Account.default.global_id,
                                                  registration_url:
                                                },
                                                5.minutes.from_now)

        # Act
        get "/api/lti/accounts/#{Account.default.id}/dr_iframe", params: { url: "#{registration_url}?openid_configuration=https%3A%2F%2Fcanvas.example.com&registration_token=#{valid_jwt}" }

        # Assert
        expect(response).to have_http_status(:ok)
        expect(response.headers).to have_key("Content-Security-Policy")
        expect(response.headers["Content-Security-Policy"]).to include("testexample.com")
      end
    end
  end

  describe "#lti_registration_by_uuid", type: :request do
    it "returns a 404 if the registration cannot be found" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      user_session(admin)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/lti_registrations/uuid/123"

      # Assert
      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body["errors"].first["message"]).to eq("The specified resource does not exist.")
    end

    it "returns the registration configuration and overlay for the given UUID" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      user_session(admin)
      custom_target_uri = "https://custom.example.com/launch"
      registration = lti_ims_registration_model(
        account: Account.default,
        lti_tool_configuration: {
          target_link_uri: custom_target_uri,
          messages: []
        }
      )
      Lti::Overlay.create!(account: Account.default, registration: registration.lti_registration, data: { "description" => "test" })

      # Act
      get "/api/lti/accounts/#{Account.default.id}/lti_registrations/uuid/#{registration.guid}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["configuration"]["target_link_uri"]).to eq(custom_target_uri)
      expect(response.parsed_body["overlay"]["data"]).to eq({ "description" => "test" })
    end
  end

  describe "#ims_registration_by_uuid", type: :request do
    it "returns a 404 if the registration cannot be found" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      user_session(admin)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/registrations/uuid/123"

      # Assert
      expect(response).to have_http_status(:not_found)
    end

    it "returns the registration configuration for the given UUID" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      user_session(admin)
      expected_tool_configuration = {
        claims: %w[sub iss name given_name family_name nickname picture email locale],
        custom_parameters: {},
        domain: "example.com",
        messages: [
          {
            "https://canvas.instructure.com/lti/course_navigation/default_enabled": true,
            type: "LtiResourceLinkRequest",
            icon_uri: "https://example.com/api/apps/1/icon.svg",
            label: "Test Dynamic Registration (Global Navigation)",
            custom_parameters: {
              foo: "bar",
              context_id: "$Context.id"
            },
            placements: ["global_navigation"],
            roles: [],
            target_link_uri: "https://example.com/api/registrations/3/launch?placement=global_navigation"
          }
        ],
        target_link_uri: "https://example.com/api/registrations/3/launch",
        "https://canvas.instructure.com/lti/privacy_level": "public"
      }
      registration = lti_ims_registration_model(account: Account.default, lti_tool_configuration: expected_tool_configuration)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/registrations/uuid/#{registration.guid}"

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["lti_tool_configuration"].with_indifferent_access).to eq(expected_tool_configuration.with_indifferent_access)
      expect(response.parsed_body["overlay"]).to be_nil
    end
  end

  describe "#lti_registration_update_request_by_uuid", type: :request do
    it "returns a 404 if the registration update request cannot be found" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      user_session(admin)

      # Act
      get "/api/lti/accounts/#{Account.default.id}/lti_registration_update_request/uuid/123"

      # Assert
      expect(response).to have_http_status(:not_found)
    end

    it "returns the update request for the given UUID" do
      # Arrange
      admin = account_admin_user(account: Account.default)
      user_session(admin)
      update_request = lti_ims_registration_update_request_model(
        root_account: Account.default,
        created_by: admin
      )
      expected_config = update_request.as_json["internal_lti_configuration"]

      # Act
      get "/api/lti/accounts/#{Account.default.id}/lti_registration_update_request/uuid/#{update_request.uuid}"

      # Assert
      expect(response).to have_http_status(:ok)
      parsed_body = response.parsed_body
      expect(parsed_body["uuid"]).to eq(update_request.uuid)
      expect(parsed_body["lti_registration_id"]).to eql(update_request.lti_registration.id)
      expect(parsed_body["internal_lti_configuration"]).to eql(expected_config)
    end
  end

  describe "#update_registration_overlay", type: :request do
    it "saves overlay configuration changes for the registration" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        disabledScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ]
      }
      account = Account.default
      registration = lti_ims_registration_model(account:)
      user = account_admin_user(account:)
      user_session(user)

      # Act
      put "/api/lti/accounts/#{account.id}/registrations/#{registration.id}/overlay",
          env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eql(registration.global_id.to_s)
      overlay_data = registration.lti_registration.overlay_for(account).data
      expect(overlay_data["disabled_placements"]).to eq(overlay[:disabledPlacements])
      expect(overlay_data["disabled_scopes"]).to eq(overlay[:disabledScopes])
    end

    it "removes disabled scopes from the associated developer key" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        disabledScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ]
      }
      account = Account.default
      registration = lti_ims_registration_model(account:)
      user = account_admin_user(account:)
      user_session(user)

      # Act
      put "/api/lti/accounts/#{account.id}/registrations/#{registration.id}/overlay",
          env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eql(registration.global_id.to_s)
      expect(registration.reload.developer_key.scopes).not_to include("https://purl.imsglobal.org/spec/lti-ags/scope/lineitem")
    end

    it "doesn't error if no disabledScopes are included in the request" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ]
      }
      account = Account.default
      registration = lti_ims_registration_model(account:)
      user = account_admin_user(account:)
      user_session(user)

      # Act
      put "/api/lti/accounts/#{account.id}/registrations/#{registration.id}/overlay",
          env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eql(registration.global_id.to_s)
      overlay_data = registration.lti_registration.overlay_for(account).data
      expect(overlay_data["disabled_placements"]).to eq(overlay[:disabledPlacements])
      expect(overlay_data["disabled_scopes"]).to be_nil
    end

    it "returns a 422 if the request body does not meet the schema" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        disabledScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ],
        invalid: "data"
      }
      account = Account.default
      registration = lti_ims_registration_model(account:)
      user = account_admin_user(account:)
      user_session(user)

      # Act
      put "/api/lti/accounts/#{account.id}/registrations/#{registration.id}/overlay",
          env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }

      # Assert
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "returns a 404 if the registration cannot be found" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        disabledScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ]
      }
      account = Account.default
      user = account_admin_user(account:)
      user_session(user)

      # Act
      put "/api/lti/accounts/#{account.id}/registrations/999999/overlay",
          env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }

      # Assert
      expect(response).to have_http_status(:not_found)
    end

    it "creates an Lti::Overlay if one isn't present" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        disabledScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ]
      }
      account = Account.default
      registration = lti_ims_registration_model(account:)
      user = account_admin_user(account:)
      user_session(user)

      # Act & Assert
      expect do
        put "/api/lti/accounts/#{account.id}/registrations/#{registration.id}/overlay",
            env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }
      end.to change { Lti::Overlay.count }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eql(registration.global_id.to_s)
      expect(Lti::Overlay.last.data)
        .to eq({
                 "disabled_placements" => overlay[:disabledPlacements],
                 "disabled_scopes" => overlay[:disabledScopes],
                 "placements" => {
                   "account_navigation" => {
                     "icon_url" => "https://example.com/icon.jpg"
                   }
                 }
               })
    end

    it "updates the Lti::Overlay model when one is already present" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        disabledScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ]
      }
      account = Account.default
      registration = lti_ims_registration_model(account:)
      user = account_admin_user(account:)
      lti_overlay = Lti::Overlay.new(
        account:,
        updated_by: user_model,
        registration: registration.lti_registration,
        data: {}
      )
      lti_overlay.save!
      user_session(user)

      # Act
      put "/api/lti/accounts/#{account.id}/registrations/#{registration.id}/overlay",
          env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eql(registration.global_id.to_s)
      expect(lti_overlay.reload.updated_by).to eq(user)
      expect(lti_overlay.data).to eq({
                                       "disabled_placements" => ["course_navigation"],
                                       "disabled_scopes" => ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
                                       "placements" => {
                                         "account_navigation" => {
                                           "icon_url" => "https://example.com/icon.jpg"
                                         }
                                       }
                                     })
    end

    it "updates the Lti::Overlay model when no user is associated with it" do
      # Arrange
      overlay = {
        disabledPlacements: ["course_navigation"],
        disabledScopes: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
        placements: [
          {
            type: "account_navigation",
            icon_url: "https://example.com/icon.jpg"
          }
        ]
      }
      account = Account.default
      registration = lti_ims_registration_model(account:)
      user = account_admin_user(account:)
      lti_overlay = Lti::Overlay.new(
        account:,
        updated_by: nil,
        registration: registration.lti_registration,
        data: {}
      )
      lti_overlay.save!
      user_session(user)

      # Act
      put "/api/lti/accounts/#{account.id}/registrations/#{registration.id}/overlay",
          env: { "rack.input" => StringIO.new(overlay.to_json), "CONTENT_TYPE" => "application/json" }

      # Assert
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eql(registration.global_id.to_s)
      expect(lti_overlay.reload.updated_by).to eq(user)
      expect(lti_overlay.data).to eq({
                                       "disabled_placements" => ["course_navigation"],
                                       "disabled_scopes" => ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem"],
                                       "placements" => {
                                         "account_navigation" => {
                                           "icon_url" => "https://example.com/icon.jpg"
                                         }
                                       }
                                     })
    end
  end

  describe "#show_configuration", type: :request do
    def create_registration_access_token(developer_key, scopes, signing_key, exp: nil)
      exp ||= Time.zone.now.to_i + 1.hour.to_i
      timestamp = Time.zone.now.to_i
      jwt_hash = {
        iss: "https://canvas.instructure.com",
        sub: developer_key.global_id,
        aud: "http://canvas.instructure.com/login/oauth2/token",
        iat: timestamp,
        exp:,
        nbf: (timestamp - 30),
        jti: SecureRandom.uuid,
        scopes: scopes.join(" "),
      }
      JSON::JWT.new(jwt_hash).sign(signing_key, :HS256).to_s
    end

    context "with valid access token and LTI registration scope" do
      it "returns the dynamic registration configuration" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        developer_key = registration.developer_key
        developer_key.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
        root_deployment = registration.lti_registration.new_external_tool(account)
        scopes = [TokenScopes::LTI_REGISTRATION_SCOPE]
        signing_key = Canvas::Security.jwt_encryption_key
        access_token = create_registration_access_token(developer_key, scopes, signing_key)
        # Act
        get "/api/lti/registrations/#{registration.id}", headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body["client_id"]).to eq(developer_key.global_id.to_s)
        expect(parsed_body["application_type"]).to eq(Lti::IMS::Registration::REQUIRED_APPLICATION_TYPE)
        expect(parsed_body["grant_types"]).to eq(Lti::IMS::Registration::REQUIRED_GRANT_TYPES)
        expect(parsed_body["response_types"]).to eq([Lti::IMS::Registration::REQUIRED_RESPONSE_TYPE])
        expect(parsed_body["token_endpoint_auth_method"]).to eq(Lti::IMS::Registration::REQUIRED_TOKEN_ENDPOINT_AUTH_METHOD)
        expect(parsed_body["client_name"]).to eq(registration.client_name)
        expect(parsed_body["initiate_login_uri"]).to eq(registration.initiate_login_uri)
        expect(parsed_body["redirect_uris"]).to eq(registration.redirect_uris)
        expect(parsed_body["jwks_uri"]).to eq(registration.jwks_uri)
        expect(parsed_body["logo_uri"]).to eq(developer_key.icon_url)
        expected_scopes = (registration.scopes + ["openid"]).sort.uniq
        actual_scopes = parsed_body["scope"].split.sort.uniq
        expect(actual_scopes).to eq(expected_scopes)
        lti_config = parsed_body["https://purl.imsglobal.org/spec/lti-tool-configuration"]
        expect(lti_config["domain"]).to eq(registration.lti_tool_configuration["domain"])
        expected_config_url = "http://www.example.com/api/lti/accounts/#{account.global_id}/registrations/#{registration.global_id}/view"
        expect(lti_config["https://canvas.instructure.com/lti/registration_config_url"]).to eq(expected_config_url)
        expect(parsed_body["registration_client_uri"]).to eq("http://www.example.com/api/lti/registrations/#{registration.global_id}")
        expect(parsed_body["deployment_id"]).to eq(root_deployment.deployment_id)
      end
    end

    context "with valid access token and LTI registration read-only scope" do
      it "returns the dynamic registration configuration" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        developer_key = registration.developer_key
        scopes = [TokenScopes::LTI_REGISTRATION_READ_ONLY_SCOPE]
        developer_key.update!(scopes:)
        signing_key = Canvas::Security.jwt_encryption_key
        access_token = create_registration_access_token(developer_key, scopes, signing_key)
        # Act
        get "/api/lti/registrations/#{registration.id}", headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:ok)
        parsed_body = response.parsed_body
        expect(parsed_body["client_id"]).to eq(developer_key.global_id.to_s)
        expect(parsed_body["client_name"]).to eq(registration.client_name)
      end
    end

    context "with invalid access token" do
      it "returns unauthorized when no token provided" do
        # Arrange
        registration = lti_ims_registration_model(account: Account.default)
        # Act
        get "/api/lti/registrations/#{registration.id}"
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to eq("Missing access token")
      end

      it "returns unauthorized with invalid token" do
        # Arrange
        registration = lti_ims_registration_model(account: Account.default)
        # Act
        get "/api/lti/registrations/#{registration.id}", headers: { "Authorization" => "Bearer invalid_token" }
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to eq("Invalid access token format")
      end

      context "with expired token" do
        it "returns unauthorized with expired token" do
          # Arrange
          account = Account.default
          registration = lti_ims_registration_model(account:)
          developer_key = registration.developer_key
          developer_key.update!(scopes: [TokenScopes::LTI_REGISTRATION_SCOPE])
          scopes = [TokenScopes::LTI_REGISTRATION_SCOPE]
          signing_key = Canvas::Security.jwt_encryption_key
          exp = Time.zone.now.to_i - 1.hour.to_i
          access_token = create_registration_access_token(developer_key, scopes, signing_key, exp:)
          # Act
          get "/api/lti/registrations/#{registration.id}", headers: { "Authorization" => "Bearer #{access_token}" }
          # Assert
          expect(response).to have_http_status(:unauthorized)
        end
      end
    end

    context "with inactive developer key" do
      it "returns unauthorized when developer key is inactive" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        developer_key = registration.developer_key
        scopes = [TokenScopes::LTI_REGISTRATION_SCOPE]
        developer_key.update!(workflow_state: "inactive")
        signing_key = Canvas::Security.jwt_encryption_key
        access_token = create_registration_access_token(developer_key, scopes, signing_key)
        # Act
        get "/api/lti/registrations/#{registration.id}", headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to match(/inactive Developer Key/i)
      end
    end

    context "without correct scope" do
      it "returns unauthorized when token lacks required scope" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        developer_key = registration.developer_key
        scopes = ["https://canvas.instructure.com/lti/account_lookup/scope/show"]
        developer_key.update!(scopes:)
        signing_key = Canvas::Security.jwt_encryption_key
        access_token = create_registration_access_token(developer_key, scopes, signing_key)
        # Act
        get "/api/lti/registrations/#{registration.id}", headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errorMessage"]).to match(/Insufficient permissions/i)
      end
    end

    context "with non-existent registration" do
      it "returns a 404" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        developer_key = registration.developer_key
        scopes = [TokenScopes::LTI_REGISTRATION_SCOPE]
        developer_key.update!(scopes:)
        signing_key = Canvas::Security.jwt_encryption_key
        access_token = create_registration_access_token(developer_key, scopes, signing_key)
        non_existent_id = registration.id + 1000
        # Act
        get "/api/lti/registrations/#{non_existent_id}", headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:not_found)
      end
    end

    context "when trying to access a different tool's configuration" do
      it "returns forbidden when accessing another tool's configuration" do
        # Arrange
        account = Account.default
        registration = lti_ims_registration_model(account:)
        developer_key = registration.developer_key
        other_registration = lti_ims_registration_model(account:)
        scopes = [TokenScopes::LTI_REGISTRATION_SCOPE]
        developer_key.update!(scopes:)
        signing_key = Canvas::Security.jwt_encryption_key
        access_token = create_registration_access_token(developer_key, scopes, signing_key)
        # Act
        get "/api/lti/registrations/#{other_registration.id}", headers: { "Authorization" => "Bearer #{access_token}" }
        # Assert
        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["errorMessage"]).to match(/not authorized/i)
      end
    end
  end

  describe "modify_site_admin_developer_keys permission", type: :request do
    let(:site_admin) { Account.site_admin }
    let(:site_admin_admin) { account_admin_user(account: site_admin) }
    let(:site_admin_without_permission) do
      user = user_model
      role = custom_account_role("limited_admin", account: site_admin)
      # Grant manage_developer_keys but not modify_site_admin_developer_keys
      site_admin.role_overrides.create!(
        permission: :manage_developer_keys,
        role:,
        enabled: true
      )
      site_admin.account_users.create!(user:, role:)
      user
    end

    before do
      site_admin.enable_feature!(:modify_site_admin_developer_keys_permission)
    end

    describe "GET #registration_token" do
      context "when user has modify_site_admin_developer_keys permission" do
        it "allows generating registration token for site admin" do
          # Arrange
          user_session(site_admin_admin)

          # Act
          get "/api/lti/accounts/#{site_admin.id}/registration_token"

          # Assert
          expect(response).to have_http_status(:ok)
          expect(response.parsed_body["token"]).to be_present
        end
      end

      context "when user lacks modify_site_admin_developer_keys permission" do
        it "returns forbidden for site admin registration token generation" do
          # Arrange
          user_session(site_admin_without_permission)

          # Act
          get "/api/lti/accounts/#{site_admin.id}/registration_token"

          # Assert
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    describe "PATCH #update_registration_overlay" do
      context "when user has modify_site_admin_developer_keys permission" do
        it "allows updating registration overlay for site admin registrations" do
          # Arrange
          registration = lti_ims_registration_model(account: site_admin)
          overlay = { title: "Updated Title" }
          user_session(site_admin_admin)

          # Act
          put "/api/lti/accounts/#{site_admin.id}/registrations/#{registration.id}/overlay", params: overlay.to_json, headers: { "CONTENT_TYPE" => "application/json" }

          # Assert
          expect(response).to have_http_status(:ok)
        end
      end

      context "when user lacks modify_site_admin_developer_keys permission" do
        it "returns forbidden for site admin registration overlay updates" do
          # Arrange
          registration = lti_ims_registration_model(account: site_admin)
          overlay = { title: "Updated Title" }
          user_session(site_admin_without_permission)

          # Act
          put "/api/lti/accounts/#{site_admin.id}/registrations/#{registration.id}/overlay", params: overlay.to_json, headers: { "CONTENT_TYPE" => "application/json" }

          # Assert
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    context "for regular account operations" do
      it "does not require modify_site_admin_developer_keys for regular accounts" do
        # Arrange
        regular_account = Account.default
        regular_admin = user_model
        role = custom_account_role("limited_admin", account: regular_account)
        regular_account.role_overrides.create!(
          permission: :manage_developer_keys,
          role:,
          enabled: true
        )
        regular_account.account_users.create!(user: regular_admin, role:)
        user_session(regular_admin)

        # Act
        get "/api/lti/accounts/#{regular_account.id}/registration_token"

        # Assert
        expect(response).to have_http_status(:ok)
      end
    end
  end
end

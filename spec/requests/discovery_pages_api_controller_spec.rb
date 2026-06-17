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
#

describe DiscoveryPagesApiController do
  let(:account) { Account.default }

  describe "PUT 'upsert'" do
    let!(:auth_provider) { account.authentication_providers.create!(auth_type: "saml") }
    let!(:secondary_auth_provider) { account.authentication_providers.create!(auth_type: "cas") }

    let(:valid_discovery_page) do
      {
        primary: [
          { authentication_provider_id: auth_provider.id, label: "Test Provider" }
        ],
        secondary: [
          { authentication_provider_id: secondary_auth_provider.id, label: "Other Provider", icon: "google" }
        ],
        active: false
      }
    end

    context "when not logged in" do
      it "returns unauthorized" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page }
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when logged in without manage_account_settings permission" do
      before do
        user_factory(active_all: true)
        user_session(@user)
      end

      it "returns forbidden" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page }
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when logged in with manage_account_settings permission" do
      before do
        account_admin_user(account:, active_all: true)
        user_session(@admin)
      end

      it "stores discovery_page settings successfully" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page }
        expect(response).to have_http_status(:ok)
        json = json_parse(response.body)
        expect(json["discovery_page"]["primary"].length).to eq(1)
        expect(json["discovery_page"]["primary"][0]["authentication_provider_id"]).to eq(auth_provider.id.to_s)
        expect(json["discovery_page"]["primary"][0]["label"]).to eq("Test Provider")
        expect(json["discovery_page"]["secondary"].length).to eq(1)
        expect(json["discovery_page"]["secondary"][0]["icon"]).to eq("google")
      end

      it "persists settings to the domain root account" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page }

        account.reload
        expect(account.settings[:discovery_page][:primary].length).to eq(1)
        expect(account.settings[:discovery_page][:primary][0][:authentication_provider_id]).to eq(auth_provider.id.to_s)
        expect(account.settings[:discovery_page][:primary][0][:label]).to eq("Test Provider")
        expect(account.settings[:discovery_page][:secondary].length).to eq(1)
        expect(account.settings[:discovery_page][:secondary][0][:authentication_provider_id]).to eq(secondary_auth_provider.id.to_s)
        expect(account.settings[:discovery_page][:secondary][0][:label]).to eq("Other Provider")
      end

      it "returns 422 when required fields are missing" do
        invalid_page = {
          primary: [
            { authentication_provider_id: auth_provider.id }
          ],
          secondary: []
        }

        put "/api/v1/discovery_pages", params: { discovery_page: invalid_page }

        expect(response).to have_http_status(:unprocessable_content)
        json = json_parse(response.body)
        expect(json["errors"].pluck("message")).to include(a_string_including("label"))
      end

      it "returns 422 when total items exceed the maximum of 10" do
        providers = Array.new(11) { account.authentication_providers.create!(auth_type: "saml") }
        over_limit_page = {
          primary: providers.first(6).map { |p| { authentication_provider_id: p.id, label: "Provider" } },
          secondary: providers.last(5).map { |p| { authentication_provider_id: p.id, label: "Provider" } }
        }
        put "/api/v1/discovery_pages", params: { discovery_page: over_limit_page }
        expect(response).to have_http_status(:unprocessable_content)
        json = json_parse(response.body)
        expect(json["errors"].pluck("message"))
          .to include("discovery_page total items cannot exceed 10 (11 given)")
      end

      it "returns 422 when icon is not a valid enum value" do
        invalid_page = {
          primary: [
            { authentication_provider_id: auth_provider.id, label: "Test", icon: "invalid-icon" }
          ],
          secondary: []
        }

        put "/api/v1/discovery_pages", params: { discovery_page: invalid_page }

        expect(response).to have_http_status(:unprocessable_content)
      end

      it "allows icon to be omitted" do
        page_without_icon = {
          primary: [
            { authentication_provider_id: auth_provider.id, label: "Test Provider" }
          ],
          secondary: [
            { authentication_provider_id: secondary_auth_provider.id, label: "Secondary" }
          ]
        }

        put "/api/v1/discovery_pages", params: { discovery_page: page_without_icon }

        expect(response).to have_http_status(:ok)
        json = json_parse(response.body)
        expect(json["discovery_page"]["primary"][0]["label"]).to eq("Test Provider")
        expect(json["discovery_page"]["primary"][0]).not_to have_key("icon")
      end

      it "updates existing discovery_page settings" do
        account.settings[:discovery_page] = { primary: [], secondary: [] }
        account.save!

        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page }

        expect(response).to have_http_status(:ok)
        json = json_parse(response.body)
        expect(json["discovery_page"]["primary"].length).to eq(1)
        expect(json["discovery_page"]["primary"][0]["label"]).to eq("Test Provider")
        account.reload
        expect(account.settings[:discovery_page][:primary].length).to eq(1)
      end

      it "stores active flag when provided as true" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page.merge(active: true) }
        expect(response).to have_http_status(:ok)
        json = json_parse(response.body)
        expect(json["discovery_page"]["active"]).to be true
        account.reload
        expect(account.settings[:discovery_page][:active]).to be true
      end

      it "replaces entire discovery_page on subsequent updates (PUT semantics)" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page.merge(active: true) }
        expect(response).to have_http_status(:ok)
        account.reload
        expect(account.settings[:discovery_page][:primary].length).to eq(1)
        expect(account.settings[:discovery_page][:active]).to be true
        put "/api/v1/discovery_pages", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: secondary_auth_provider.id, label: "NewPrimary" }],
            secondary: []
          }
        }
        expect(response).to have_http_status(:ok)
        account.reload
        expect(account.settings[:discovery_page][:primary].length).to eq(1)
        expect(account.settings[:discovery_page][:primary][0][:label]).to eq("NewPrimary")
        expect(account.settings[:discovery_page][:secondary]).to be_empty
        expect(account.settings[:discovery_page][:active]).to be false
      end

      it "clears primary array when provided empty" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page }
        expect(response).to have_http_status(:ok)
        account.reload
        expect(account.settings[:discovery_page][:primary].length).to eq(1)
        put "/api/v1/discovery_pages", params: {
          discovery_page: {
            primary: [],
            secondary: [{ authentication_provider_id: secondary_auth_provider.id, label: "Secondary" }]
          }
        }
        expect(response).to have_http_status(:ok)
        account.reload
        expect(account.settings[:discovery_page][:primary]).to be_empty
        expect(account.settings[:discovery_page][:secondary].length).to eq(1)
      end

      it "clears secondary array when provided empty" do
        put "/api/v1/discovery_pages", params: { discovery_page: valid_discovery_page }
        expect(response).to have_http_status(:ok)
        account.reload
        expect(account.settings[:discovery_page][:secondary].length).to eq(1)
        put "/api/v1/discovery_pages", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Primary" }],
            secondary: []
          }
        }
        expect(response).to have_http_status(:ok)
        account.reload
        expect(account.settings[:discovery_page][:primary].length).to eq(1)
        expect(account.settings[:discovery_page][:primary][0][:authentication_provider_id]).to eq(auth_provider.id.to_s)
        expect(account.settings[:discovery_page][:primary][0][:label]).to eq("Primary")
        expect(account.settings[:discovery_page][:secondary]).to be_empty
      end

      context "with invalid authentication providers" do
        it "returns 422 when authentication_provider_id does not exist" do
          invalid_page = {
            primary: [
              { authentication_provider_id: 999_999, label: "Test" }
            ],
            secondary: []
          }

          put "/api/v1/discovery_pages", params: { discovery_page: invalid_page }

          expect(response).to have_http_status(:unprocessable_content)
          json = json_parse(response.body)

          expect(json["errors"].pluck("message")).to include(a_string_including("authentication_provider_id is invalid or inactive"))
        end

        it "returns 422 when authentication_provider is soft deleted" do
          deleted_provider = account.authentication_providers.create!(auth_type: "ldap")
          deleted_provider.destroy

          invalid_page = {
            primary: [
              { authentication_provider_id: deleted_provider.id, label: "Test" }
            ],
            secondary: []
          }

          put "/api/v1/discovery_pages", params: { discovery_page: invalid_page }

          expect(response).to have_http_status(:unprocessable_content)
          json = json_parse(response.body)
          expect(json["errors"].pluck("message")).to include(a_string_including("authentication_provider_id is invalid or inactive"))
        end
      end
    end
  end

  describe "GET 'show'" do
    context "when not logged in" do
      it "returns unauthorized" do
        get "/api/v1/discovery_pages"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when logged in without permission" do
      before do
        user_factory(active_all: true)
        user_session(@user)
      end

      it "returns forbidden" do
        get "/api/v1/discovery_pages"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when logged in with permission" do
      before do
        account_admin_user(account:, active_all: true)
        user_session(@admin)
      end

      context "when discovery_page is configured" do
        let!(:auth_provider) { account.authentication_providers.create!(auth_type: "saml") }

        before do
          account.settings[:discovery_page] = {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Test" }],
            secondary: []
          }
          account.save!
        end

        it "returns configured discovery_page with active defaulted to false" do
          get "/api/v1/discovery_pages"

          expect(response).to have_http_status(:ok)
          json = json_parse(response.body)
          expect(json["discovery_page"]["primary"].length).to eq(1)
          expect(json["discovery_page"]["primary"][0]["label"]).to eq("Test")
          expect(json["discovery_page"]["secondary"].length).to eq(0)
          expect(json["discovery_page"]["active"]).to be false
        end

        it "returns active flag when set to true" do
          account.settings[:discovery_page][:active] = true
          account.save!
          get "/api/v1/discovery_pages"
          expect(response).to have_http_status(:ok)
          json = json_parse(response.body)
          expect(json["discovery_page"]["active"]).to be true
        end

        it "returns active flag when set to false" do
          account.settings[:discovery_page][:active] = false
          account.save!
          get "/api/v1/discovery_pages"
          expect(response).to have_http_status(:ok)
          json = json_parse(response.body)
          expect(json["discovery_page"]["active"]).to be false
        end
      end

      context "when discovery_page is not configured" do
        it "returns discovery_page with defaults for all fields" do
          get "/api/v1/discovery_pages"

          expect(response).to have_http_status(:ok)
          json = json_parse(response.body)
          expect(json["discovery_page"]).to eq({ "primary" => [], "secondary" => [], "active" => false })
        end
      end

      context "when discovery_page has more than 10 items (legacy over-limit config)" do
        it "returns the full config without error so the admin can reduce it" do
          providers = Array.new(11) { account.authentication_providers.create!(auth_type: "saml") }
          account.settings[:discovery_page] = {
            primary: providers.map { |p| { authentication_provider_id: p.id, label: "Provider" } },
            secondary: []
          }
          account.save(validate: false)
          get "/api/v1/discovery_pages"
          expect(response).to have_http_status(:ok)
          json = json_parse(response.body)
          expect(json["discovery_page"]["primary"].length).to eq(11)
          expect(json["discovery_page"]["primary"][0]["label"]).to eq("Provider")
          expect(json["discovery_page"]["secondary"]).to eq([])
          expect(json["discovery_page"]["active"]).to be false
        end
      end
    end
  end

  describe "POST 'token'" do
    let(:past_key) { CanvasSecurity::KeyStorage.new_key }
    let(:present_key) { CanvasSecurity::KeyStorage.new_key }
    let(:future_key) { CanvasSecurity::KeyStorage.new_key }

    context "when not logged in" do
      it "returns unauthorized" do
        post "/api/v1/discovery_pages/token"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "when logged in without permission" do
      before do
        user_factory(active_all: true)
        user_session(@user)
      end

      it "returns forbidden" do
        post "/api/v1/discovery_pages/token"
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when logged in with permission" do
      let(:auth_provider) { account.authentication_providers.create!(auth_type: "saml") }
      let(:secondary_auth_provider) { account.authentication_providers.create!(auth_type: "cas") }

      before do
        DynamicSettings.fallback_data = {
          "store" => {
            "canvas" => {
              "services-jwt" => {
                CanvasSecurity::KeyStorage::PAST => past_key,
                CanvasSecurity::KeyStorage::PRESENT => present_key,
                CanvasSecurity::KeyStorage::FUTURE => future_key
              }
            }
          }
        }
        account_admin_user(account:, active_all: true)
        user_session(@admin)
      end

      after do
        DynamicSettings.fallback_data = nil
      end

      it "returns a JWT token" do
        post "/api/v1/discovery_pages/token", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Students", icon: "google" }],
            secondary: []
          }
        }
        expect(response).to have_http_status(:ok)
        json = json_parse(response.body)
        decoded = CanvasSecurity.decode_jwt(json["token"], [CanvasSecurity::ServicesJwt::KeyStorage.present_key])
        expect(decoded["scope"]).to eq("discovery.preview")
      end

      it "returns a valid RS256-signed JWT" do
        post "/api/v1/discovery_pages/token", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Students" }],
            secondary: []
          }
        }
        token = json_parse(response.body)["token"]
        decoded = CanvasSecurity.decode_jwt(token, [CanvasSecurity::ServicesJwt::KeyStorage.present_key])
        expect(decoded["sub"]).to eq(@admin.global_id.to_s)
      end

      it "includes all required claims" do
        post "/api/v1/discovery_pages/token", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Students", icon: "google" }],
            secondary: [{ authentication_provider_id: secondary_auth_provider.id, label: "Admins" }]
          }
        }
        token = json_parse(response.body)["token"]
        decoded = CanvasSecurity.decode_jwt(token, [CanvasSecurity::ServicesJwt::KeyStorage.present_key])
        expect(decoded["sub"]).to eq(@admin.global_id.to_s)
        # The 5-second buffer guards against clock skew between the moment the JWT is issued
        # (inside the controller during the request) and the moment Time.now is evaluated
        # in the test assertion — they're two separate calls to the system clock,
        # so even on a fast machine there's a non-zero gap. In CI, that gap can widen under load (GC pauses, process scheduling, slow Docker
        # I/O).
        expect(decoded["iat"]).to be_within(5).of(Time.now.utc.to_i)
        expect(decoded["exp"]).to eql(decoded["iat"] + 30)
        expect(decoded["org"]).to eq(account.uuid)
        expect(decoded["scope"]).to eq("discovery.preview")
        expect(decoded["primary"].length).to eq(1)
        expect(decoded["primary"].first).to include("label" => "Students", "icon" => "google")
        expect(decoded["secondary"].length).to eq(1)
        expect(decoded["secondary"].first).to include("label" => "Admins")
      end

      it "serializes button links in identity service format" do
        post "/api/v1/discovery_pages/token", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Students", icon: "google" }],
            secondary: []
          }
        }
        token = json_parse(response.body)["token"]
        decoded = CanvasSecurity.decode_jwt(token, [CanvasSecurity::ServicesJwt::KeyStorage.present_key])
        link = decoded["primary"].first
        expect(link["label"]).to eq("Students")
        expect(link["icon"]).to eq("google")
        expect(link["path"]).to eq("/login/saml/#{auth_provider.id}")
      end

      it "omits entries for non-existent providers" do
        post "/api/v1/discovery_pages/token", params: {
          discovery_page: {
            primary: [
              { authentication_provider_id: auth_provider.id, label: "Valid" },
              { authentication_provider_id: 999_999, label: "Invalid" }
            ],
            secondary: []
          }
        }
        token = json_parse(response.body)["token"]
        decoded = CanvasSecurity.decode_jwt(token, [CanvasSecurity::ServicesJwt::KeyStorage.present_key])
        expect(decoded["primary"].length).to eq(1)
        expect(decoded["primary"].first["label"]).to eq("Valid")
      end

      it "returns 400 when no body is provided" do
        post "/api/v1/discovery_pages/token"
        expect(response).to have_http_status(:bad_request)
      end

      it "sanitizes HTML from labels before including them in the JWT" do
        post "/api/v1/discovery_pages/token", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "<script>alert('xss')</script>Students" }],
            secondary: []
          }
        }
        token = json_parse(response.body)["token"]
        decoded = CanvasSecurity.decode_jwt(token, [CanvasSecurity::ServicesJwt::KeyStorage.present_key])
        expect(decoded["primary"].first["label"]).to eq("Students")
      end
    end
  end

  describe "manage vs. read authentication_provider permissions" do
    let!(:auth_provider) { account.authentication_providers.create!(auth_type: "saml") }

    before { Account.site_admin.enable_feature!(:granular_authentication_provider_permissions) }

    def session_as_admin_with(role_changes)
      role = custom_account_role("CustomAdmin", account:)
      user = account_admin_user_with_role_changes(account:, role:, role_changes:)
      user_session(user, pseudonym(user, account:))
      user
    end

    describe "GET #show" do
      it "succeeds with read_authentication_provider only" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        get "/api/v1/discovery_pages"
        expect(response).to have_http_status(:ok)
      end

      it "is forbidden without either permission" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: false)
        get "/api/v1/discovery_pages"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "PUT #upsert" do
      it "is forbidden with only read_authentication_provider" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        put "/api/v1/discovery_pages", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Test" }],
            secondary: []
          }
        }
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "POST #token" do
      it "is forbidden with only read_authentication_provider" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        post "/api/v1/discovery_pages/token", params: {
          discovery_page: {
            primary: [{ authentication_provider_id: auth_provider.id, label: "Test" }],
            secondary: []
          }
        }
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when granular_authentication_provider_permissions is disabled" do
      before { Account.site_admin.disable_feature!(:granular_authentication_provider_permissions) }

      it "permits show when only manage_account_settings is granted" do
        session_as_admin_with(manage_authentication_provider: false,
                              read_authentication_provider: false,
                              manage_account_settings: true)
        get "/api/v1/discovery_pages"
        expect(response).to have_http_status(:ok)
      end

      it "denies show when only the new perms are granted" do
        session_as_admin_with(manage_authentication_provider: true,
                              read_authentication_provider: true)
        get "/api/v1/discovery_pages"
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end

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

describe "AuthenticationProviders" do
  let!(:account) { Account.create! }

  let_once(:saml_hash) do
    {
      "auth_type" => "saml",
      "idp_entity_id" => "http://example.com/saml1",
      "log_in_url" => "http://example.com/saml1/sli",
      "log_out_url" => "http://example.com/saml1/slo",
      "certificate_fingerprint" => "111222",
      "identifier_format" => "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    }
  end
  let_once(:cas_hash) { { "auth_type" => "cas", "auth_base" => "127.0.0.1" } }
  let_once(:ldap_hash) do
    {
      "auth_type" => "ldap",
      "auth_host" => "127.0.0.1",
      "auth_filter" => "filter1",
      "auth_username" => "username1",
      "auth_password" => "password1"
    }
  end
  let_once(:microsoft_hash) { { "auth_type" => "microsoft" } }

  before do
    admin = account_admin_user(account:)
    user_session(admin, pseudonym(admin, account:))
  end

  describe "GET #index" do
    context "with no aacs" do
      it "renders ok" do
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
      end
    end

    context "with an AAC" do
      it "renders ok" do
        account.authentication_providers.create!(saml_hash)
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
      end
    end

    context "with a Microsoft AAC" do
      it "renders ok" do
        account.authentication_providers.create!(**microsoft_hash, tenant: "common")
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
      end
    end

    context "when new_login_ui_identity_discovery_page feature flag is enabled" do
      before do
        Account.site_admin.enable_feature!(:new_login_ui_identity_discovery_page)
      end

      it "includes auth_providers in js_env with id, url, and name" do
        saml = account.authentication_providers.create!(saml_hash)
        cas = account.authentication_providers.create!(cas_hash)
        canvas = account.authentication_providers.find_by(auth_type: "canvas")
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        expect(js_env).to include("auth_providers" => be_an(Array))
        auth_providers = js_env["auth_providers"]
        expect(auth_providers).not_to be_empty
        expect(auth_providers.map { |ap| ap["id"].to_i }).to match_array([saml.id, cas.id, canvas.id])
        saml_provider = auth_providers.find { |ap| ap["auth_type"] == "saml" }
        cas_provider = auth_providers.find { |ap| ap["auth_type"] == "cas" }
        expect(saml_provider).to include("id", "url" => be_a(String), "auth_type" => "saml")
        expect(cas_provider).to include("id", "url" => be_a(String), "auth_type" => "cas")
      end

      it "includes discovery_page_url in js_env" do
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        expect(js_env["discovery_page_url"]).to eq(account.discovery_page_url)
      end
    end

    context "when new_login_ui_identity_discovery_page feature flag is disabled" do
      before do
        Account.site_admin.disable_feature!(:new_login_ui_identity_discovery_page)
      end

      it "does not include auth_providers in js_env" do
        account.authentication_providers.create!(saml_hash)
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
        js_env = js_env_from_response(response)
        expect(js_env).not_to have_key("auth_providers")
      end
    end
  end

  describe "refresh_saml_metadata" do
    it "requires root manage account settings permission" do
      user = user_with_pseudonym(account:)
      user_session(user, user.pseudonyms.first)
      provider = account.authentication_providers.create!(saml_hash)
      get "/accounts/#{account.id}/authentication_providers/#{provider.id}/refresh_metadata"
      expect(response).to have_http_status :unauthorized
    end

    it "renders not_found if provider doesn't exist" do
      provider = account.authentication_providers.create!(saml_hash)
      get "/accounts/#{account.id}/authentication_providers/#{provider.id + 1}/refresh_metadata"
      expect(response).to have_http_status :not_found
      get "/accounts/#{account.id}/authentication_providers/#{provider.id + 1}/refresh_metadata.json"
      expect(response).to have_http_status :not_found
    end

    it "errors on unsupported auth type" do
      provider = account.authentication_providers.create!(**microsoft_hash, tenant: "common")
      get "/accounts/#{account.id}/authentication_providers/#{provider.id}/refresh_metadata"
      expect(flash[:error]).to include("Unsupported authentication type")
      expect(response).to have_http_status(:found)
      get "/accounts/#{account.id}/authentication_providers/#{provider.id}/refresh_metadata.json"
      expect(response).to have_http_status :bad_request
      expect(response.parsed_body["errors"]).to eq(["Unsupported authentication type"])
    end

    it "errors on empty metadata_uri field" do
      provider = account.authentication_providers.create!(saml_hash)
      get "/accounts/#{account.id}/authentication_providers/#{provider.id}/refresh_metadata"
      expect(flash[:error]).to include("IdP metadata URI cannot be blank")
      expect(response).to have_http_status(:found)
      get "/accounts/#{account.id}/authentication_providers/#{provider.id}/refresh_metadata.json"
      expect(response).to have_http_status :bad_request
      expect(response.parsed_body["errors"]).to eq(["A valid metadata URI is required"])
    end

    it "calls the metadata refresher" do
      allow_any_instance_of(AuthenticationProvider::SAML).to receive(:download_metadata).and_return("metadata")
      provider = account.authentication_providers.create!(saml_hash.merge(metadata_uri: "http://example.com/metadata"))
      expect(AuthenticationProvider::SAML::MetadataRefresher).to receive(:refresh_providers).twice.with(providers: [provider])
      get "/accounts/#{account.id}/authentication_providers/#{provider.id}/refresh_metadata"
      expect(flash[:notice]).to match("Metadata refresh has been initiated. Please check back")
      expect(response).to be_redirect
      get "/accounts/#{account.id}/authentication_providers/#{provider.id}/refresh_metadata.json"
      expect(response).to have_http_status :ok
    end
  end

  describe "start_debugging" do
    it "complains about unsupported auth type" do
      enable_cache do
        put "/accounts/#{account.id}/authentication_providers/#{account.canvas_authentication_provider.id}/debugging.json"
        expect(response).to have_http_status :bad_request
        expect(response.body).to match("Unsupported authentication type")
        expect(account.canvas_authentication_provider).not_to be_debugging
      end
    end

    it "works for supported auth type" do
      enable_cache do
        provider = account.authentication_providers.create!(auth_type: "saml")
        put "/accounts/#{account.id}/authentication_providers/#{provider.id}/debugging.json"
        expect(response).to have_http_status(:ok)
        expect(provider).to be_debugging
      end
    end
  end

  describe "POST #create" do
    let(:idp_xml) do
      <<~XML
        <?xml version="1.0"?>
        <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" entityID="https://sso.school.edu/idp/shibboleth">
          <IDPSSODescriptor protocolSupportEnumeration="urn:mace:shibboleth:1.0 urn:oasis:names:tc:SAML:1.1:protocol urn:oasis:names:tc:SAML:2.0:protocol">
            <KeyDescriptor use="signing">
              <ds:KeyInfo>
                <ds:X509Data>
                  <ds:X509Certificate>
                    MIIE8TCCA9mgAwIBAgIJAITusxON60cKMA0GCSqGSIb3DQEBBQUAMIGrMQswCQYD
                    VQQGEwJVUzENMAsGA1UECBMEVXRhaDEXMBUGA1UEBxMOU2FsdCBMYWtlIENpdHkx
                    GTAXBgNVBAoTEEluc3RydWN0dXJlLCBJbmMxEzARBgNVBAsTCk9wZXJhdGlvbnMx
                    IDAeBgNVBAMTF0NhbnZhcyBTQU1MIENlcnRpZmljYXRlMSIwIAYJKoZIhvcNAQkB
                    FhNvcHNAaW5zdHJ1Y3R1cmUuY29tMB4XDTEzMDQyMjE3NDQ0M1oXDTE1MDQyMjE3
                    NDQ0M1owgasxCzAJBgNVBAYTAlVTMQ0wCwYDVQQIEwRVdGFoMRcwFQYDVQQHEw5T
                    YWx0IExha2UgQ2l0eTEZMBcGA1UEChMQSW5zdHJ1Y3R1cmUsIEluYzETMBEGA1UE
                    CxMKT3BlcmF0aW9uczEgMB4GA1UEAxMXQ2FudmFzIFNBTUwgQ2VydGlmaWNhdGUx
                    IjAgBgkqhkiG9w0BCQEWE29wc0BpbnN0cnVjdHVyZS5jb20wggEiMA0GCSqGSIb3
                    DQEBAQUAA4IBDwAwggEKAoIBAQDHRYRp/slsoqD7iPFo+8UFjqd+LgSQ062x09CG
                    m5uW9smY/x2ig8hxfd05Dtk42wrA9frRh6QiEhtoy8qL/4g/LOmYq5USDdzLXsPF
                    /nqTVPkTOhGcuSpfJbxucRsMfGL6IvrGqLNxpyfroyV1dv9/fim+d6bs7js5k1i5
                    EkKksgVlnnpUpOx5pswWVcZICeIJwTMe1C0KHcpUMycZxMHueJ+Y7tWHtWW+R75T
                    QWdWjL+TevEL57B3cW19+9Sud2Y63DcwP6V0aDrwArxQwmp73uUb5ol6gSSvD+Ol
                    CIsf6S/5gqMdgqxJJsWqzBOTeDsVr8m2Dx3VX7Plho7pk06FAgMBAAGjggEUMIIB
                    EDAdBgNVHQ4EFgQUQy1zIfZP/NZKPYLGugNSjjBnTYgwgeAGA1UdIwSB2DCB1YAU
                    Qy1zIfZP/NZKPYLGugNSjjBnTYihgbGkga4wgasxCzAJBgNVBAYTAlVTMQ0wCwYD
                    VQQIEwRVdGFoMRcwFQYDVQQHEw5TYWx0IExha2UgQ2l0eTEZMBcGA1UEChMQSW5z
                    dHJ1Y3R1cmUsIEluYzETMBEGA1UECxMKT3BlcmF0aW9uczEgMB4GA1UEAxMXQ2Fu
                    dmFzIFNBTUwgQ2VydGlmaWNhdGUxIjAgBgkqhkiG9w0BCQEWE29wc0BpbnN0cnVj
                    dHVyZS5jb22CCQCE7rMTjetHCjAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBBQUA
                    A4IBAQC1dgkv3cT4KRMR42mIKgJRp4Jf7swUrtoAFOdOr1R6fjI/9bFNSVNgauiQ
                    flN6q8QA5B2sbDihiSqAylm9F34hpI3C3PvzSWzuIk+Z2FPHcA05CZtwrUWj1M0c
                    eBXxXragtR7ZYtIbEb0srzBfwoFYvWnLU7tM8t6wM6+1rxvOuQFVCCSXyptsGoBl
                    D9qyzAbyYDgJZYpbTjaA9bqhpkn/9CLN3JhNHLyBVr03fp3hQqNwZ2do9bFZBnW0
                    c5Dx9pbKTvC3TAUb2cwUD69yTYS1oq7//yIC2ha2ouzkV/VpB1fcF5YEj2pc6uaj
                    lOTDX4Eg7OBEkTzU8cX04b15bJfE
                  </ds:X509Certificate>
                </ds:X509Data>
              </ds:KeyInfo>
            </KeyDescriptor>
            <ArtifactResolutionService Binding="urn:oasis:names:tc:SAML:2.0:bindings:SOAP" Location="https://sso.school.edu:8443/idp/profile/SAML2/SOAP/ArtifactResolution" index="1"/>
            <ArtifactResolutionService Binding="urn:oasis:names:tc:SAML:1.0:bindings:SOAP-binding" Location="https://sso.school.edu:8443/idp/profile/SAML1/SOAP/ArtifactResolution" index="2"/>
            <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://sso.school.edu/idp/profile/SAML2/Redirect/SLO"/>
            <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://sso.school.edu/idp/profile/SAML2/POST/SLO"/>
            <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:SOAP" Location="https://sso.school.edu/idp/profile/SAML2/SOAP/SLO"/>
            <SingleSignOnService Binding="urn:mace:shibboleth:1.0:profiles:AuthnRequest" Location="https://sso.school.edu/idp/profile/Shibboleth/SSO"/>
            <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://sso.school.edu/idp/profile/SAML2/POST/SSO"/>
            <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://sso.school.edu/idp/profile/SAML2/Redirect/SSO"/>
          </IDPSSODescriptor>
        </EntityDescriptor>
      XML
    end

    let(:expected_idp_entity_id) { "https://sso.school.edu/idp/shibboleth" }
    let(:expected_log_in_url) { "https://sso.school.edu/idp/profile/SAML2/Redirect/SSO" }
    let(:expected_log_out_url) { "https://sso.school.edu/idp/profile/SAML2/Redirect/SLO" }
    let(:expected_certificate_fingerprint) do
      SAML2::Entity.parse(idp_xml).identity_providers.first.signing_keys.filter_map(&:fingerprint).join(" ")
    end

    it "adds a new auth config successfully" do
      cas = {
        auth_type: "cas",
        auth_base: "http://example.com",
      }
      post "/accounts/#{account.id}/authentication_providers", params: cas

      account.reload
      aac = account.authentication_providers.active.where(auth_type: "cas").first
      expect(aac).to be_present
    end

    it "adds a singleton type successfully" do
      linkedin = {
        auth_type: "linkedin",
        client_id: "1",
        client_secret: "2"
      }
      post "/accounts/#{account.id}/authentication_providers", params: linkedin

      account.reload
      aac = account.authentication_providers.active.where(auth_type: "linkedin").first
      expect(aac).to be_present
    end

    it "rejects a singleton type if it already exists" do
      linkedin = {
        auth_type: "linkedin",
        client_id: "1",
        client_secret: "2"
      }
      account.authentication_providers.create!(linkedin)

      post "/accounts/#{account.id}/authentication_providers.json", params: linkedin
      expect(response).to have_http_status :unprocessable_content
    end

    context "when the auth provider type is restorable" do
      let(:params) do
        {
          auth_type: "linkedin",
          client_id: "test_client_id",
          client_secret: "test_client_secret"
        }
      end

      before do
        allow(AuthenticationProvider::LinkedIn).to receive(:restorable?).and_return(true)
      end

      def do_post
        post "/accounts/#{account.id}/authentication_providers.json", params:
      end

      context "and a deleted authentication provider of the same type exists" do
        let!(:existing_provider) { account.authentication_providers.create!(params.merge(workflow_state: "deleted")) }

        it "is successful" do
          do_post
          expect(response).to have_http_status(:ok)
        end

        it "restores the deleted provider" do
          expect { do_post }.to change { existing_provider.reload.workflow_state }.from("deleted").to("active")
        end

        it "does not create a new provider" do
          expect { do_post }.not_to change { account.authentication_providers.count }
        end
      end

      context "and an active existing provider of the same type exists" do
        before { account.authentication_providers.create!(params.merge(workflow_state: "active")) }

        it "returns unprocessable_content" do
          do_post
          expect(response).to have_http_status :unprocessable_content
        end

        it "indicates an active auth provider of the type already exists" do
          do_post
          expect(json_parse["errors"].first["message"]).to eq "duplicate provider linkedin"
        end
      end

      context "and no existing provider of the same type exists" do
        it "is successful" do
          do_post
          expect(response).to have_http_status(:ok)
        end

        it "creates a new provider" do
          expect { do_post }.to change { account.authentication_providers.count }.by(1)
        end

        it "creates the requested authentication provider" do
          do_post
          expect(AuthenticationProvider.find(json_parse["id"]).auth_type).to eq "linkedin"
        end
      end
    end

    it "allows multiple non-singleton types" do
      cas = {
        auth_type: "cas",
        auth_base: "http://example.com/cas2",
      }
      account.authentication_providers.create!({
                                                 auth_type: "cas",
                                                 auth_base: "http://example.com/cas"
                                               })
      post "/accounts/#{account.id}/authentication_providers", params: cas

      account.reload
      aac_count = account.authentication_providers.active.where(auth_type: "cas").count
      expect(aac_count).to eq 2
    end

    it "allows re-adding a singleton type that was previously deleted" do
      linkedin = {
        auth_type: "linkedin",
        client_id: "1",
        client_secret: "2"
      }
      aac = account.authentication_providers.create!(linkedin)
      aac.destroy

      post "/accounts/#{account.id}/authentication_providers", params: linkedin
      account.reload
      aac = account.authentication_providers.active.where(auth_type: "linkedin").first
      expect(aac&.auth_type).to eq("linkedin")
      expect(aac&.client_id).to eq("1")
    end

    it "populates SAML from metadata" do
      post "/accounts/#{account.id}/authentication_providers", params: { auth_type: "saml", metadata: idp_xml }
      expect(response).to have_http_status(:found)

      ap = account.authentication_providers.active.last
      expect(ap.idp_entity_id).to eq(expected_idp_entity_id)
      expect(ap.log_in_url).to eq(expected_log_in_url)
      expect(ap.log_out_url).to eq(expected_log_out_url)
      expect(ap.certificate_fingerprint).to eq(expected_certificate_fingerprint)
    end

    context "mfa_option into individual fields" do
      before do
        account.settings[:mfa_settings] = :optional
        account.save!
      end

      it "handles required" do
        post "/accounts/#{account.id}/authentication_providers", params: { auth_type: "cas", auth_base: "http://example.com", mfa_option: "required" }
        expect(response).to be_redirect

        ap = account.authentication_providers.active.last
        expect(ap.mfa_required).to be(true)
        expect(ap.skip_internal_mfa).to be(false)
      end

      it "handles bypass" do
        post "/accounts/#{account.id}/authentication_providers", params: { auth_type: "cas", auth_base: "http://example.com", mfa_option: "bypass" }
        expect(response).to be_redirect

        ap = account.authentication_providers.active.last
        expect(ap.mfa_required).to be(false)
        expect(ap.skip_internal_mfa).to be(true)
      end

      it "handles default" do
        post "/accounts/#{account.id}/authentication_providers", params: { auth_type: "cas", auth_base: "http://example.com", mfa_option: "default" }
        expect(response).to have_http_status(:found)

        ap = account.authentication_providers.active.last
        expect(ap.mfa_required).to be(false)
        expect(ap.skip_internal_mfa).to be(false)
      end
    end

    context "manage_mfa_settings permission" do
      before do
        account.settings[:mfa_settings] = :optional
        account.save!
      end

      it "persists MFA fields when user has both permissions" do
        post "/accounts/#{account.id}/authentication_providers",
             params: { auth_type: "cas",
                       auth_base: "http://example.com",
                       mfa_option: "required",
                       otp_via_sms: "0" }
        expect(response).to have_http_status(:found)

        ap = account.authentication_providers.active.last
        expect(ap.mfa_required).to be(true)
        expect(ap.skip_internal_mfa).to be(false)
        expect(ap.settings["otp_via_sms"]).to be(false)
      end

      it "strips MFA fields when user lacks :manage_mfa_settings" do
        account.role_overrides.create!(
          role: admin_role(root_account_id: account.id),
          permission: :manage_mfa_settings,
          enabled: false
        )

        post "/accounts/#{account.id}/authentication_providers",
             params: { auth_type: "cas",
                       auth_base: "http://example.com",
                       mfa_option: "required",
                       mfa_required: "1",
                       skip_internal_mfa: "1",
                       otp_via_sms: "0" }
        expect(response).to have_http_status(:found)

        ap = account.authentication_providers.active.last
        expect(ap.mfa_required).to be(false)
        expect(ap.skip_internal_mfa).to be(false)
        expect(ap.settings).not_to have_key("otp_via_sms")
      end
    end

    it "does not allow non-admins" do
      user = user_with_pseudonym(active_all: true)
      user_session(user, user.pseudonyms.first)
      post "/accounts/#{account.id}/authentication_providers", params: { auth_type: "cas", auth_base: "http://example.com" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "allows admins" do
      user = account_admin_user(account:)
      user_session(user, pseudonym(user, account:))
      post "/accounts/#{account.id}/authentication_providers", params: { auth_type: "cas", auth_base: "http://example.com" }
      expect(response).to have_http_status(:found)
    end
  end

  describe "PUT #update" do
    let!(:auth_provider) { account.authentication_providers.create!(cas_hash) }

    it "does not allow non-admins" do
      user = user_with_pseudonym(active_all: true)
      user_session(user, user.pseudonyms.first)
      put "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}", params: { auth_base: "http://updated.example.com" }
      expect(response).to have_http_status(:unauthorized)
    end

    it "allows admins" do
      user = account_admin_user(account:)
      user_session(user, pseudonym(user, account:))
      put "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}", params: { auth_base: "http://updated.example.com" }
      expect(response).to have_http_status(:found)
    end

    context "manage_mfa_settings permission" do
      before do
        account.settings[:mfa_settings] = :optional
        account.save!
      end

      it "persists MFA fields when user has both permissions" do
        put "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}",
            params: { mfa_option: "required",
                      otp_via_sms: "0" }
        expect(response).to have_http_status(:found)

        auth_provider.reload
        expect(auth_provider.mfa_required).to be(true)
        expect(auth_provider.skip_internal_mfa).to be(false)
        expect(auth_provider.settings["otp_via_sms"]).to be(false)
      end

      it "strips MFA fields when user lacks :manage_mfa_settings" do
        account.role_overrides.create!(
          role: admin_role(root_account_id: account.id),
          permission: :manage_mfa_settings,
          enabled: false
        )

        # Verify pre-request state: auth_provider starts with default MFA settings
        expect(auth_provider.mfa_required).to be(false)
        expect(auth_provider.skip_internal_mfa).to be(false)

        put "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}",
            params: { mfa_option: "required",
                      mfa_required: "1",
                      skip_internal_mfa: "1",
                      otp_via_sms: "0" }
        expect(response).to have_http_status(:found)

        auth_provider.reload
        expect(auth_provider.mfa_required).to be(false)
        expect(auth_provider.skip_internal_mfa).to be(false)
        expect(auth_provider.settings).not_to have_key("otp_via_sms")
      end
    end
  end

  describe "PUT #restore" do
    it "restores a deleted auth config successfully" do
      account.authentication_providers.create!(saml_hash)
      aac = account.authentication_providers.active.find_by(auth_type: "saml")
      aac.destroy

      put "/api/v1/accounts/#{account.id}/authentication_providers/#{aac.id}/restore"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["auth_type"]).to eq("saml")
      expect(aac.reload.workflow_state).to eq("active")
    end
  end

  describe "destroy_all" do
    def do_delete
      delete "/accounts/#{account.id}/authentication_providers"
    end

    context "with multiple authentication providers" do
      before do
        3.times do
          account.authentication_providers.create!(auth_type: "cas", auth_base: "http://example.com/cas")
        end
      end

      it "soft deletes all authentication providers in the account" do
        expect { do_delete }.to change {
          account.authentication_providers.active.count
        }.from(4).to(1)

        # Canvas re-create the Canvas auth provider unless non-Canvas
        # providers are configured
        expect(account.authentication_providers.active.first.auth_type).to eq "canvas"
      end

      context "when the current user root account management permissions" do
        let(:non_admin) { user_with_pseudonym(account:) }

        before { user_session(non_admin, non_admin.pseudonyms.first) }

        it "is unauthorized" do
          do_delete
          expect(response).to have_http_status(:unauthorized)
        end
      end
    end
  end

  describe "POST force_password_reset" do
    def do_post
      post "/api/v1/accounts/#{account.id}/authentication_providers/force_password_reset.json"
    end

    context "when the account has canvas authentication" do
      it "enqueues a job for the operation" do
        expect { do_post }.to change { Delayed::Job.count }.by(1)
        expect(Delayed::Job.last.tag).to include("ForceCanvasPasswordReset")
      end

      it "returns 202 with enqueued status" do
        do_post
        expect(response).to have_http_status(:accepted)
        expect(response.parsed_body["status"]).to eql("enqueued")
      end
    end

    context "when the account does not have canvas authentication" do
      before do
        # A non-canvas provider must exist first so that destroying the canvas
        # AP does not trigger its re-creation via enable_canvas_authentication.
        account.authentication_providers.create!(auth_type: "cas", auth_base: "http://example.com/cas")
        account.authentication_providers.where(auth_type: "canvas").destroy_all
      end

      it "does not enqueue a job" do
        expect { do_post }.not_to change { Delayed::Job.count }
      end

      it "returns 422" do
        do_post
        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "when the current user lacks root account management permissions" do
      let(:non_admin) { user_with_pseudonym(account:) }

      before { user_session(non_admin, non_admin.pseudonyms.first) }

      it "returns forbidden" do
        do_post
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "discovery_page_active SSO setting" do
    before do
      Account.site_admin.enable_feature!(:new_login_ui_identity_discovery_page)
    end

    it "includes discovery_page_active in the sso_settings response when allowed" do
      account.settings[:discovery_page] = { active: true, primary: [], secondary: [] }
      account.save!
      get "/api/v1/accounts/#{account.id}/sso_settings.json"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["sso_settings"]["discovery_page_active"]).to be(true)
    end

    it "does not include discovery_page_active when not allowed" do
      Account.site_admin.disable_feature!(:new_login_ui_identity_discovery_page)
      account.settings[:discovery_page] = { active: true, primary: [], secondary: [] }
      account.save!
      get "/api/v1/accounts/#{account.id}/sso_settings.json"
      expect(response).to have_http_status(:ok)
      json = response.parsed_body
      expect(json["sso_settings"]).not_to have_key("discovery_page_active")
    end

    it "updates discovery_page_active via update_sso_settings when feature flag is enabled" do
      put "/api/v1/accounts/#{account.id}/sso_settings.json", params: {
        sso_settings: { discovery_page_active: true }
      }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["sso_settings"]["discovery_page_active"]).to be(true)
      account.reload
      expect(account.discovery_page_active?).to be(true)
    end

    it "ignores discovery_page_active parameter when not allowed" do
      Account.site_admin.disable_feature!(:new_login_ui_identity_discovery_page)
      put "/api/v1/accounts/#{account.id}/sso_settings.json", params: {
        sso_settings: { discovery_page_active: true }
      }
      expect(response).to have_http_status(:ok)
      account.reload
      expect(account.discovery_page_active?).to be(false)
    end

    it "can disable discovery_page_active when feature flag is enabled" do
      account.settings[:discovery_page] = { active: true, primary: [], secondary: [] }
      account.save!
      put "/api/v1/accounts/#{account.id}/sso_settings.json", params: {
        sso_settings: { discovery_page_active: false }
      }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["sso_settings"]["discovery_page_active"]).to be(false)
      account.reload
      expect(account.discovery_page_active?).to be(false)
    end
  end

  describe "#destroy with validation errors" do
    let(:aac) { account.authentication_providers.create!(auth_type: "saml") }

    before do
      Account.site_admin.enable_feature!(:new_login_ui_identity_discovery_page)
      account.settings[:discovery_page] = {
        active: true,
        primary: [{ authentication_provider_id: aac.id, label: "Test Provider" }],
        secondary: []
      }
      account.save!
    end

    context "HTML format" do
      it "redirects with error flash" do
        delete "/accounts/#{account.id}/authentication_providers/#{aac.id}"

        expect(response).to redirect_to(account_authentication_providers_path(account))
        expect(flash[:error]).to include(match(/remove.*from the discovery page/))
      end
    end

    context "JSON format" do
      it "returns unprocessable_content with error messages" do
        delete "/accounts/#{account.id}/authentication_providers/#{aac.id}.json"

        expect(response).to have_http_status(:unprocessable_content)
        json = response.parsed_body
        expect(json["errors"]).to include(match(/remove.*from the discovery page/))
      end
    end
  end

  describe "elevated auth provider enforcement" do
    let!(:auth_provider) { account.authentication_providers.create!(saml_hash) }
    let(:admin) { account_admin_user(account:) }
    let(:admin_pseudonym) { pseudonym(admin, account:) }

    before do
      user_session(admin, admin_pseudonym)

      account.settings[:elevated_auth_provider_global_id] = auth_provider.global_id
      account.save(validate: false)

      AuthenticationMethods::PseudonymAttributes.reset

      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?).and_return(false)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("log_violations").and_return(true)
      allow(AuthenticationMethods::ElevatedAuthProvider).to receive(:setting_enabled?)
        .with("enforce_violations").and_return(true)
    end

    context "when the request does not satisfy the elevation requirement" do
      it "redirects html requests to root_url with a flash error" do
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to redirect_to(root_url)
        expect(flash[:error][:html]).to include("requires using an elevated authentication provider")
      end

      it "responds 403 unauthorized for json index requests" do
        get "/accounts/#{account.id}/authentication_providers.json"
        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["status"]).to eql "unauthorized"
      end

      it "blocks create and does not persist a new provider" do
        expect do
          post "/accounts/#{account.id}/authentication_providers.json", params: cas_hash
        end.not_to change { account.authentication_providers.active.count }
        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["status"]).to eql "unauthorized"
      end

      it "blocks destroy and leaves the provider active" do
        delete "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["status"]).to eql "unauthorized"
        expect(auth_provider.reload.workflow_state).to eq("active")
      end

      it "blocks show" do
        get "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:forbidden)
        expect(response.parsed_body["status"]).to eql "unauthorized"
      end
    end

    context "when the session uses the elevated auth provider" do
      before do
        allow(AuthenticationMethods::PseudonymAttributes).to receive(:load_auth_provider).and_return(auth_provider)
      end

      it "allows index" do
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
      end

      it "allows create and persists the new provider" do
        expect do
          post "/accounts/#{account.id}/authentication_providers.json", params: cas_hash
        end.to change { account.authentication_providers.active.count }.by(1)
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "manage_authentication_provider / read_authentication_provider permissions" do
    let!(:auth_provider) { account.authentication_providers.create!(saml_hash) }

    before { Account.site_admin.enable_feature!(:granular_authentication_provider_permissions) }

    def session_as_admin_with(role_changes)
      role = custom_account_role("CustomAdmin", account:)
      user = account_admin_user_with_role_changes(account:, role:, role_changes:)
      user_session(user, pseudonym(user, account:))
      user
    end

    describe "GET #show" do
      it "succeeds with manage_authentication_provider" do
        # default account admin has manage_authentication_provider
        get "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:ok)
      end

      it "succeeds with read_authentication_provider only" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        get "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:ok)
      end

      it "is forbidden without either permission" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: false)
        get "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "GET #index" do
      it "succeeds with manage_authentication_provider" do
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
      end

      it "succeeds with read_authentication_provider only" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        get "/accounts/#{account.id}/authentication_providers"
        expect(response).to have_http_status(:ok)
      end

      it "is forbidden without either permission" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: false)
        get "/accounts/#{account.id}/authentication_providers.json"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "GET #show_sso_settings" do
      it "succeeds with manage_authentication_provider" do
        get "/api/v1/accounts/#{account.id}/sso_settings.json"
        expect(response).to have_http_status(:ok)
      end

      it "succeeds with read_authentication_provider only" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        get "/api/v1/accounts/#{account.id}/sso_settings.json"
        expect(response).to have_http_status(:ok)
      end

      it "is forbidden without either permission" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: false)
        get "/api/v1/accounts/#{account.id}/sso_settings.json"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "POST #create" do
      it "is forbidden with only read_authentication_provider" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        post "/accounts/#{account.id}/authentication_providers.json", params: cas_hash
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "PUT #update" do
      it "is forbidden with only read_authentication_provider" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        put "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json", params: { idp_entity_id: "x" }
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "DELETE #destroy" do
      it "is forbidden with only read_authentication_provider" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        delete "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:forbidden)
      end
    end

    describe "PUT #update_sso_settings" do
      it "is forbidden with only read_authentication_provider" do
        session_as_admin_with(manage_authentication_provider: false, read_authentication_provider: true)
        put "/api/v1/accounts/#{account.id}/sso_settings.json", params: { account: { settings: { login_handle_name: "Login" } } }
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when granular_authentication_provider_permissions is disabled" do
      before { Account.site_admin.disable_feature!(:granular_authentication_provider_permissions) }

      it "permits access when only manage_account_settings is granted, regardless of new perms" do
        session_as_admin_with(manage_authentication_provider: false,
                              read_authentication_provider: false,
                              manage_account_settings: true)
        get "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:ok)
      end

      it "permits writes when only manage_account_settings is granted" do
        session_as_admin_with(manage_authentication_provider: false,
                              read_authentication_provider: false,
                              manage_account_settings: true)
        put "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json", params: { idp_entity_id: "x" }
        expect(response).to have_http_status(:ok)
      end

      it "denies access when only the new perms are granted (FF lockdown overrides them)" do
        user = session_as_admin_with(manage_authentication_provider: true,
                                     read_authentication_provider: true)

        expect(account.grants_right?(user, :manage_account_settings)).to be false
        expect(account.grants_right?(user, :manage_authentication_provider)).to be false
        expect(account.grants_right?(user, :read_authentication_provider)).to be false

        get "/accounts/#{account.id}/authentication_providers/#{auth_provider.id}.json"
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end

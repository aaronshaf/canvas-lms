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

describe Canvas::OAuth::ClientCredentials::ServiceUser::AsymmetricProvider do
  include_context "InstAccess setup"

  let(:service_user) { user_model }
  let(:root_account) { account_model }
  let(:alg) { :RS256 }
  let(:aud) { Rails.application.routes.url_helpers.oauth2_token_url }
  let(:iat) { 1.minute.ago.to_i }
  let(:exp) { 10.minutes.from_now.to_i }
  let(:rsa_key_pair) { CanvasSecurity::RSAKeyPair.new }
  let(:signing_key) { JSON::JWK.new(rsa_key_pair.to_jwk) }
  let(:dev_key) do
    DeveloperKey.create!(
      service_user:,
      public_jwk: rsa_key_pair.public_jwk,
      authorized_flows: ["service_user_client_credentials"]
    )
  end
  let(:jwt) do
    {
      iss: "the-client",
      sub: dev_key.id,
      aud:,
      iat:,
      exp:,
      jti: SecureRandom.uuid
    }
  end
  let(:jws) { JSON::JWT.new(jwt).sign(signing_key, alg).to_s }
  let(:provider) { described_class.new(jws, "example.com", root_account:) }

  before do
    allow(Rails.application.routes).to receive(:default_url_options).and_return({ host: "example.com" })
  end

  describe "#valid?" do
    subject { provider.valid? }

    it { is_expected.to be true }

    context "with bad aud (LTI OIDC auth_domain)" do
      let(:aud) { Lti::Oidc.auth_domain("example.com") }

      it "rejects audiences that the LTI flow would accept" do
        expect(subject).to be false
      end
    end

    context "with bad signing key" do
      let(:signing_key) { JSON::JWK.new(CanvasSecurity::RSAKeyPair.new.to_jwk) }

      it { is_expected.to be false }
    end

    context "when the key is not enabled for service authentication" do
      before { dev_key.update!(authorized_flows: []) }

      it { is_expected.to be false }

      it "reports a clear error" do
        subject
        expect(provider.error_message).to eq("Service authentication not enabled for this key")
      end
    end

    context "when the service user is deleted" do
      before { service_user.destroy! }

      it { is_expected.to be false }

      it "reports a clear error" do
        subject
        expect(provider.error_message).to eq("No active service user")
      end
    end

    context "when the service user is suspended" do
      before { allow_any_instance_of(User).to receive(:suspended?).and_return(true) }

      it { is_expected.to be false }

      it "reports a clear error" do
        subject
        expect(provider.error_message).to eq("No active service user")
      end
    end

    context "when the developer key is inactive" do
      before { dev_key.deactivate! }

      it { is_expected.to be false }

      it "reports the same error a missing key would" do
        subject
        expect(provider.error_message).to eq("Unknown client_id")
      end
    end

    context "via public_jwk_url" do
      let(:url) { "https://get.public.jwk" }
      let(:jwk_response_body) { { keys: [rsa_key_pair.public_jwk] }.to_json }
      let(:stubbed_response) { instance_double(Net::HTTPOK, body: jwk_response_body) }

      before do
        dev_key.update!(public_jwk: nil, public_jwk_url: url)
        expect(CanvasHttp).to receive(:get).with(url).and_return(stubbed_response)
      end

      it { is_expected.to be true }
    end
  end

  describe "#valid_scopes?" do
    subject { provider.valid_scopes? }

    it "returns true when no scopes are requested, even when require_scopes is enabled" do
      # Service-user access is granted by the service_user association, not by OAuth scopes.
      dev_key.update!(require_scopes: true)
      expect(subject).to be true
    end

    context "when scopes are requested and all are granted" do
      let(:provider) { described_class.new(jws, "example.com", scopes: [dev_key.scopes.first], root_account:) }

      before { dev_key.update!(scopes: [TokenScopes::USER_INFO_SCOPE[:scope]]) }

      it { is_expected.to be true }
    end

    context "when scopes are requested but not all are granted" do
      let(:provider) { described_class.new(jws, "example.com", scopes: ["https://unknown.scope/"], root_account:) }

      it { is_expected.to be false }
    end
  end

  describe "#generate_token" do
    subject { provider.generate_token }

    it "issues an InstAccess token for the configured service user" do
      token = AuthenticationMethods::InstAccessToken.parse(subject[:access_token])
      expect(token.user_uuid).to eql service_user.uuid
    end

    it "expires in approximately one hour" do
      token = AuthenticationMethods::InstAccessToken.parse(subject[:access_token])
      expect(Time.zone.at(token.jwt_payload[:exp])).to be_within(30.seconds).of(1.hour.from_now)
    end

    it "does not return a plain Canvas OAuth access token" do
      expect(subject).not_to have_key(:scope)
      expect(subject[:token_type]).to eql "Bearer"
    end
  end
end

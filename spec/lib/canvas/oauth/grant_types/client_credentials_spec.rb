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

describe Canvas::OAuth::GrantTypes::ClientCredentials do
  let(:host) { "example.com" }
  let(:protocol) { "http://" }
  let(:root_account) { account_model }
  let(:rsa_key_pair) { CanvasSecurity::RSAKeyPair.new }
  let(:signing_key) { JSON::JWK.new(rsa_key_pair.to_jwk) }
  let(:dev_key) do
    DeveloperKey.create!(
      public_jwk: rsa_key_pair.public_jwk,
      service_user: user_model,
      authorized_flows: ["service_user_client_credentials"]
    )
  end
  let(:jwt_payload) do
    {
      iss: "the-client",
      sub: dev_key.id,
      aud: Rails.application.routes.url_helpers.oauth2_token_url(host:, protocol:),
      iat: 1.minute.ago.to_i,
      exp: 10.minutes.from_now.to_i,
      jti: SecureRandom.uuid
    }
  end
  let(:jws) { JSON::JWT.new(jwt_payload).sign(signing_key, :RS256).to_s }

  describe "#initialize provider dispatch" do
    subject(:dispatcher) do
      described_class.new(
        {
          client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: jws
        },
        root_account,
        host:,
        protocol:
      )
    end

    context "when the JWT sub matches a service-user key" do
      it "routes to ClientCredentials::ServiceUser::AsymmetricProvider" do
        expect(dispatcher.provider).to be_a(Canvas::OAuth::ClientCredentials::ServiceUser::AsymmetricProvider)
      end
    end

    context "when the key has no service user" do
      before { dev_key.update!(service_user: nil) }

      it "falls back to AsymmetricProvider" do
        expect(dispatcher.provider).to be_a(Canvas::OAuth::ClientCredentials::AsymmetricProvider)
        expect(dispatcher.provider).not_to be_a(Canvas::OAuth::ClientCredentials::ServiceUser::AsymmetricProvider)
      end
    end

    context "when the key has not opted into the service-user flow" do
      before { dev_key.update!(authorized_flows: []) }

      it "falls back to AsymmetricProvider" do
        expect(dispatcher.provider).to be_a(Canvas::OAuth::ClientCredentials::AsymmetricProvider)
        expect(dispatcher.provider).not_to be_a(Canvas::OAuth::ClientCredentials::ServiceUser::AsymmetricProvider)
      end
    end

    context "when the JWT is malformed" do
      let(:jws) { "not-a-jwt" }

      it "routes to AsymmetricProvider and produces an invalid provider" do
        # client_id_from_assertion swallows JSON::JWT errors and returns nil,
        # so the service-user branch is skipped. ClientAssertion#valid? also
        # catches the parse error internally, so no exception propagates.
        expect(dispatcher.provider).to be_a(Canvas::OAuth::ClientCredentials::AsymmetricProvider)
        expect(dispatcher.provider.valid?).to be false
      end
    end

    context "when the client_assertion param is missing" do
      let(:jws) { nil }

      it "does not raise and produces an invalid provider" do
        # A nil assertion must not blow up JSON::JWT.decode (NoMethodError ->
        # HTTP 500); it should surface as a clean invalid provider instead.
        expect { dispatcher.provider }.not_to raise_error
        expect(dispatcher.provider.valid?).to be false
      end
    end

    context "when the public_jwk_url fetch fails at the network layer" do
      before do
        dev_key.update!(public_jwk: nil, public_jwk_url: "https://example.com/jwks")
        allow(CanvasHttp).to receive(:get).and_raise(SocketError, "getaddrinfo failed")
      end

      it "does not raise and produces an invalid provider" do
        # Network errors CanvasHttp leaves unwrapped (SocketError, SSL, timeout)
        # must not escape to an HTTP 500; verification should just fail.
        expect { dispatcher.provider }.not_to raise_error
        expect(dispatcher.provider.valid?).to be false
      end
    end

    context "when a captured assertion is replayed (same jti)" do
      let(:jwt_payload) do
        {
          iss: "the-client",
          sub: dev_key.id,
          aud: Rails.application.routes.url_helpers.oauth2_token_url(host:, protocol:),
          iat: 1.minute.ago.to_i,
          exp: 10.minutes.from_now.to_i,
          jti: "fixed-jti-#{SecureRandom.uuid}"
        }
      end

      it "rejects the second use (jti replay protection)" do
        enable_cache do
          first = dispatcher.provider
          expect(first.valid?).to be true

          replay = described_class.new(
            {
              client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
              client_assertion: jws
            },
            root_account,
            host:,
            protocol:
          ).provider
          expect(replay.valid?).to be false
        end
      end
    end
  end
end

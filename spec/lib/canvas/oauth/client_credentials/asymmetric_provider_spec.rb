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

describe Canvas::OAuth::ClientCredentials::AsymmetricProvider do
  let(:host) { "canvas.instructure.com" }
  let(:root_account) { account_model }
  let(:rsa_key_pair) { CanvasSecurity::RSAKeyPair.new }
  let(:signing_key) { JSON::JWK.new(rsa_key_pair.to_jwk) }
  let(:dev_key) { DeveloperKey.create!(public_jwk: rsa_key_pair.public_jwk, client_credentials_audience: "external") }
  let(:aud) { Rails.application.routes.url_helpers.oauth2_token_url }
  let(:jwt) do
    {
      iss: "the-client",
      sub: dev_key.id,
      aud:,
      iat: 1.minute.ago.to_i,
      exp: 10.minutes.from_now.to_i,
      jti: SecureRandom.uuid
    }
  end
  let(:jws) { JSON::JWT.new(jwt).sign(signing_key, :RS256).to_s }
  let(:provider) { described_class.new(jws, host, root_account:) }

  before do
    allow(Rails.application.routes).to receive(:default_url_options).and_return({ host: })
  end

  describe "#valid?" do
    subject { provider.valid? }

    it { is_expected.to be true }

    it "delegates audience building to VanityAudience" do
      expect_any_instance_of(described_class).to receive(:build_expected_aud).and_call_original
      provider
    end

    context "with bad aud" do
      let(:aud) { "https://unknown.example.com/login/oauth2/token" }

      it { is_expected.to be false }
    end

    context "with bad signing key" do
      let(:signing_key) { JSON::JWK.new(CanvasSecurity::RSAKeyPair.new.to_jwk) }

      it { is_expected.to be false }
    end

    context "jti replay protection" do
      it "rejects the same JWT twice" do
        enable_cache do
          provider.valid?
          replay = described_class.new(jws, host, root_account:)
          expect(replay.valid?).to be false
        end
      end
    end
  end

  describe "#assertion_method_permitted?" do
    subject { provider.assertion_method_permitted? }

    before { dev_key }

    it { is_expected.to be true }

    context "when the key is not external" do
      before { dev_key.update!(client_credentials_audience: nil) }

      it { is_expected.to be false }
    end
  end
end

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

describe Canvas::OAuth::ClientCredentials::LtiAdvantage::Provider do
  let(:provider) { described_class.new jws, "example.com" }
  let(:aud) { Rails.application.routes.url_helpers.oauth2_token_url }
  let(:rsa_key_pair) { CanvasSecurity::RSAKeyPair.new }
  let(:signing_key) { JSON::JWK.new(rsa_key_pair.to_jwk) }
  let(:jwt) do
    {
      iss: "someiss",
      sub: dev_key.id,
      aud:,
      iat: 1.minute.ago.to_i,
      exp: 10.minutes.from_now.to_i,
      jti: SecureRandom.uuid
    }
  end
  let(:alg) { :RS256 }
  let(:jws) { JSON::JWT.new(jwt).sign(signing_key, alg).to_s }
  let(:dev_key) { DeveloperKey.create! public_jwk: rsa_key_pair.public_jwk }

  before do
    allow(Rails.application.routes).to receive(:default_url_options).and_return({ host: "example.com" })
  end

  describe "using public jwk url" do
    subject { provider.valid? }

    let(:url) { "https://get.public.jwk" }
    let(:public_jwk_url_response) { { keys: [rsa_key_pair.public_jwk] }.to_json }
    let(:stubbed_response) { instance_double(Net::HTTPOK, { body: public_jwk_url_response }) }

    context "when there is no public jwk" do
      before { dev_key.update!(public_jwk: nil, public_jwk_url: url) }

      it do
        expect(CanvasHttp).to receive(:get).with(url).and_return(stubbed_response)
        expect(subject).to be true
      end
    end

    context "when there is a public jwk" do
      before { dev_key.update!(public_jwk_url: url) }

      it do
        expect(CanvasHttp).to receive(:get).with(url).and_return(stubbed_response)
        expect(subject).to be true
      end
    end

    context "when an empty object is returned" do
      let(:public_jwk_url_response) { {}.to_json }

      before { dev_key.update!(public_jwk_url: url) }

      it do
        expect(CanvasHttp).to receive(:get).with(url).and_return(stubbed_response)
        expect(subject).to be false
      end
    end

    context "when invalid json is returned" do
      let(:public_jwk_url_response) { "<html></html>" }

      before { dev_key.update!(public_jwk_url: url) }

      it "returns false and sets a JWK error message" do
        expect(CanvasHttp).to receive(:get).with(url).and_return(stubbed_response)
        expect(subject).to be false
        expect(provider.error_message).to eq("JWK Error: Invalid JSON")
      end
    end

    context "when the url returns a 404" do
      let(:stubbed_response) { instance_double(Net::HTTPNotFound, body: { success?: false, code: "404" }.to_json) }

      before { dev_key.update!(public_jwk_url: url) }

      it do
        expect(CanvasHttp).to receive(:get).with(url).and_return(stubbed_response)
        expect(subject).to be false
      end
    end
  end

  describe "#valid?" do
    subject { provider.valid? }

    it { is_expected.to be true }

    context "with bad aud" do
      let(:aud) { "doesnotexist" }

      it { is_expected.to be false }
    end

    context "with bad signing key" do
      let(:signing_key) { JSON::JWK.new(CanvasSecurity::RSAKeyPair.new.to_jwk) }

      it { is_expected.to be false }
    end

    context "with unsupported algorithm (HS256)" do
      let(:alg) { :HS256 }
      let(:signing_key) { "lowentropy" }

      it { is_expected.to be false }
    end

    context "jti replay protection" do
      it "accepts the same JWT twice (jti is not checked for LTI)" do
        enable_cache do
          subject
          expect(subject).to be true
        end
      end
    end
  end

  describe "#error_message" do
    subject { provider.error_message }

    before { provider.valid? }

    it { is_expected.to be_nil }

    context "with unsupported algorithm (HS256)" do
      let(:alg) { :HS256 }
      let(:signing_key) { "lowentropy" }

      it { is_expected.not_to be_empty }
    end
  end
end

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

require "spec_helper"

RSpec.describe PlatformTokens::Token::Concerns::Serialization do
  let(:token_class) do
    stub_const("PlatformTokens::Token::ConcreteToken", Class.new(PlatformTokens::Token::Base) do
      def ttl = 300.seconds
    end)
  end

  # 512-bit RSA test key in JWK format
  let(:signing_key) do
    {
      "kty" => "RSA",
      "e" => "AQAB",
      "n" => "uX1MpfEMQCBUMcj0sBYI-iFaG5Nodp3C6OlN8uY60fa5zSBd83-iIL3n_qzZ8VCluuTLfB7rrV_tiX727XIEqQ",
      "kid" => "2018-07-18T22:33:20Z_c",
      "d" => "pYwR64x-LYFtA13iHIIeEvfPTws50ZutyGfpHN-kIZz3k-xVpun2Hgu0hVKZMxcZJ9DkG8UZPqD-zTDbCmCyLQ",
      "p" => "6OQ2bi_oY5fE9KfQOcxkmNhxDnIKObKb6TVYqOOz2JM",
      "q" => "y-UBef95njOrqMAxJH1QPds3ltYWr8QgGgccmcATH1M",
      "dp" => "Ol_xkL7rZgNFt_lURRiJYpJmDDPjgkDVuafIeFTS4Ic",
      "dq" => "RtzDY5wXr5TzrwWEztLCpYzfyAuF_PZj1cfs976apsM",
      "qi" => "XA5wnwIrwe5MwXpaBijZsGhKJoypZProt47aVCtWtPE"
    }
  end

  let(:token_attrs) do
    {
      aud: ["service-uuid"],
      sub: "user-uuid",
      org: "org-uuid",
      azp: "client-uuid",
      scope: "read write"
    }
  end

  let(:token) { token_class.new(**token_attrs) }

  before do
    PlatformTokens.configure(
      env: "test",
      iss: "id.instructure.com",
      region: "us-east-1",
      signing_key:
    )
  end

  after { PlatformTokens.send(:configuration_data=, nil) }

  describe "#to_jwt" do
    subject(:jwt_string) { token.to_jwt }

    let(:jwt_header) { JSON.parse(Base64.urlsafe_decode64(jwt_string.split(".").first)) }
    let(:jwt_payload) { JSON::JWT.decode(jwt_string, :skip_verification) }

    it "returns a string" do
      expect(jwt_string).to be_a(String)
    end

    it "signs with RS256" do
      expect(jwt_header["alg"]).to eql("RS256")
    end

    it "sets the kid header from the JWK" do
      expect(jwt_header["kid"]).to eql("2018-07-18T22:33:20Z_c")
    end

    it "embeds the correct claims in the payload" do
      expect(jwt_payload["sub"]).to eql("user-uuid")
      expect(jwt_payload["iss"]).to eql("id.instructure.com")
      expect(jwt_payload["env"]).to eql("test")
      expect(jwt_payload["scope"]).to eql("read write")
    end

    it "produces a JWT verifiable with the corresponding public key" do
      public_key = JSON::JWK.new(signing_key).to_key.public_key
      expect { JSON::JWT.decode(jwt_string, public_key) }.not_to raise_error
    end

    context "when the token is invalid" do
      before do
        token.send(:iat=, Time.now.utc - 2.hours)
        token.send(:exp=, Time.now.utc - 1.hour)
      end

      it "raises InvalidTokenError" do
        expect { token.to_jwt }.to raise_error(PlatformTokens::InvalidTokenError)
      end

      it "includes the validation message in the error" do
        expect { token.to_jwt }.to raise_error(PlatformTokens::InvalidTokenError, /token has expired/)
      end
    end
  end

  describe "#to_s" do
    it "is an alias for to_jwt" do
      jwt = token.to_jwt
      expect(token.to_s).to eql(jwt)
    end
  end
end

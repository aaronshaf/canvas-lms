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

RSpec.describe PlatformTokens::Token::Base do
  let(:token_class) do
    stub_const("PlatformTokens::Token::ConcreteToken", Class.new(described_class) do
      def ttl = 300.seconds
    end)
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
      access_token_ttl_seconds: 300,
      env: "test",
      iss: "id.instructure.com",
      region: "us-east-1"
    )
  end

  after { PlatformTokens.send(:configuration_data=, nil) }

  describe "#initialize" do
    it "coerces a scalar aud into an array" do
      t = token_class.new(**token_attrs, aud: "service-uuid")
      expect(t.aud).to eql(["service-uuid"])
    end

    it "preserves an array aud" do
      expect(token.aud).to eql(["service-uuid"])
    end

    it "sets sub, org, azp, and scope from kwargs" do
      expect(token.sub).to eql("user-uuid")
      expect(token.org).to eql("org-uuid")
      expect(token.azp).to eql("client-uuid")
      expect(token.scope).to eql("read write")
    end

    it "derives iss, env, and region from configuration" do
      expect(token.iss).to eql("id.instructure.com")
      expect(token.env).to eql("test")
      expect(token.region).to eql("us-east-1")
    end

    it "generates a UUID jti" do
      expect(token.jti).to match(/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/)
    end

    it "generates a unique jti per instance" do
      other = token_class.new(**token_attrs)
      expect(token.jti).not_to eql(other.jti)
    end

    it "sets iat to the current UTC time" do
      fixed = Time.utc(2026, 6, 11, 12, 0, 0)
      allow(Time).to receive(:now).and_return(fixed)
      t = token_class.new(**token_attrs)
      expect(t.iat).to eql(fixed)
    end

    it "sets nbf to iat minus CLOCK_SKEW_BUFFER" do
      expect(token.nbf).to eql(token.iat - described_class::CLOCK_SKEW_BUFFER)
    end

    it "sets exp to iat plus the subclass ttl" do
      expect(token.exp).to eql(token.iat + 300.seconds)
    end

    it "does not expose claim writers publicly" do
      expect(token).not_to respond_to(:sub=)
    end
  end

  describe "#ttl" do
    it "raises NotImplementedError on the base class" do
      instance = described_class.allocate
      expect { instance.send(:ttl) }.to raise_error(NotImplementedError)
    end
  end

  describe "validations" do
    it "is valid when all claims are well-formed" do
      expect(token).to be_valid
    end

    describe "presence" do
      it "is invalid without sub" do
        token.send(:sub=, nil)
        expect(token).not_to be_valid
        expect(token.errors[:sub]).to be_present
      end

      it "is invalid without iss" do
        token.send(:iss=, nil)
        expect(token).not_to be_valid
        expect(token.errors[:iss]).to be_present
      end

      it "is invalid without jti" do
        token.send(:jti=, nil)
        expect(token).not_to be_valid
        expect(token.errors[:jti]).to be_present
      end
    end

    describe "aud" do
      it "is invalid when aud is empty" do
        token.send(:aud=, [])
        expect(token).not_to be_valid
        expect(token.errors[:aud]).to be_present
      end
    end

    describe "exp" do
      it "is invalid when exp has elapsed" do
        token.send(:iat=, Time.now.utc - 2.hours)
        token.send(:exp=, Time.now.utc - 1.hour)
        expect(token).not_to be_valid
        expect(token.errors[:exp]).to include("token has expired")
      end

      it "is valid when exp elapsed within the clock skew buffer" do
        now = Time.now.utc
        token.send(:iat=, now - 1.hour)
        token.send(:exp=, now - (described_class::CLOCK_SKEW_BUFFER / 2))
        expect(token).to be_valid
      end

      it "is invalid when exp elapsed beyond the clock skew buffer" do
        now = Time.now.utc
        token.send(:iat=, now - 1.hour)
        token.send(:exp=, now - (described_class::CLOCK_SKEW_BUFFER + 1.second))
        expect(token).not_to be_valid
        expect(token.errors[:exp]).to include("token has expired")
      end
    end

    describe "nbf" do
      it "is invalid when nbf is in the future" do
        token.send(:nbf=, Time.now.utc + 1.hour)
        expect(token).not_to be_valid
        expect(token.errors[:nbf]).to include("token is not yet valid")
      end
    end

    describe "timestamp ordering" do
      it "is invalid when exp equals iat" do
        now = Time.now.utc
        token.send(:iat=, now)
        token.send(:exp=, now)
        expect(token).not_to be_valid
        expect(token.errors[:exp]).to include("must be after iat")
      end

      it "is invalid when exp is before iat" do
        now = Time.now.utc
        token.send(:iat=, now)
        token.send(:exp=, now - 1)
        expect(token).not_to be_valid
        expect(token.errors[:exp]).to include("must be after iat")
      end
    end

    describe "env" do
      it "is invalid when env does not match the configured environment" do
        token.send(:env=, "production")
        expect(token).not_to be_valid
        expect(token.errors[:env]).to include("does not match configured environment")
      end
    end
  end
end

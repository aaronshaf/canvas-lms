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

RSpec.describe PlatformTokens::Configuration do
  subject(:config) { described_class.new(**valid_attrs) }

  let(:valid_attrs) do
    {
      access_token_ttl_seconds: 300,
      env: "test",
      iss: "id.instructure.com",
      region: "us-east-1"
    }
  end

  describe "#initialize" do
    it "sets access_token_ttl_seconds" do
      expect(config.access_token_ttl_seconds).to be 300
    end

    it "sets env" do
      expect(config.env).to eql("test")
    end

    it "sets iss" do
      expect(config.iss).to eql("id.instructure.com")
    end

    it "sets region" do
      expect(config.region).to eql("us-east-1")
    end

    it "does not expose attribute writers publicly" do
      expect(config).not_to respond_to(:env=)
    end
  end

  describe "validations" do
    it "is valid with all required attributes" do
      expect(config).to be_valid
    end

    describe "presence" do
      PlatformTokens::Configuration::ATTRIBUTES.each do |attr|
        context "when #{attr} is nil" do
          subject(:config) { described_class.new(**valid_attrs, attr => nil) }

          it "is invalid" do
            expect(config).not_to be_valid
          end

          it "reports an error on #{attr}" do
            config.valid?
            expect(config.errors[attr]).to be_present
          end
        end
      end
    end

    describe "access_token_ttl_seconds" do
      context "when greater than MAX_TTL" do
        subject(:config) do
          described_class.new(**valid_attrs, access_token_ttl_seconds: PlatformTokens::Token::Base::MAX_TTL.to_i + 1)
        end

        it "is invalid" do
          expect(config).not_to be_valid
        end

        it "reports an error on access_token_ttl_seconds" do
          config.valid?
          expect(config.errors[:access_token_ttl_seconds]).to be_present
        end
      end

      context "when equal to MAX_TTL" do
        subject(:config) do
          described_class.new(**valid_attrs, access_token_ttl_seconds: PlatformTokens::Token::Base::MAX_TTL.to_i)
        end

        it "is valid" do
          expect(config).to be_valid
        end
      end

      context "when zero" do
        subject(:config) { described_class.new(**valid_attrs, access_token_ttl_seconds: 0) }

        it "is invalid" do
          expect(config).not_to be_valid
        end

        it "reports an error on access_token_ttl_seconds" do
          config.valid?
          expect(config.errors[:access_token_ttl_seconds]).to be_present
        end
      end

      context "when negative" do
        subject(:config) { described_class.new(**valid_attrs, access_token_ttl_seconds: -1) }

        it "is invalid" do
          expect(config).not_to be_valid
        end
      end
    end
  end
end

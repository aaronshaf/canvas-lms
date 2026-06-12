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
      region: "us-east-1",
      signing_key: "test-signing-key"
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

    it "defaults logger to a Logger writing to stdout" do
      expect(config.logger).to be_a(Logger)
    end

    context "when a custom logger is provided" do
      subject(:config) { described_class.new(**valid_attrs, logger: custom_logger) }

      let(:custom_logger) { Logger.new(File::NULL) }

      it "uses the provided logger" do
        expect(config.logger).to be(custom_logger)
      end
    end

    it "does not expose attribute writers publicly" do
      expect(config).not_to respond_to(:env=)
    end

    it "does not expose logger writer publicly" do
      expect(config).not_to respond_to(:logger=)
    end
  end

  describe "validations" do
    it "is valid with all required attributes" do
      expect(config).to be_valid
    end

    describe "presence" do
      # access_token_ttl_seconds is optional and falls back to DEFAULT_TTL, so it is not required.
      (PlatformTokens::Configuration::ATTRIBUTES - %i[access_token_ttl_seconds]).each do |attr|
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
      context "when omitted" do
        subject(:config) { described_class.new(**valid_attrs.except(:access_token_ttl_seconds)) }

        it "defaults to DEFAULT_TTL" do
          expect(config.access_token_ttl_seconds).to eql(PlatformTokens::Token::Base::DEFAULT_TTL)
        end

        it "is valid" do
          expect(config).to be_valid
        end
      end

      context "when nil" do
        subject(:config) { described_class.new(**valid_attrs, access_token_ttl_seconds: nil) }

        it "defaults to DEFAULT_TTL" do
          expect(config.access_token_ttl_seconds).to eql(PlatformTokens::Token::Base::DEFAULT_TTL)
        end
      end

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

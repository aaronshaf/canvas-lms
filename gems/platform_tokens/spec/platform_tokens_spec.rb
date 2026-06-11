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

RSpec.describe PlatformTokens do
  after { PlatformTokens.send(:configuration_data=, nil) }

  it "has a version number" do
    expect(PlatformTokens::VERSION).not_to be_nil
  end

  describe ".configuration" do
    context "when not configured" do
      it "raises ConfigurationError" do
        expect { PlatformTokens.configuration }.to raise_error(
          PlatformTokens::ConfigurationError,
          "Platform tokens have not been configured."
        )
      end
    end

    context "when configured" do
      before do
        PlatformTokens.configure(
          access_token_ttl_seconds: 300,
          env: "test",
          iss: "id.instructure.com",
          region: "us-east-1"
        )
      end

      it "returns a Configuration instance" do
        expect(PlatformTokens.configuration).to be_a(PlatformTokens::Configuration)
      end
    end
  end

  describe ".configure" do
    context "with valid attributes" do
      it "stores the configuration" do
        PlatformTokens.configure(
          access_token_ttl_seconds: 300,
          env: "test",
          iss: "id.instructure.com",
          region: "us-east-1"
        )
        expect(PlatformTokens.configuration.env).to eql("test")
      end
    end

    context "with invalid attributes" do
      let(:over_max_ttl) { PlatformTokens::Token::Base::MAX_TTL.to_i + 1 }

      it "raises ConfigurationError" do
        expect do
          PlatformTokens.configure(
            access_token_ttl_seconds: over_max_ttl,
            env: "test",
            iss: "id.instructure.com",
            region: "us-east-1"
          )
        end.to raise_error(PlatformTokens::ConfigurationError)
      end

      it "does not store the invalid configuration" do
        begin
          PlatformTokens.configure(
            access_token_ttl_seconds: over_max_ttl,
            env: "test",
            iss: "id.instructure.com",
            region: "us-east-1"
          )
        rescue PlatformTokens::ConfigurationError
          nil
        end

        expect { PlatformTokens.configuration }.to raise_error(PlatformTokens::ConfigurationError)
      end
    end
  end
end

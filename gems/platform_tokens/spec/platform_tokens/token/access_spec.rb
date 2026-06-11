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

RSpec.describe PlatformTokens::Token::Access do
  let(:token_attrs) do
    {
      aud: ["service-uuid", "other-service-uuid"],
      sub: "user-uuid",
      org: "org-uuid",
      azp: "client-uuid",
      scope: "read write"
    }
  end

  let(:token) { described_class.new(**token_attrs) }

  before do
    PlatformTokens.configure(
      access_token_ttl_seconds: 300,
      env: "test",
      iss: "id.instructure.com",
      region: "us-east-1"
    )
  end

  after { PlatformTokens.send(:configuration_data=, nil) }

  describe "#ttl" do
    it "sets exp based on access_token_ttl_seconds from configuration" do
      expect(token.exp).to eql(token.iat + 300.seconds)
    end

    it "reflects changes to access_token_ttl_seconds in configuration" do
      PlatformTokens.send(:configuration_data=, nil)
      PlatformTokens.configure(
        access_token_ttl_seconds: 600,
        env: "test",
        iss: "id.instructure.com",
        region: "us-east-1"
      )
      t = described_class.new(**token_attrs)
      expect(t.exp).to eql(t.iat + 600.seconds)
    end
  end

  describe "validations" do
    it "is valid with multiple audiences" do
      expect(token).to be_valid
    end

    describe "azp_not_sole_audience" do
      context "when azp is the only entry in aud" do
        let(:token) { described_class.new(**token_attrs, aud: ["client-uuid"], azp: "client-uuid") }

        it "is invalid" do
          expect(token).not_to be_valid
        end

        it "reports an error on aud" do
          token.valid?
          expect(token.errors[:aud]).to include(
            "must not be the sole audience when equal to the authorized party"
          )
        end
      end

      context "when azp appears alongside other entries in aud" do
        let(:token) { described_class.new(**token_attrs, aud: ["client-uuid", "service-uuid"], azp: "client-uuid") }

        it "is valid" do
          expect(token).to be_valid
        end
      end

      context "when azp is absent from aud" do
        let(:token) { described_class.new(**token_attrs, aud: ["service-uuid"], azp: "client-uuid") }

        it "is valid" do
          expect(token).to be_valid
        end
      end
    end
  end
end

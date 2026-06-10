# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
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

RSpec.describe Canvas::OAuth::GrantTypes::AuthorizationCode do # rubocop:disable RSpec/SpecFilePathFormat
  let(:key) { DeveloperKey.create! }
  let(:code) { Canvas::OAuth::Token.generate_code_for(1, nil, key.global_id) }
  let(:opts) { { code: } }
  let(:authorization_code) { described_class.new(key.global_id, key.api_key, opts) }

  describe "#supported_type?" do
    it "returns true" do
      expect(authorization_code.supported_type?).to be true
    end
  end

  describe "#validate_type" do
    context "with resource parameter (RFC 8707)" do
      let(:resource) { "https://mcp.instructure.com" }

      context "when resource matches the token's authorized resource" do
        let(:code) { Canvas::OAuth::Token.generate_code_for(1, nil, key.global_id, resource:) }
        let(:opts) { { code:, resource: } }

        before { key.update!(allowed_audiences: [resource]) }

        it "does not raise" do
          expect { authorization_code.send(:validate_type) }.not_to raise_error
        end
      end

      context "when resource is a subset of the token's authorized resources" do
        let(:other_resource) { "https://other.instructure.com" }
        let(:code) { Canvas::OAuth::Token.generate_code_for(1, nil, key.global_id, resource: [resource, other_resource]) }
        let(:opts) { { code:, resource: } }

        before { key.update!(allowed_audiences: [resource]) }

        it "does not raise" do
          expect { authorization_code.send(:validate_type) }.not_to raise_error
        end
      end

      context "when resource is not in the token's authorized resources" do
        let(:code) { Canvas::OAuth::Token.generate_code_for(1, nil, key.global_id, resource: "https://other.instructure.com") }
        let(:opts) { { code:, resource: } }

        it "raises Canvas::OAuth::RequestError" do
          expect { authorization_code.send(:validate_type) }.to raise_error(Canvas::OAuth::RequestError)
        end
      end

      context "when token has no resource but request includes resource" do
        let(:opts) { { code:, resource: } }

        it "raises Canvas::OAuth::RequestError" do
          expect { authorization_code.send(:validate_type) }.to raise_error(Canvas::OAuth::RequestError)
        end
      end

      context "when token has resource but request omits resource" do
        let(:code) { Canvas::OAuth::Token.generate_code_for(1, nil, key.global_id, resource:) }

        it "raises Canvas::OAuth::RequestError" do
          expect { authorization_code.send(:validate_type) }.to raise_error(Canvas::OAuth::RequestError)
        end
      end
    end
  end
end

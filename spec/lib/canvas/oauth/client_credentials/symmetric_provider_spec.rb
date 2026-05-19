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

describe Canvas::OAuth::ClientCredentials::SymmetricProvider do
  let(:dev_key) { DeveloperKey.create! client_credentials_audience: "external" }
  let(:provider) { described_class.new dev_key.id, "example.com" }

  before do
    allow(Rails.application.routes).to receive(:default_url_options).and_return({ host: "example.com" })
  end

  context "with valid client_id" do
    describe "#error_message" do
      subject { provider.error_message }

      it { is_expected.to be_empty }
    end

    describe "#valid?" do
      subject { provider.valid? }

      it { is_expected.to be true }
    end

    describe "generate_token" do
      subject { provider.generate_token }

      it { is_expected.to be_a Hash }

      it "has the correct expected keys" do
        %i[access_token token_type expires_in scope].each do |key|
          expect(subject).to have_key key
        end
      end
    end
  end

  context "with invalid client_id" do
    let(:provider) { described_class.new "invalid", "example.com" }

    describe "#error_message" do
      subject { provider.error_message }

      it { is_expected.to eq("Unknown client_id") }
    end

    describe "#valid?" do
      subject { provider.valid? }

      it { is_expected.to be false }
    end
  end
end

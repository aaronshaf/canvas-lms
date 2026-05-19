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

describe Canvas::OAuth::ClientCredentials::Provider do
  let(:dev_key) { DeveloperKey.create! }
  let(:provider) { described_class.new dev_key.id, "example.com" }

  before do
    allow(Rails.application.routes).to receive(:default_url_options).and_return({ host: "example.com" })
  end

  describe "generate_token" do
    subject { provider.generate_token }

    it { is_expected.to be_a Hash }

    it "has the correct expected keys" do
      %i[access_token token_type expires_in scope].each do |key|
        expect(subject).to have_key key
      end
    end

    context "with iat in the future by a small amount" do
      let(:future_iat_time) { 5.seconds.from_now }
      let(:iat) { future_iat_time.to_i }

      it "returns an access token" do
        Timecop.freeze(future_iat_time - 5.seconds) do
          expect(subject).to be_a Hash
        end
      end
    end

    describe "with account scoped dev_key" do
      before do
        @account = Account.create!
        dev_key.update!(account_id: @account)
      end

      it "includes a custom canvas account_id claim in the token" do
        token = subject[:access_token]
        claims = Canvas::Security.decode_jwt(token)
        expect(claims).to have_key "canvas.instructure.com"
        expect(claims["canvas.instructure.com"]["account_uuid"]).to eq @account.uuid
      end
    end
  end
end

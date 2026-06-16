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

describe "Account security contacts" do
  let(:account) { Account.create! }
  let(:admin) { account_admin_user(account:) }

  before do
    user_session(admin)
    # Don't hit real DNS; deliverability is covered in EmailAddressValidator specs.
    allow(EmailAddressValidator).to receive(:deliverable?).and_return(true)
  end

  describe "PUT /accounts/:id" do
    it "saves the primary and the optional secondary contact" do
      put "/accounts/#{account.id}", params: { account: {
        security_contact: { email: "primary@example.edu" },
        secondary_security_contact: { email: "secondary@example.edu" }
      } }

      expect(response).to be_redirect
      expect(account.security_contact.email).to eq "primary@example.edu"
      expect(account.secondary_security_contact.email).to eq "secondary@example.edu"
    end

    it "records the acting admin as the editor of a new contact" do
      put "/accounts/#{account.id}", params: { account: { security_contact: { email: "ciso@example.edu", name: "Sec" } } }

      expect(account.security_contact.email).to eq "ciso@example.edu"
      expect(account.security_contact.created_by).to eq admin
    end

    it "rejects an undeliverable email and persists no contact" do
      allow(EmailAddressValidator).to receive(:deliverable?).with("nope@bad.invalid").and_return(false)

      put "/accounts/#{account.id}", params: { account: { security_contact: { email: "nope@bad.invalid" } } }

      expect(account.security_contact).to be_nil
      expect(flash[:error]).to include("deliverable")
    end
  end

  describe "GET /accounts/:id/settings" do
    it "hides the security contact fields when the security_contacts flag is disabled" do
      get "/accounts/#{account.id}/settings"

      expect(response).to be_successful
      expect(response.body).not_to include("Primary Security Contact")
    end

    it "shows the security contact fields when the security_contacts flag is enabled" do
      account.enable_feature!(:security_contacts)

      get "/accounts/#{account.id}/settings"

      expect(response).to be_successful
      expect(response.body).to include("Primary Security Contact")
    end
  end
end

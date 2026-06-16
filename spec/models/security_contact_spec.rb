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

describe SecurityContact do
  subject(:contact) { account.security_contacts.build(email: "ciso@example.edu") }

  let(:account) { Account.create! }

  before do
    # Don't hit real DNS; deliverability itself is covered in EmailAddressValidator specs.
    allow(EmailAddressValidator).to receive(:deliverable?).and_return(true)
  end

  describe "validations" do
    it "is valid when the email is deliverable" do
      expect(contact).to be_valid
    end

    it "requires an email" do
      contact.email = ""
      expect(contact).not_to be_valid
      expect(contact.errors[:email]).to be_present
    end

    it "rejects an invalid or undeliverable email" do
      allow(EmailAddressValidator).to receive(:deliverable?).with("nope@bad.invalid").and_return(false)
      contact.email = "nope@bad.invalid"
      expect(contact).not_to be_valid
      expect(contact.errors[:email]).to include("is not a valid or deliverable email address")
    end
  end

  describe "root account" do
    it "is inferred from the account on create" do
      contact.save!
      expect(contact.root_account).to eq account
      expect(contact.root_account_id).to eq account.resolved_root_account_id
    end
  end

  describe "kind" do
    it "defaults to primary" do
      expect(contact.kind).to eq "primary"
    end

    it "rejects an unknown kind" do
      contact.kind = "tertiary"
      expect(contact).not_to be_valid
      expect(contact.errors[:kind]).to be_present
    end
  end

  describe "scopes" do
    it "separates active from historic rows" do
      contact.save!
      historic = account.security_contact_history.create!(email: "old@example.edu", workflow_state: "historic")

      expect(SecurityContact.active).to include(contact)
      expect(SecurityContact.active).not_to include(historic)
      expect(SecurityContact.historic).to eq [historic]
    end

    it "separates primary from secondary rows" do
      contact.save!
      secondary = account.security_contacts.create!(email: "second@example.edu", kind: "secondary")

      expect(SecurityContact.primary).to eq [contact]
      expect(SecurityContact.secondary).to eq [secondary]
    end
  end
end

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

# Behavior of Account#security_contact=: the settings form stages a
# {name,email,title,phone_number} hash, and saving the account applies it as
# active/historic rows in security_contacts.
describe "Account security contact" do
  subject(:account) { Account.create! }

  let(:editor) { user_factory }

  before do
    allow(EmailAddressValidator).to receive(:deliverable?).and_return(true)
  end

  def set_contact(attrs, editor: self.editor)
    account.security_contact_editor = editor
    account.security_contact = attrs
    account.save!
  end

  it "creates an active contact and records who set it" do
    set_contact({ name: "Sec Team", email: "ciso@example.edu", title: "CISO", phone_number: "555-0100" })

    contact = account.security_contact
    expect(contact.email).to eq "ciso@example.edu"
    expect(contact.title).to eq "CISO"
    expect(contact.created_by).to eq editor
    expect(contact).to be_active
    expect(contact.kind).to eq "primary"
  end

  it "keeps an independent active primary and secondary contact" do
    account.security_contact_editor = editor
    account.security_contact = { email: "primary@example.edu" }
    account.secondary_security_contact = { email: "secondary@example.edu" }
    account.save!

    expect(account.security_contact.email).to eq "primary@example.edu"
    expect(account.secondary_security_contact.email).to eq "secondary@example.edu"
    expect(account.secondary_security_contact.kind).to eq "secondary"
    expect(account.security_contacts.count).to eq 2
  end

  it "edits the secondary contact without disturbing the primary" do
    account.security_contact_editor = editor
    account.security_contact = { email: "primary@example.edu" }
    account.secondary_security_contact = { email: "secondary@example.edu" }
    account.save!

    account.secondary_security_contact = { email: "newsecondary@example.edu" }
    account.save!

    expect(account.reload.security_contact.email).to eq "primary@example.edu"
    expect(account.secondary_security_contact.email).to eq "newsecondary@example.edu"
    # primary untouched (no extra history), secondary retired old value
    expect(account.security_contact_history.where(kind: "primary").count).to eq 1
    expect(account.security_contact_history.where(kind: "secondary").pluck(:email))
      .to eq %w[newsecondary@example.edu secondary@example.edu]
  end

  it "leaves no row when the optional secondary is blank" do
    account.security_contact_editor = editor
    account.security_contact = { email: "primary@example.edu" }
    account.secondary_security_contact = { name: "", email: "", title: "", phone_number: "" }
    account.save!

    expect(account.secondary_security_contact).to be_nil
    expect(account.security_contacts.count).to eq 1
  end

  it "retires the previous value to historic when edited" do
    set_contact({ email: "first@example.edu" })
    first = account.security_contact

    other_editor = user_factory
    set_contact({ email: "second@example.edu" }, editor: other_editor)

    expect(account.reload.security_contact.email).to eq "second@example.edu"
    expect(account.security_contact.created_by).to eq other_editor
    expect(first.reload).to be_historic
    expect(account.security_contact_history.map(&:email)).to eq %w[second@example.edu first@example.edu]
  end

  it "is a no-op when the assignment matches the current contact" do
    email = "ciso@example.edu"
    set_contact({ name: "Sec Team", email: })
    expect { set_contact({ name: "Sec Team", email: }) }.not_to change { account.security_contact_history.count }
  end

  it "retires the contact with no replacement when cleared" do
    set_contact({ email: "ciso@example.edu" })

    set_contact({ name: "", email: "", title: "", phone_number: "" })

    expect(account.reload.security_contact).to be_nil
    expect(account.security_contact_history.count).to eq 1
    expect(account.security_contact_history.first).to be_historic
  end

  it "rejects an undeliverable email and persists nothing" do
    allow(EmailAddressValidator).to receive(:deliverable?).with("nope@bad.invalid").and_return(false)
    account.security_contact_editor = editor
    account.security_contact = { email: "nope@bad.invalid" }

    expect(account.save).to be false
    expect(account.errors[:security_contact].join).to include("deliverable")
    expect(account.security_contact_history).to be_empty
  end

  describe "notifying a retired contact" do
    # Capture every Message handed to the mailer without sending anything.
    def captured_messages
      @captured_messages ||= []
    end

    before do
      allow(Mailer).to receive(:create_message) do |m|
        captured_messages << m
        double(deliver: true)
      end
      allow(Mailer).to receive(:deliver)
    end

    it "builds a removal notice addressed to the retired email" do
      set_contact({ email: "old@example.edu" })
      set_contact({ email: "new@example.edu" })
      run_jobs

      message = captured_messages.find { |m| m.to == "old@example.edu" }
      expect(message).not_to be_nil
      expect(message.subject).to include "no longer"
      expect(message.body).to include "old@example.edu"
    end

    it "notifies the previous contact when it is replaced" do
      set_contact({ email: "first@example.edu" })
      set_contact({ email: "second@example.edu" })
      run_jobs

      expect(captured_messages.map(&:to)).to include("first@example.edu")
      expect(captured_messages.map(&:to)).not_to include("second@example.edu")
    end

    it "notifies the previous contact when it is cleared" do
      set_contact({ email: "first@example.edu" })
      set_contact({ name: "", email: "", title: "", phone_number: "" })
      run_jobs

      expect(captured_messages.map(&:to)).to include("first@example.edu")
    end

    it "does not notify when a contact is first added" do
      set_contact({ email: "first@example.edu" })
      run_jobs

      expect(captured_messages).to be_empty
    end
  end
end

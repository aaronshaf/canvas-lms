# frozen_string_literal: true

#
# Copyright (C) 2015 - present Instructure, Inc.
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

describe "EmailAddressValidator" do
  describe ".valid?" do
    it "accepts good addresses with domains" do
      ["user@example.com", '"non\@triv"/ial@example.com'].each do |addr|
        expect(EmailAddressValidator.valid?(addr)).to be true
      end
    end

    it "rejects bad, local, or multiple addresses" do
      ["None", "@example.com", "user@", "user1@example.com, user2@example.com"].each do |addr|
        expect(EmailAddressValidator.valid?(addr)).to be false
      end
    end
  end

  describe ".domain_has_mail_exchanger?" do
    let(:dns) { instance_double(Resolv::DNS) }

    before do
      allow(Resolv::DNS).to receive(:open).and_yield(dns)
    end

    def stub_records(mx_records: [], a_records: [], aaaa_records: [])
      allow(dns).to receive(:getresources).with("example.com", Resolv::DNS::Resource::IN::MX).and_return(mx_records)
      allow(dns).to receive(:getresources).with("example.com", Resolv::DNS::Resource::IN::A).and_return(a_records)
      allow(dns).to receive(:getresources).with("example.com", Resolv::DNS::Resource::IN::AAAA).and_return(aaaa_records)
    end

    it "is true when the domain publishes an MX record" do
      stub_records(mx_records: [:an_mx_record])
      expect(EmailAddressValidator.domain_has_mail_exchanger?("example.com")).to be true
    end

    it "falls back to an A record when there is no MX (RFC 5321 implicit MX)" do
      stub_records(a_records: [:an_a_record])
      expect(EmailAddressValidator.domain_has_mail_exchanger?("example.com")).to be true
    end

    it "falls back to an AAAA record" do
      stub_records(aaaa_records: [:an_aaaa_record])
      expect(EmailAddressValidator.domain_has_mail_exchanger?("example.com")).to be true
    end

    it "is false when the domain publishes no usable records" do
      stub_records
      expect(EmailAddressValidator.domain_has_mail_exchanger?("example.com")).to be false
    end

    it "is false for a blank domain without consulting DNS" do
      expect(Resolv::DNS).not_to receive(:open)
      expect(EmailAddressValidator.domain_has_mail_exchanger?("")).to be false
    end

    it "gives the address the benefit of the doubt when resolution fails transiently" do
      allow(Resolv::DNS).to receive(:open).and_raise(Resolv::ResolvError)
      expect(EmailAddressValidator.domain_has_mail_exchanger?("example.com")).to be true
    end

    it "gives the address the benefit of the doubt on timeout" do
      allow(Resolv::DNS).to receive(:open).and_raise(Timeout::Error)
      expect(EmailAddressValidator.domain_has_mail_exchanger?("example.com")).to be true
    end
  end

  describe ".deliverable?" do
    it "is false for a malformed address without consulting DNS" do
      expect(EmailAddressValidator).not_to receive(:domain_has_mail_exchanger?)
      expect(EmailAddressValidator.deliverable?("not-an-email")).to be false
    end

    it "is true when the address is well-formed and the domain can receive mail" do
      allow(EmailAddressValidator).to receive(:domain_has_mail_exchanger?).with("example.com").and_return(true)
      expect(EmailAddressValidator.deliverable?("user@example.com")).to be true
    end

    it "is false when the domain cannot receive mail" do
      allow(EmailAddressValidator).to receive(:domain_has_mail_exchanger?).with("example.com").and_return(false)
      expect(EmailAddressValidator.deliverable?("user@example.com")).to be false
    end
  end
end

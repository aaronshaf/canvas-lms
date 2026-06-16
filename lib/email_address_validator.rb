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

require "mail"
require "resolv"
require "timeout"

class EmailAddressValidator
  DNS_TIMEOUT = 3

  def self.valid?(value)
    addr = Mail::Address.new(value)
    return false unless addr.domain

    addr.address == value
  rescue Mail::Field::ParseError
    false
  end

  # Format-valid and the domain can plausibly receive mail.
  def self.deliverable?(value)
    return false unless valid?(value)

    domain_has_mail_exchanger?(Mail::Address.new(value).domain)
  end

  # MX record, or an A/AAAA fallback per RFC 5321 §5.1. Transient resolver
  # errors are rescued as true so a DNS hiccup never blocks a save.
  def self.domain_has_mail_exchanger?(domain)
    return false if domain.blank?

    Timeout.timeout(DNS_TIMEOUT) do
      Resolv::DNS.open do |dns|
        return true if dns.getresources(domain, Resolv::DNS::Resource::IN::MX).any?
        return true if dns.getresources(domain, Resolv::DNS::Resource::IN::A).any?
        return true if dns.getresources(domain, Resolv::DNS::Resource::IN::AAAA).any?
      end
    end
    false
  rescue Timeout::Error, Resolv::ResolvError, SocketError, IOError, SystemCallError
    true
  end
end

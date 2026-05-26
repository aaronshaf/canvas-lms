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

# Asserts that the given URL columns reject the dangerous-scheme payloads
# enforced by CanvasHttp::DANGEROUS_URL_SCHEMES.
#
# Required:
#   let(:record) { ... }
#   let(:url_fields) { %i[foo_url bar_url] }
shared_examples "rejects dangerous URL schemes" do
  dangerous_payloads = {
    "javascript:// with host" => "javascript://host/alert(1)",
    "javascript:// with newline payload" => "javascript://host/%0Aalert(1)",
    "data:" => "data:text/plain,hello",
    "vbscript://" => "vbscript://host/msgbox",
    "file://" => "file:///etc/passwd",
    "blob://" => "blob://host/uuid",
    "about://" => "about://host/blank",
    "mailto:" => "mailto:user@example.com",
    "tel:" => "tel:+15551234567",
    "mixed case JaVaScRiPt://" => "JaVaScRiPt://host/alert(1)",
  }

  url_fields_for_test = nil

  before do
    url_fields_for_test = Array(url_fields)
    expect(url_fields_for_test).not_to be_empty,
                                       "shared example requires let(:url_fields) with at least one column"
  end

  dangerous_payloads.each do |label, payload|
    it "rejects #{label} in every declared URL column" do
      url_fields_for_test.each do |field|
        record[field] = payload
      end

      expect(record).not_to be_valid,
                            "expected #{record.class} with #{url_fields_for_test.inspect} = #{payload.inspect} to be invalid"
      url_fields_for_test.each do |field|
        expect(record.errors[field]).to be_present,
                                        "expected #{record.class}##{field} to have a validation error for payload #{payload.inspect}"
      end
    end
  end
end

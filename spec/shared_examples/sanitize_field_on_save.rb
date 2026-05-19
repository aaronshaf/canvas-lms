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

# Verifies every column declared via `sanitize_field` on this model
# gets sanitized on save (XSS payloads stripped). Auto-discovers
# fields from `fully_sanitize_fields_config` — no manual field list
# needed.
#
# Required:
#   let(:record) { ... }
#
# Usage:
#   it_behaves_like "sanitizes its sanitize_field columns on save" do
#     let(:record) { my_factory_helper }
#   end
shared_examples "sanitizes its sanitize_field columns on save" do
  it "strips XSS from every sanitize_field column" do
    fields = described_class.fully_sanitize_fields_config&.keys || []
    expect(fields).not_to be_empty,
                          "#{described_class} has no sanitize_field columns to verify"

    expect_sanitization_on_save(record, *fields)
  end
end

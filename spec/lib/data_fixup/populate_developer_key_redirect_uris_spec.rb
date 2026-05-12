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

describe DataFixup::PopulateDeveloperKeyRedirectUris do
  describe ".run" do
    let(:key) { DeveloperKey.create!(name: "fixup", email: "f@f.com") }

    before do
      # Bypass our overridden setters so the legacy columns are the only state on disk
      key.update_columns(
        redirect_uri: "https://lenient.example.com/",
        redirect_uris: ["https://strict-a.example.com/", "https://strict-b.example.com/"]
      )
      key.developer_key_redirect_uris.delete_all
    end

    it "creates a strict record for each entry in the legacy redirect_uris array" do
      described_class.run

      records = key.developer_key_redirect_uris.strict.active
      expect(records.pluck(:redirect_uri)).to match_array(["https://strict-a.example.com/", "https://strict-b.example.com/"])
    end

    it "creates a lenient record for the legacy redirect_uri" do
      described_class.run

      record = key.developer_key_redirect_uris.lenient.first
      expect(record.redirect_uri).to eql "https://lenient.example.com/"
      expect(record.workflow_state).to eql "active"
    end

    it "promotes an existing strict record to lenient when its URI matches the legacy redirect_uri" do
      key.update_columns(
        redirect_uri: "https://overlap.example.com/",
        redirect_uris: ["https://overlap.example.com/"]
      )

      described_class.run

      record = key.developer_key_redirect_uris.find_by(redirect_uri: "https://overlap.example.com/")
      expect(record.lenient).to be true
    end

    it "handles keys with no legacy redirect_uri set" do
      key.update_columns(redirect_uri: nil)

      described_class.run

      expect(key.developer_key_redirect_uris.lenient).to be_empty
      expect(key.developer_key_redirect_uris.strict.count).to be 2
    end

    it "clears the legacy redirect_uri / redirect_uris columns after migrating" do
      described_class.run

      key.reload
      expect(key.read_attribute(:redirect_uri)).to be_nil
      expect(key.read_attribute(:redirect_uris)).to eql []
    end
  end
end

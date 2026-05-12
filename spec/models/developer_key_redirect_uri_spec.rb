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

describe DeveloperKeyRedirectUri do
  let_once(:developer_key) { DeveloperKey.create!(name: "test", email: "t@t.com") }

  describe "validations" do
    it "requires a redirect_uri" do
      record = developer_key.developer_key_redirect_uris.build
      expect(record).not_to be_valid
      expect(record.errors[:redirect_uri]).to include("can't be blank")
    end

    it "rejects invalid URIs" do
      record = developer_key.developer_key_redirect_uris.build(redirect_uri: "@?!")
      expect(record).not_to be_valid
      expect(record.errors[:redirect_uri]).to include("is not a valid URI")
    end

    it "allows non-http URIs" do
      record = developer_key.developer_key_redirect_uris.build(redirect_uri: "tealpass://x.example.com/cb")
      expect(record).to be_valid
    end

    it "allows the OAuth2 OOB URI" do
      record = developer_key.developer_key_redirect_uris.build(redirect_uri: Canvas::OAuth::Provider::OAUTH2_OOB_URI)
      expect(record).to be_valid
    end

    it "rejects duplicates within a developer_key (uniqueness)" do
      developer_key.developer_key_redirect_uris.create!(redirect_uri: "https://example.com/a")
      expect do
        developer_key.developer_key_redirect_uris.create!(redirect_uri: "https://example.com/a")
      end.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "rejects URIs longer than 255 chars" do
      record = developer_key.developer_key_redirect_uris.build(redirect_uri: "https://example.com/" + ("a" * 240))
      expect(record).not_to be_valid
    end

    it "rejects a new active row when MAX_ACTIVE would be exceeded" do
      stub_const("DeveloperKeyRedirectUri::MAX_ACTIVE", 2)
      developer_key.developer_key_redirect_uris.create!(redirect_uri: "https://example.com/a")
      developer_key.developer_key_redirect_uris.create!(redirect_uri: "https://example.com/b")
      excess = developer_key.developer_key_redirect_uris.build(redirect_uri: "https://example.com/c")
      expect(excess).not_to be_valid
      expect(excess.errors[:base].first).to include("more than 2 active redirect URIs")
    end

    it "allows saving an already-active row when the limit is reached (excludes self)" do
      stub_const("DeveloperKeyRedirectUri::MAX_ACTIVE", 1)
      record = developer_key.developer_key_redirect_uris.create!(redirect_uri: "https://example.com/a")
      record.last_used_at = Time.zone.now
      expect(record).to be_valid
    end
  end

  describe "workflow" do
    let(:record) { developer_key.developer_key_redirect_uris.create!(redirect_uri: "https://example.com/cb") }

    it "transitions active -> inactive via deactivate" do
      record.deactivate
      expect(record.workflow_state).to eq "inactive"
    end

    it "transitions inactive -> active via activate" do
      record.deactivate
      record.activate
      expect(record.workflow_state).to eq "active"
    end
  end

  describe ".cleanup_stale_records" do
    let_once(:developer_key) { DeveloperKey.create!(name: "auditor-test", email: "a@a.com") }

    it "deactivates active records whose last_used_at is older than DEACTIVATE_GRACE_PERIOD" do
      stale = developer_key.developer_key_redirect_uris.create!(
        redirect_uri: "https://stale.example.com/",
        last_used_at: 91.days.ago
      )

      described_class.cleanup_stale_records

      expect(stale.reload).to be_inactive
    end

    it "leaves active records alone when last_used_at is within the grace period" do
      fresh = developer_key.developer_key_redirect_uris.create!(
        redirect_uri: "https://fresh.example.com/",
        last_used_at: 30.days.ago
      )

      described_class.cleanup_stale_records

      expect(fresh.reload).to be_active
    end

    it "ignores records with nil last_used_at" do
      never_used = developer_key.developer_key_redirect_uris.create!(redirect_uri: "https://never.example.com/")

      described_class.cleanup_stale_records

      expect(never_used.reload).to be_active
    end

    it "ignores inactive records" do
      record = developer_key.developer_key_redirect_uris.create!(
        redirect_uri: "https://already-inactive.example.com/",
        last_used_at: 100.days.ago
      )
      record.deactivate

      expect { described_class.cleanup_stale_records }.not_to change { record.reload.workflow_state }
    end

    it "ignores deleted records" do
      developer_key.developer_key_redirect_uris.create!(
        redirect_uri: "https://gone.example.com/",
        last_used_at: 100.days.ago,
        workflow_state: "deleted"
      )

      described_class.cleanup_stale_records

      # No change expected; just ensure no exception
      record = developer_key.developer_key_redirect_uris.find_by(redirect_uri: "https://gone.example.com/")
      expect(record).to be_deleted
    end
  end
end

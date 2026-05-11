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

describe OAuthRedirectUriValidationConfig do
  before { described_class.reset! }
  after { described_class.reset! }

  def stub_consul(value)
    allow(Canvas).to receive(:load_config_file_or_consul)
      .with("oauth_redirect_uri_validation", failsafe_cache: true)
      .and_return(value)
  end

  describe ".report? / .enforce?" do
    it "both default to false when no config is present" do
      stub_consul(nil)
      expect(described_class.report?).to be false
      expect(described_class.enforce?).to be false
    end

    it "both default to false when config is empty" do
      stub_consul({})
      expect(described_class.report?).to be false
      expect(described_class.enforce?).to be false
    end

    it "returns true when each key is set" do
      stub_consul("report" => true, "enforce" => true)
      expect(described_class.report?).to be true
      expect(described_class.enforce?).to be true
    end

    it "supports report-only mode (report on, enforce off)" do
      stub_consul("report" => true, "enforce" => false)
      expect(described_class.report?).to be true
      expect(described_class.enforce?).to be false
    end

    it "coerces any truthy value to true (no strict boolean parsing)" do
      stub_consul("report" => "yes", "enforce" => 1)
      expect(described_class.report?).to be true
      expect(described_class.enforce?).to be true
    end
  end

  describe ".disallow_implicit_oob_redirect_uri? / .enforce_disallow_implicit_oob_redirect_uri?" do
    it "both default to false when no config is present" do
      stub_consul(nil)
      expect(described_class.disallow_implicit_oob_redirect_uri?).to be false
      expect(described_class.enforce_disallow_implicit_oob_redirect_uri?).to be false
    end

    it "returns true when each key is set" do
      stub_consul(
        "disallow_implicit_oob_redirect_uri" => true,
        "enforce_disallow_implicit_oob_redirect_uri" => true
      )
      expect(described_class.disallow_implicit_oob_redirect_uri?).to be true
      expect(described_class.enforce_disallow_implicit_oob_redirect_uri?).to be true
    end

    it "can enable only the report flag" do
      stub_consul("disallow_implicit_oob_redirect_uri" => true)
      expect(described_class.disallow_implicit_oob_redirect_uri?).to be true
      expect(described_class.enforce_disallow_implicit_oob_redirect_uri?).to be false
    end
  end

  describe ".disallow_non_document_oob_sec_fetch_dest? / .enforce_disallow_non_document_oob_sec_fetch_dest?" do
    it "both default to false when no config is present" do
      stub_consul(nil)
      expect(described_class.disallow_non_document_oob_sec_fetch_dest?).to be false
      expect(described_class.enforce_disallow_non_document_oob_sec_fetch_dest?).to be false
    end

    it "returns true when each key is set" do
      stub_consul(
        "disallow_non_document_oob_sec_fetch_dest" => true,
        "enforce_disallow_non_document_oob_sec_fetch_dest" => true
      )
      expect(described_class.disallow_non_document_oob_sec_fetch_dest?).to be true
      expect(described_class.enforce_disallow_non_document_oob_sec_fetch_dest?).to be true
    end

    it "can enable only the report flag" do
      stub_consul("disallow_non_document_oob_sec_fetch_dest" => true)
      expect(described_class.disallow_non_document_oob_sec_fetch_dest?).to be true
      expect(described_class.enforce_disallow_non_document_oob_sec_fetch_dest?).to be false
    end
  end

  describe ".enforce_for_developer_key?" do
    it "returns enforce? when the key is not in the never list" do
      stub_consul("enforce" => true)
      expect(described_class.enforce_for_developer_key?("10000000000001")).to be true
      described_class.reset!
      stub_consul("enforce" => false)
      expect(described_class.enforce_for_developer_key?("10000000000001")).to be false
    end

    it "returns false when the key is in never_enforce_developer_keys, regardless of enforce?" do
      stub_consul(
        "enforce" => true,
        "never_enforce_developer_keys" => ["10000000000003"]
      )
      expect(described_class.enforce_for_developer_key?("10000000000003")).to be false
    end

    it "coerces the global_id argument to a string for comparison" do
      stub_consul("never_enforce_developer_keys" => ["10000000000005"], "enforce" => true)
      expect(described_class.enforce_for_developer_key?(10_000_000_000_005)).to be false
    end

    it "coerces config values to strings (handles numeric YAML entries)" do
      stub_consul("never_enforce_developer_keys" => [10_000_000_000_006])
      expect(described_class.enforce_for_developer_key?("10000000000006")).to be false
    end

    it "defaults to enforce? when no never list is configured" do
      stub_consul("enforce" => true)
      expect(described_class.never_enforce_developer_keys).to be_empty
      expect(described_class.enforce_for_developer_key?("10000000000007")).to be true
    end
  end

  describe "caching" do
    it "memoizes the config across calls within a process" do
      stub_consul("report" => true)
      expect(Canvas).to receive(:load_config_file_or_consul).once.and_call_original
      3.times { described_class.report? }
    end

    it "reloads after reset!" do
      stub_consul("report" => true)
      described_class.report?
      described_class.reset!
      expect(Canvas).to receive(:load_config_file_or_consul).and_return("report" => false)
      expect(described_class.report?).to be false
    end
  end
end

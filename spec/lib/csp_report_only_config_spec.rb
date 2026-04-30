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

describe CspReportOnlyConfig do
  let(:account) { Account.default }
  let(:request) { instance_double(ActionDispatch::Request, host_with_port: "canvas.example.com") }

  before { described_class.reset! }

  def stub_consul(value)
    allow(Canvas).to receive(:load_config_file_or_consul).with("csp_report_only", failsafe_cache: true).and_return(value)
  end

  def stub_per_account(*domains)
    allow(account).to receive(:csp_whitelisted_domains).with(request, include_files: true, include_tools: true).and_return(domains)
  end

  describe ".static_config" do
    it "returns the parsed config when fully configured" do
      stub_consul(
        "allowed_domains" => ["https://*.instructure.com", "wss://*.instructure.com"],
        "report_uri" => "https://reports.example/submit/csp"
      )
      cfg = described_class.static_config
      expect(cfg[:allowed_domains]).to eq(["https://*.instructure.com", "wss://*.instructure.com"])
      expect(cfg[:report_uri]).to eq("https://reports.example/submit/csp")
    end

    it "returns nil when no config is loaded" do
      stub_consul(nil)
      expect(described_class.static_config).to be_nil
    end

    it "returns nil when allowed_domains is empty" do
      stub_consul("allowed_domains" => [], "report_uri" => "https://reports.example/submit/csp")
      expect(described_class.static_config).to be_nil
    end

    it "returns nil when report_uri is missing" do
      stub_consul("allowed_domains" => ["https://*.instructure.com"])
      expect(described_class.static_config).to be_nil
    end

    it "returns nil if any static value contains header-breaking chars (fail closed for operator config)" do
      stub_consul(
        "allowed_domains" => ["https://*.instructure.com evil.example"],
        "report_uri" => "https://reports.example/submit/csp"
      )
      expect(described_class.static_config).to be_nil
    end

    it "returns nil if a static domain contains a comma (header-value separator)" do
      stub_consul(
        "allowed_domains" => ["https://example.com,https://attacker.example"],
        "report_uri" => "https://reports.example/submit/csp"
      )
      expect(described_class.static_config).to be_nil
    end

    it "returns nil if the static allowlist exceeds the header byte cap" do
      stub_const("CspReportOnlyConfig::HEADER_BYTES_CAP", 200)
      expect(Rails.logger).to receive(:warn).with(/static allowlist exceeds/)
      stub_consul(
        "allowed_domains" => Array.new(20) { |i| "https://*.example#{i}.com" },
        "report_uri" => "https://reports.example/submit/csp"
      )
      expect(described_class.static_config).to be_nil
    end

    it "memoizes within the TTL window" do
      stub_consul("allowed_domains" => ["https://*.instructure.com"], "report_uri" => "https://r.example/csp")
      expect(Canvas).to receive(:load_config_file_or_consul).once.and_call_original
      3.times { described_class.static_config }
    end

    it "rebuilds after the TTL window expires" do
      stub_consul("allowed_domains" => ["https://*.instructure.com"], "report_uri" => "https://r.example/csp")
      described_class.static_config
      described_class.instance_variable_set(:@expires_at, Process.clock_gettime(Process::CLOCK_MONOTONIC) - 1)
      expect(Canvas).to receive(:load_config_file_or_consul).once.and_call_original
      described_class.static_config
    end

    context "with a {region} placeholder in report_uri" do
      it "interpolates Canvas.region_code into the URI" do
        allow(Canvas).to receive(:region_code).and_return("test-region")
        stub_consul(
          "allowed_domains" => ["https://*.example.com"],
          "report_uri" => "https://reports-{region}.example/submit/csp"
        )
        expect(described_class.static_config[:report_uri]).to eq(
          "https://reports-test-region.example/submit/csp"
        )
      end

      it "returns nil when no region_code is configured (fail closed)" do
        allow(Canvas).to receive(:region_code).and_return(nil)
        stub_consul(
          "allowed_domains" => ["https://*.example.com"],
          "report_uri" => "https://reports-{region}.example/submit/csp"
        )
        expect(described_class.static_config).to be_nil
      end

      it "leaves a region-less URI untouched even when region_code is nil" do
        allow(Canvas).to receive(:region_code).and_return(nil)
        stub_consul(
          "allowed_domains" => ["https://*.example.com"],
          "report_uri" => "https://hardcoded.example/submit/csp"
        )
        expect(described_class.static_config[:report_uri]).to eq("https://hardcoded.example/submit/csp")
      end
    end
  end

  describe ".directives_for" do
    before do
      stub_consul("allowed_domains" => ["https://*.instructure.com"], "report_uri" => "https://r.example/csp")
    end

    it "merges per-Account domains into the static allowlist" do
      stub_per_account("*.tool.example.com", "files.example.com")
      result = described_class.directives_for(account, request)
      expect(result).to include("https://*.instructure.com")
      expect(result).to include("*.tool.example.com")
      expect(result).to include("files.example.com")
      expect(result).to start_with("default-src 'self'")
      expect(result).to include("form-action 'self'")
      expect(result).to end_with("report-uri https://r.example/csp;")
    end

    it "deduplicates between static and per-Account lists" do
      stub_per_account("https://*.instructure.com", "*.tool.example.com")
      result = described_class.directives_for(account, request)
      expect(result.scan("https://*.instructure.com").size).to eq(2) # appears once each in default-src and form-action
    end

    it "returns static-only output when account is nil" do
      result = described_class.directives_for(nil, request)
      expect(result).to eq(
        "default-src 'self' https://*.instructure.com; " \
        "form-action 'self' https://*.instructure.com; " \
        "base-uri 'self'; " \
        "report-uri https://r.example/csp;"
      )
    end

    it "includes a base-uri 'self' directive (does not fall back to default-src)" do
      stub_per_account
      result = described_class.directives_for(account, request)
      expect(result).to include("base-uri 'self';")
    end

    it "returns nil when static config is unconfigured, regardless of account" do
      stub_consul(nil)
      stub_per_account("*.tool.example.com")
      expect(described_class.directives_for(account, request)).to be_nil
    end

    it "drops per-Account domains containing header-breaking chars and keeps the rest" do
      stub_per_account("*.good.example.com", "*.bad.example.com; default-src *", "*.also-good.example.com")
      expect(Rails.logger).to receive(:warn).with(/dropping per-account domain.*bad.example.com/)
      expect(InstStatsd::Statsd).to receive(:distributed_increment).with("csp_report_only.domain_dropped")
      result = described_class.directives_for(account, request)
      expect(result).to include("*.good.example.com")
      expect(result).to include("*.also-good.example.com")
      expect(result).not_to include("*.bad.example.com")
    end

    it "degrades to static-only directives when csp_whitelisted_domains raises" do
      allow(account).to receive(:csp_whitelisted_domains).and_raise(ActiveRecord::StatementInvalid.new("db down"))
      expect(Canvas::Errors).to receive(:capture).with(
        instance_of(ActiveRecord::StatementInvalid),
        hash_including(type: :csp_report_only, account_id: account.global_id),
        :warn
      )
      result = described_class.directives_for(account, request)
      expect(result).to include("https://*.instructure.com")
      expect(result).not_to include("nil")
    end

    it "truncates per-Account domains to fit the header cap, keeping static intact" do
      stub_const("CspReportOnlyConfig::HEADER_BYTES_CAP", 200)
      stub_per_account("*.first.example.com", "*.second.example.com", "*.third.example.com")
      expect(Rails.logger).to receive(:warn).with(/truncated \d+ per-account domain/)
      allow(InstStatsd::Statsd).to receive(:distributed_increment)
      result = described_class.directives_for(account, request)
      expect(result.bytesize).to be <= 200
      expect(result).to include("https://*.instructure.com") # static preserved
    end

    it "tolerates nil entries from the per-Account source" do
      stub_per_account("*.tool.example.com", nil, "*.other.example.com")
      expect { described_class.directives_for(account, request) }.not_to raise_error
      result = described_class.directives_for(account, request)
      expect(result).to include("*.tool.example.com")
      expect(result).to include("*.other.example.com")
    end

    it "preserves static-portion process caching across repeated calls" do
      stub_per_account("*.tool.example.com")
      expect(Canvas).to receive(:load_config_file_or_consul).once.and_call_original
      3.times { described_class.directives_for(account, request) }
      described_class.directives_for(nil, request)
    end
  end
end

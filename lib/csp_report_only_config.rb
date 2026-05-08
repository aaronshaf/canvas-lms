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

# Globally-applied Content-Security-Policy-Report-Only header. Emitted on
# non-files, non-embeddable Canvas responses when allowed_domains and a
# report_uri are both configured. Inventory mode: report what client-side
# code *would* be blocked under a stricter policy, without breaking pages.
#
# The directive list is the union of:
#   - static allowlist from Consul (process-cached, 5-min TTL)
#   - per-Account allowlist from Account#csp_whitelisted_domains (LTI tool
#     domains, files host, admin-curated Csp::Domain rows, etc.)
module CspReportOnlyConfig
  TTL_SECONDS = 5.minutes.to_i
  # Header-breaking chars: whitespace and `;` would split directives; `,` would
  # split header values when CSP appears alongside other policies.
  HEADER_UNSAFE = /[\s;,]/
  HEADER_BYTES_CAP = 16_384

  Canvas::Reloader.on_reload { reset! }

  def self.static_config
    now = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    return @static_config if @expires_at && now < @expires_at

    @static_config = build_static_config
    @expires_at = now + TTL_SECONDS
    @static_config
  end

  def self.reset!
    @static_config = nil
    @expires_at = nil
  end

  # Returns the directives string for a given Account + request, or nil if the
  # feature is unconfigured. Per-Account failures degrade to static-only rather
  # than nil — we still want the static report stream alive.
  def self.directives_for(account, request)
    cfg = static_config
    return nil unless cfg

    # Subtract static so enforce_size_cap can pop strictly per-Account entries
    # while keeping the static prefix intact.
    per_account = sanitized_per_account_domains(account, request) - cfg[:allowed_domains]
    domains = enforce_size_cap(cfg[:allowed_domains], per_account, cfg[:report_uri])
    format_directives(domains, cfg[:report_uri])
  end

  def self.sanitized_per_account_domains(account, request)
    return [] if account.nil?

    domains = account.csp_whitelisted_domains(request, include_files: true, include_tools: true).compact
    good, bad = domains.partition { |d| !d.match?(HEADER_UNSAFE) }
    bad.each do |d|
      Rails.logger.warn("[csp_report_only] dropping per-account domain with header-breaking chars: #{d.inspect}")
      InstStatsd::Statsd.distributed_increment("csp_report_only.domain_dropped")
    end
    good
  rescue => e
    Canvas::Errors.capture(e, { type: :csp_report_only, account_id: account&.global_id }, :warn)
    []
  end

  def self.enforce_size_cap(static, per_account, report_uri)
    return static.dup if per_account.empty?

    domains = static + per_account
    truncated = 0
    while domains.size > static.size && format_directives(domains, report_uri).bytesize > HEADER_BYTES_CAP
      domains.pop
      truncated += 1
    end
    if truncated > 0
      Rails.logger.warn("[csp_report_only] truncated #{truncated} per-account domain(s) to fit #{HEADER_BYTES_CAP}-byte cap")
      InstStatsd::Statsd.distributed_increment("csp_report_only.header_truncated")
    end
    domains
  end

  def self.format_directives(domains, report_uri)
    sources = ["'self'", *domains].join(" ")
    # Trusted Types directives are emitted in report-only first so the browser collects
    # violation telemetry without blocking. The frontend registers a `default` policy at
    # boot (ui/shared/trusted-types) for sink discovery; per-sink sanitizeHTML wrappers
    # remain the real XSS defense. `dompurify` is allowlisted because DOMPurify
    # auto-registers a policy of that name on first use; without it the report endpoint
    # logs trusted-types-policy violations on every pageload, and the future enforce
    # phase would crash the sanitizer outright.
    "default-src 'unsafe-inline' #{sources}; form-action #{sources}; base-uri 'self'; " \
      "require-trusted-types-for 'script'; trusted-types default dompurify; report-uri #{report_uri};"
  end

  def self.build_static_config
    raw = Canvas.load_config_file_or_consul("csp_report_only", failsafe_cache: true) || {}
    domains = Array(raw["allowed_domains"]).map { |d| d.to_s.strip }.reject(&:empty?)
    report_uri = interpolate_region(raw["report_uri"].to_s.strip)

    return nil if domains.empty? || report_uri.empty?
    return nil if domains.any? { |d| d.match?(HEADER_UNSAFE) } || report_uri.match?(HEADER_UNSAFE)

    if format_directives(domains, report_uri).bytesize > HEADER_BYTES_CAP
      Rails.logger.warn("[csp_report_only] static allowlist exceeds #{HEADER_BYTES_CAP}-byte cap; suppressing header")
      return nil
    end

    { allowed_domains: domains.freeze, report_uri: report_uri.freeze }.freeze
  end

  # `{region}` placeholder in the configured report_uri is replaced with
  # Canvas.region_code (e.g. `iad`, `pdx`) so a single Consul template can drive
  # all regions. Mirrors the Sentry config pattern in lib/sentry_extensions/settings.rb.
  # Returns "" if the placeholder is present but no region_code is available;
  # build_static_config treats that as misconfigured and returns nil.
  def self.interpolate_region(uri)
    return uri unless uri.include?("{region}")

    region = Canvas.region_code
    return "" if region.blank?

    uri.gsub("{region}", region)
  end
  private_class_method :build_static_config, :sanitized_per_account_domains, :enforce_size_cap, :format_directives, :interpolate_region
end

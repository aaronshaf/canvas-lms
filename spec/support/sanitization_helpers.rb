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

module SanitizationHelpers
  # Each payload wraps a benign MARKER in <p> so sanitizer transformations
  # don't strip it — its survival is asserted to detect over-sanitization.
  XSS_PAYLOADS = {
    "script tag" => "<p>MARKER</p><script>alert('xss')</script>",
    "javascript href" => '<p>MARKER</p><a href="javascript:alert(1)">x</a>',
    "data uri href" => '<p>MARKER</p><a href="data:text/html,<script>alert(1)</script>">x</a>',
    "img onerror" => '<p>MARKER</p><img src=x onerror="alert(1)">',
    "svg onload" => '<p>MARKER</p><svg onload="alert(1)"></svg>',
    "iframe srcdoc" => '<p>MARKER</p><iframe srcdoc="<script>alert(1)</script>"></iframe>',
    "mXSS noscript reparse" => %(<p>MARKER</p><noscript><p title="</noscript><img src=x onerror=alert(1)>"></p>),
  }.freeze

  DANGEROUS_PATTERNS = {
    "<script>" => /<script/i,
    "javascript: scheme" => /javascript:/i,
    "event handler attribute" => /\son\w+\s*=/i,
    "srcdoc attribute" => /\ssrcdoc\s*=/i,
  }.freeze

  def expect_sanitization_on_save(record, *fields, payloads: XSS_PAYLOADS)
    payloads.each do |label, payload|
      assign_and_save!(record, fields, payload, label)
      record.reload

      fields.each do |field|
        # Read via [] to bypass getter overrides that re-sanitize on read.
        value = record[field].to_s

        DANGEROUS_PATTERNS.each do |name, pattern|
          expect(value).not_to match(pattern),
                               "[#{record.class}##{field} / #{label}] #{name} survived"
        end

        expect(value).to include("MARKER"),
                         "[#{record.class}##{field} / #{label}] benign marker stripped — over-sanitization"
      end
    end
  end

  private

  def assign_and_save!(record, fields, payload, label)
    fields.each { |f| record[f] = payload }
    return if record.save

    raise "expect_sanitization_on_save: #{record.class} invalid " \
          "for #{fields.join(", ")} (#{label}): #{record.errors.full_messages.join(", ")}"
  end
end

RSpec.configure { |c| c.include SanitizationHelpers }

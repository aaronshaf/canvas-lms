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

describe "HTML allowlist drift between RCE and backend sanitizer" do
  let(:rce_allowlist_json_path) { Rails.root.join("packages/canvas-rce/src/rce_allowlist.json") }

  def parse_rce_section(section)
    elements = []
    attributes = {}

    section.each do |raw_key, raw_attrs|
      tag_key = (raw_key == "@") ? :all : raw_key.gsub(/\A[#-]/, "")
      tags    = tag_key.is_a?(Symbol) ? [tag_key] : tag_key.split("/")

      normalized_attrs = raw_attrs.map do |entry|
        next entry.keys.first if entry.is_a?(Hash)

        entry.gsub("::", ":").gsub(/<[^>]*/, "")
      end

      tags.each do |tag|
        elements << tag.to_s unless tag == :all || elements.include?(tag.to_s)
        attributes[tag] = normalized_attrs
      end
    end

    { elements:, attributes: }
  end

  def rce_config
    rce_raw = JSON.parse(File.read(rce_allowlist_json_path))

    valid    = parse_rce_section(rce_raw["valid_elements"])
    extended = parse_rce_section(rce_raw["extended_valid_elements"])

    elements   = (valid[:elements] + extended[:elements]).uniq
    attributes = valid[:attributes].merge(extended[:attributes])
    attributes[:all] = ((valid[:attributes][:all] || []) + (extended[:attributes][:all] || [])).uniq

    { elements:, attributes: }
  end

  it "RCE does not allow any tag or attribute that the backend would strip" do
    rce = rce_config
    ruby_elements   = CanvasSanitize::SANITIZE[:elements]
    ruby_attributes = CanvasSanitize::SANITIZE[:attributes]
    ruby_has_data_wildcard = ruby_attributes[:all].include?(:data)
    ruby_global_attrs = ruby_attributes[:all].reject { |a| a == :data }

    violations = []

    rce[:elements].each do |tag|
      unless ruby_elements.include?(tag)
        violations << "<#{tag}> allowed by RCE but not by backend"
        next
      end

      ruby_effective_attrs = Set.new(ruby_global_attrs + (ruby_attributes[tag] || []))
      rce_effective_attrs  = Set.new(rce[:attributes][:all] + (rce[:attributes][tag] || []))

      rce_effective_attrs.each do |attr|
        next if attr == "data-*"
        next if attr.start_with?("data-") && ruby_has_data_wildcard
        next if ruby_effective_attrs.include?(attr)

        violations << %(<#{tag} #{attr}="..."> allowed by RCE but backend strips "#{attr}" on <#{tag}>)
      end
    end

    expect(violations).to be_empty,
                          <<~TEXT
                            RCE allowlist has drifted past the backend sanitizer.
                            See doc/security/rce_vs_canvas_sanitize.md for context.

                            The following are allowed by the RCE editor but would be stripped by the backend on save:

                            #{violations.map { |v| "  • #{v}" }.join("\n")}
                          TEXT
  end
end

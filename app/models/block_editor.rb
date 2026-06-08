# frozen_string_literal: true

#
# Copyright (C) 2024 - present Instructure, Inc.
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

class BlockEditor < ApplicationRecord
  belongs_to :context, polymorphic: [:wiki_page]
  before_validation :sanitize_blocks
  before_create :set_root_account_id

  alias_attribute :version, :editor_version

  LATEST_VERSION = "0.2"

  HTML_SINK_FIELDS = {
    "TextBlock" => %w[content],
    "ImageTextBlock" => %w[content]
  }.freeze

  # URL schemes that can execute script when used as a link target. These are
  # blanked; everything else (http, https, relative, mailto, tel, ...) is kept.
  # Mirrors the frontend allowlist in canvas-rce's sanitizeUrl, which neutralizes
  # the same schemes (data:, vbscript:, blob:, javascript:) to about:blank.
  EXECUTABLE_URL_SCHEMES = %w[javascript data vbscript blob].freeze

  def set_root_account_id
    self.root_account_id = context&.root_account_id unless root_account_id
  end

  IFRAME_STYLE_CSS = "html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; } " \
                     "iframe.block_editor_view { height: 100%; }"

  def viewer_iframe_html
    helpers = ActionController::Base.helpers
    style = helpers.tag.style(IFRAME_STYLE_CSS)
    iframe = helpers.tag.iframe(
      "",
      class: "block_editor_view",
      src: Rails.application.routes.url_helpers.block_editor_path(id),
      sandbox: "allow-scripts"
    )
    helpers.safe_join([style, iframe])
  end

  private

  def sanitize_blocks
    return unless blocks_changed? && blocks.is_a?(Hash)

    blocks.each_value do |node|
      next unless node.is_a?(Hash) && node["type"].is_a?(Hash)

      props = node["props"]
      next unless props.is_a?(Hash)

      resolved_name = node.dig("type", "resolvedName")

      HTML_SINK_FIELDS[resolved_name]&.each do |field|
        value = props[field]
        props[field] = Sanitize.fragment(value, CanvasSanitize::SANITIZE) if value.is_a?(String) && value.include?("<")
      end

      sanitize_block_urls(resolved_name, props)
    end
  end

  # URL sanitization is block-specific: each block stores its links in its own
  # shape, so there is no general URL sink we can apply across blocks. Add a
  # `when` branch (and helper) per block that has link props.
  def sanitize_block_urls(resolved_name, props)
    case resolved_name
    when "ButtonBlock"
      sanitize_button_block_urls(props)
    end
  end

  def sanitize_button_block_urls(props)
    Array(props["buttons"]).each do |button|
      next unless button.is_a?(Hash) && button["url"].is_a?(String)

      button["url"] = "" if executable_url?(button["url"])
    end
  end

  def executable_url?(url)
    # Browsers strip tab/newline/CR anywhere in a URL before parsing, so remove
    # them (and any leading control/space chars) before reading the scheme.
    cleaned = url.gsub(/[\t\n\r]/, "").sub(/\A[\x00-\x20]+/, "")
    # This will return the schema: http/https/mailto/javascript and others
    scheme = cleaned[/\A([a-z][a-z0-9+.-]*):/i, 1]
    !scheme.nil? && EXECUTABLE_URL_SCHEMES.include?(scheme.downcase)
  end
end

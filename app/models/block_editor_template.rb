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

class BlockEditorTemplate < ApplicationRecord
  include Workflow

  TEMPLATE_TYPES = %w[block section page].freeze
  MAX_NODE_TREE_DEPTH = 50
  MAX_NODE_TREE_NODES = 10_000
  DANGEROUS_URL_SCHEMES = /\A[\x00-\x20]*(?:javascript|vbscript|data|file|blob):/i

  THUMBNAIL_MAX_LENGTH = 4096
  THUMBNAIL_DATA_URI_REGEX = %r{\Adata:image/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+\z}
  THUMBNAIL_RELATIVE_REGEX = %r{\A/[A-Za-z0-9\-._~?#\[\]@!$&*+,=%][A-Za-z0-9\-._~/?#\[\]@!$&*+,=%]*\z}
  THUMBNAIL_FORBIDDEN_CHARS = /[()'"\s;\\]/
  private_constant :THUMBNAIL_MAX_LENGTH,
                   :THUMBNAIL_DATA_URI_REGEX,
                   :THUMBNAIL_RELATIVE_REGEX,
                   :THUMBNAIL_FORBIDDEN_CHARS

  belongs_to :context, polymorphic: %i[account course user]
  before_validation :sanitize_content
  before_create :set_root_account_id

  validates :name, presence: true, length: { maximum: 255 }
  validates :description, length: { maximum: 255 }
  validates :editor_version, presence: true, length: { maximum: 255 }
  validates :template_type, presence: true, inclusion: { in: TEMPLATE_TYPES }
  validate :node_tree_structure
  validate :validate_thumbnail

  def set_root_account_id
    self.root_account_id = context&.root_account_id unless root_account_id
  end

  def active?
    workflow_state == "active"
  end

  def self.name_order_by_clause
    best_unicode_collation_key("block_editor_templates.name")
  end

  workflow do
    state :unpublished do
      event :publish, transitions_to: :active
    end
    state :active do
      event :unpublish, transitions_to: :unpublished
    end
    state :deleted
  end
  include Canvas::SoftDeletable

  alias_method :published?, :active?

  private

  def sanitize_content
    if name_changed? && name.is_a?(String)
      self.name = Sanitize.clean(name, Sanitize::Config::RESTRICTED).strip
    end
    if description_changed? && description.is_a?(String)
      self.description = Sanitize.clean(description, Sanitize::Config::RESTRICTED).strip
    end
    if node_tree_changed? && node_tree.is_a?(Hash)
      self.node_tree = deep_sanitize(node_tree)
    end
  end

  def deep_sanitize(value)
    case value
    when Hash
      value.transform_values { |v| deep_sanitize(v) }
    when Array
      value.map { |v| deep_sanitize(v) }
    when String
      sanitize_scalar(value)
    else
      value
    end
  end

  def sanitize_scalar(str)
    cleaned = str.include?("<") ? Sanitize.clean(str, CanvasSanitize::SANITIZE) : str
    cleaned.match?(DANGEROUS_URL_SCHEMES) ? "" : cleaned
  end

  def node_tree_structure
    return unless new_record? || node_tree_changed?

    unless node_tree.is_a?(Hash)
      errors.add(:node_tree, t("errors.node_tree_not_object", "Node tree must be a JSON object"))
      return
    end

    count = 0
    stack = [[node_tree, 1]]
    until stack.empty?
      current, depth = stack.pop
      count += 1
      if count > MAX_NODE_TREE_NODES
        errors.add(:node_tree, t("errors.node_tree_too_many_nodes", "Node tree exceeds maximum of %{max} nodes", max: MAX_NODE_TREE_NODES))
        return
      end
      if depth > MAX_NODE_TREE_DEPTH
        errors.add(:node_tree, t("errors.node_tree_too_deep", "Node tree exceeds maximum depth of %{max}", max: MAX_NODE_TREE_DEPTH))
        return
      end
      case current
      when Hash
        current.each_value { |v| stack.push([v, depth + 1]) }
      when Array
        current.each { |v| stack.push([v, depth + 1]) }
      end
    end
  end

  def validate_thumbnail
    return if thumbnail.blank?

    if thumbnail.length > THUMBNAIL_MAX_LENGTH
      errors.add(:thumbnail, "is too long")
      return
    end

    return if thumbnail.match?(THUMBNAIL_DATA_URI_REGEX)

    if THUMBNAIL_FORBIDDEN_CHARS.match?(thumbnail)
      errors.add(:thumbnail, "contains forbidden characters")
      return
    end

    return if thumbnail.match?(THUMBNAIL_RELATIVE_REGEX)
    return if valid_https_thumbnail_url?

    errors.add(:thumbnail, "must be an https URL, relative path, or data:image URI")
  end

  def valid_https_thumbnail_url?
    CanvasHttp.validate_url(thumbnail, allowed_schemes: %w[https])
    true
  rescue CanvasHttp::Error, URI::Error, ArgumentError
    false
  end
end

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

  THUMBNAIL_MAX_LENGTH = 4096
  THUMBNAIL_DATA_URI_REGEX = %r{\Adata:image/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+\z}
  THUMBNAIL_RELATIVE_REGEX = %r{\A/[A-Za-z0-9\-._~?#\[\]@!$&*+,=%][A-Za-z0-9\-._~/?#\[\]@!$&*+,=%]*\z}
  THUMBNAIL_FORBIDDEN_CHARS = /[()'"\s;\\]/
  private_constant :THUMBNAIL_MAX_LENGTH,
                   :THUMBNAIL_DATA_URI_REGEX,
                   :THUMBNAIL_RELATIVE_REGEX,
                   :THUMBNAIL_FORBIDDEN_CHARS

  belongs_to :context, polymorphic: %i[account course user]
  before_create :set_root_account_id
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

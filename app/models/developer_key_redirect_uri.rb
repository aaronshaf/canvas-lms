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

class DeveloperKeyRedirectUri < ApplicationRecord
  MAX_ACTIVE = 64
  DEACTIVATE_GRACE_PERIOD = 90.days
  DELETE_GRACE_PERIOD = 1.year

  include Workflow

  belongs_to :developer_key, inverse_of: :developer_key_redirect_uris
  belongs_to :root_account, class_name: "Account"

  before_save :set_root_account

  validates :redirect_uri, presence: true, length: { maximum: 255 }
  validate :validate_redirect_uri_format
  validate :enforce_active_limit

  workflow do
    state :active do
      event :deactivate, transitions_to: :inactive
    end
    state :inactive do
      event :activate, transitions_to: :active
    end
    state :deleted do
      event :activate, transitions_to: :active
    end
  end

  scope :active, -> { where(workflow_state: "active") }
  scope :inactive, -> { where(workflow_state: "inactive") }
  scope :deleted, -> { where(workflow_state: "deleted") }
  scope :not_active, -> { where.not(workflow_state: "active") }
  scope :not_deleted, -> { where.not(workflow_state: "deleted") }
  scope :lenient, -> { where(lenient: true) }
  scope :strict, -> { where(lenient: false) }

  class << self
    def cleanup_stale_records
      now = Time.zone.now
      active.where(last_used_at: ...DEACTIVATE_GRACE_PERIOD.ago)
            .in_batches
            .update_all(workflow_state: "inactive", updated_at: now)
      inactive.where(updated_at: ...DELETE_GRACE_PERIOD.ago)
              .in_batches
              .update_all(workflow_state: "deleted", updated_at: now)
      deleted.where(updated_at: ...DELETE_GRACE_PERIOD.ago)
             .in_batches
             .delete_all
    end
  end

  alias_method :destroy_permanantly!, :destroy

  def destroy
    return true if deleted?

    self.workflow_state = "deleted"
    save!
  end

  private

  def set_root_account
    self.root_account_id ||= developer_key&.root_account_id || developer_key&.account&.resolved_root_account_id
  end

  def validate_redirect_uri_format
    return if redirect_uri.blank?
    return if redirect_uri == Canvas::OAuth::Provider::OAUTH2_OOB_URI

    CanvasHttp.validate_url(redirect_uri, allowed_schemes: nil)
  rescue CanvasHttp::Error, URI::Error, ArgumentError
    errors.add(:redirect_uri, "is not a valid URI")
  end

  def enforce_active_limit
    return unless active?

    scope = developer_key.developer_key_redirect_uris.active
    scope = scope.where.not(id:) if persisted?

    if scope.count >= MAX_ACTIVE
      errors.add(:base, "Developer keys cannot have more than #{MAX_ACTIVE} active redirect URIs")
    end
  end
end

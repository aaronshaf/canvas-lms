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

# An institution's security contact. History lives in this table:
# at most one +active+ row per (account, kind), prior values kept as +historic+
# rows. Editing inserts a new active row and retires the old one rather than
# mutating in place, so created_by records who set each value.
class SecurityContact < ApplicationRecord
  include Workflow

  belongs_to :account, optional: false
  belongs_to :root_account, class_name: "Account", optional: false
  belongs_to :created_by, class_name: "User", optional: true

  before_validation :set_root_account_id, on: :create

  KINDS = %w[primary secondary].freeze

  validates :email, presence: true, length: { maximum: 255 }
  validates :name, :title, :phone_number, length: { maximum: 255 }, allow_blank: true
  validates :kind, inclusion: { in: KINDS }
  validate :validate_email_deliverable

  workflow do
    state :active
    state :historic
  end

  scope :active, -> { where(workflow_state: "active") }
  scope :historic, -> { where(workflow_state: "historic") }
  scope :primary, -> { where(kind: "primary") }
  scope :secondary, -> { where(kind: "secondary") }

  private

  def set_root_account_id
    self.root_account_id ||= account&.resolved_root_account_id
  end

  def validate_email_deliverable
    return if email.blank?

    unless EmailAddressValidator.deliverable?(email)
      errors.add(:email, t("is not a valid or deliverable email address"))
    end
  end
end

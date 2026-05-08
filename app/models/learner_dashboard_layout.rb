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

class LearnerDashboardLayout < ApplicationRecord
  include Canvas::SoftDeletable

  belongs_to :account, optional: false
  belongs_to :root_account, class_name: "Account", optional: false

  has_one :external_content_reference, dependent: :destroy, inverse_of: :learner_dashboard_layout
  has_many :learner_dashboard_activations, dependent: :destroy

  before_validation :set_root_account_id, on: :create

  validates :name, presence: true, length: { maximum: 255 }

  private

  def set_root_account_id
    self.root_account_id ||= account&.resolved_root_account_id
  end
end

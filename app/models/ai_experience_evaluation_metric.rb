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

class AiExperienceEvaluationMetric < ApplicationRecord
  belongs_to :ai_experience
  belongs_to :root_account, class_name: "Account"

  acts_as_list scope: :ai_experience_id

  validates :ai_experience, presence: true
  validates :name,
            presence: true,
            length: { maximum: 255 },
            format: { with: /\A[^\r\n\t]+\z/ }
  validates :name, uniqueness: { scope: :ai_experience_id }
  validates :description,
            presence: true,
            length: { minimum: 10, maximum: 1000 },
            format: { with: /\A[^\r\n\t]+\z/ }

  before_validation :set_root_account

  private

  def set_root_account
    self.root_account_id ||= ai_experience&.root_account_id
  end
end

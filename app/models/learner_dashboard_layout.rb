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

  FILES_PARENT_FOLDER_NAME = "learner-dashboards"

  belongs_to :account, optional: false
  belongs_to :root_account, class_name: "Account", optional: false

  has_one :external_content_reference, dependent: :destroy, inverse_of: :learner_dashboard_layout
  has_many :learner_dashboard_activations, dependent: :destroy

  before_validation :set_root_account_id, on: :create
  before_destroy :delete_associated_files

  validates :name, presence: true, length: { maximum: 255 }

  scope :visible_to_account, ->(acct) { active.where(account_id: [acct.id] + Account.sub_account_ids_recursive(acct.id)) }

  def create_block_editor_data(user_uuid:, data:)
    response = Canvas.retriable(tries: content_service_max_retries) do
      ContentServiceClient.create_content(
        root_account_uuid: root_account.uuid,
        user_uuid:,
        context_type: "LearnerDashboardLayout",
        context_id: id,
        data:
      )
    end
    create_external_content_reference(content_id: response.external_content_id)
  end

  def update_block_editor_data(user_uuid:, data:)
    ref = external_content_reference
    if ref
      Canvas.retriable(tries: content_service_max_retries) do
        ContentServiceClient.update_content(
          root_account_uuid: root_account.uuid,
          user_uuid:,
          external_content_id: ref.content_id,
          data:
        )
      end
    else
      create_block_editor_data(user_uuid:, data:)
    end
  end

  def get_block_editor_data(user_uuid:)
    ref = external_content_reference
    return unless ref

    content = Canvas.retriable(tries: content_service_max_retries) do
      ContentServiceClient.get_content(
        root_account_uuid: root_account.uuid,
        user_uuid:,
        external_content_id: ref.content_id
      )
    end
    content.data
  end

  def delete_block_editor_data(user_uuid:)
    ref = external_content_reference
    return unless ref

    Canvas.retriable(tries: content_service_max_retries) do
      ContentServiceClient.delete_content(
        root_account_uuid: root_account.uuid,
        user_uuid:,
        external_content_id: ref.content_id
      )
    end
    ref.destroy
  end

  private

  def delete_associated_files
    folder = Folder.resolve_path(account, "#{FILES_PARENT_FOLDER_NAME}/#{id}")&.last
    folder&.destroy
  end

  def content_service_max_retries
    Setting.get("content_service_client_max_retries", "3").to_i
  end

  def set_root_account_id
    self.root_account_id ||= account&.resolved_root_account_id
  end
end

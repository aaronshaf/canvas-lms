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

module Api::V1::LearnerDashboardLayout
  def learner_dashboard_layout_json(layout, current_user, _session, include_block_editor_data: false)
    hash = {
      id: layout.id,
      name: layout.name,
      account_id: layout.account_id,
      workflow_state: layout.workflow_state,
      created_at: layout.created_at&.iso8601,
      updated_at: layout.updated_at&.iso8601
    }

    if include_block_editor_data
      block_editor_data = layout.get_block_editor_data(user_uuid: current_user.uuid)
      hash[:block_editor_data] = block_editor_data
      hash[:file_access_verifiers] = learner_dashboard_file_access_verifiers(block_editor_data)
    end

    hash
  end

  def learner_dashboard_file_access_verifiers(block_editor_data)
    attachment_ids = collect_learner_dashboard_attachment_ids(block_editor_data)
    return {} if attachment_ids.empty?

    expires = Setting.get("learner_dashboard_file_verifier_ttl_minutes", "120").to_i.minutes.from_now

    Attachment.where(id: attachment_ids).to_h do |attachment|
      [attachment.id.to_s, Attachments::Verification.new(attachment).verifier_for_user(nil, expires:)]
    end
  end

  def collect_learner_dashboard_attachment_ids(data, acc = [])
    case data
    when Hash
      data.each do |key, value|
        if key.to_s == "asset_id" && value.present?
          acc << value
        else
          collect_learner_dashboard_attachment_ids(value, acc)
        end
      end
    when Array
      data.each { |item| collect_learner_dashboard_attachment_ids(item, acc) }
    end
    acc.uniq
  end
end

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
      hash[:block_editor_data] = layout.get_block_editor_data(user_uuid: current_user.uuid)
    end

    hash
  end
end

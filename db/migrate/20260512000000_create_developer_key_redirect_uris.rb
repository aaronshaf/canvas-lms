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
class CreateDeveloperKeyRedirectUris < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :developer_key_redirect_uris do |t|
      t.references :developer_key, null: false, foreign_key: true, index: false
      t.string :redirect_uri, null: false, limit: 255
      t.datetime :last_used_at
      t.string :workflow_state, default: "active", null: false, limit: 255
      t.boolean :lenient, default: false, null: false
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.timestamps

      t.check_constraint "workflow_state IN ('active', 'inactive', 'deleted')", name: "chk_workflow_state_enum"

      t.replica_identity_index
      t.index %i[developer_key_id redirect_uri], unique: true
    end
  end
end

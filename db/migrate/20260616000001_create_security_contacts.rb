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

class CreateSecurityContacts < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :security_contacts do |t|
      t.references :account, null: false, foreign_key: true, index: true
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :created_by, foreign_key: { to_table: :users }, index: { where: "created_by_id IS NOT NULL" }
      t.string :email, null: false, limit: 255
      t.string :name, limit: 255
      t.string :title, limit: 255
      t.string :phone_number, limit: 255
      t.string :kind, null: false, default: "primary", limit: 255
      t.string :workflow_state, null: false, default: "active", limit: 255
      t.timestamps

      t.check_constraint "workflow_state IN ('active', 'historic')", name: "chk_security_contacts_workflow_state"
      t.check_constraint "kind IN ('primary', 'secondary')", name: "chk_security_contacts_kind"
      # At most one current contact per account per kind; historic rows are unconstrained.
      t.index %i[account_id kind],
              unique: true,
              where: "workflow_state = 'active'",
              name: "index_security_contacts_on_active_account_and_kind"
      t.replica_identity_index
    end
  end
end

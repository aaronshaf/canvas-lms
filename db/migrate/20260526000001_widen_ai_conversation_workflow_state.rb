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

# Widens the workflow_state constraint to accept the new 'ended' value
# alongside the legacy 'completed' value. The backfill and constraint
# narrowing (removing 'completed') run postdeploy in migration 20260526000002
# once no server is writing 'completed' anymore.
class WidenAiConversationWorkflowState < ActiveRecord::Migration[8.0]
  tag :predeploy
  disable_ddl_transaction!

  def up
    unless check_constraint_exists?(:ai_conversations, name: "chk_workflow_state_enum_old")
      execute("ALTER TABLE #{connection.quote_table_name(:ai_conversations)} RENAME CONSTRAINT chk_workflow_state_enum TO chk_workflow_state_enum_old")
    end

    add_check_constraint :ai_conversations,
                         "workflow_state IN ('active', 'ended', 'completed', 'deleted')",
                         name: "chk_workflow_state_enum",
                         validate: false

    validate_constraint :ai_conversations, :chk_workflow_state_enum
    remove_check_constraint :ai_conversations, name: "chk_workflow_state_enum_old"

    add_column :ai_conversations, :all_objectives_met, :boolean, default: false, null: false, if_not_exists: true
  end

  def down
    remove_column :ai_conversations, :all_objectives_met, if_exists: true

    unless check_constraint_exists?(:ai_conversations, name: "chk_workflow_state_enum_old")
      execute("ALTER TABLE #{connection.quote_table_name(:ai_conversations)} RENAME CONSTRAINT chk_workflow_state_enum TO chk_workflow_state_enum_old")
    end

    add_check_constraint :ai_conversations,
                         "workflow_state IN ('active', 'completed', 'deleted')",
                         name: "chk_workflow_state_enum",
                         validate: false

    validate_constraint :ai_conversations, :chk_workflow_state_enum
    remove_check_constraint :ai_conversations, name: "chk_workflow_state_enum_old"
  end
end

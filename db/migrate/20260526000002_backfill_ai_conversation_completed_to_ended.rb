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

# Backfills legacy 'completed' rows to 'ended' and narrows the constraint.
# Runs postdeploy — by this point no server writes 'completed' anymore, so
# the UPDATE sees a quiet table and the new narrow constraint is immediately valid.
class BackfillAiConversationCompletedToEnded < ActiveRecord::Migration[8.0]
  tag :postdeploy
  disable_ddl_transaction!

  def up
    unless check_constraint_exists?(:ai_conversations, name: "chk_workflow_state_enum_old")
      execute("ALTER TABLE #{connection.quote_table_name(:ai_conversations)} RENAME CONSTRAINT chk_workflow_state_enum TO chk_workflow_state_enum_old")
    end

    add_check_constraint :ai_conversations,
                         "workflow_state IN ('active', 'ended', 'deleted')",
                         name: "chk_workflow_state_enum",
                         validate: false

    AiConversation.where(workflow_state: "completed").in_batches.update_all(workflow_state: "ended")

    validate_constraint :ai_conversations, :chk_workflow_state_enum
    remove_check_constraint :ai_conversations, name: "chk_workflow_state_enum_old"
  end

  def down
    unless check_constraint_exists?(:ai_conversations, name: "chk_workflow_state_enum_old")
      execute("ALTER TABLE #{connection.quote_table_name(:ai_conversations)} RENAME CONSTRAINT chk_workflow_state_enum TO chk_workflow_state_enum_old")
    end

    add_check_constraint :ai_conversations,
                         "workflow_state IN ('active', 'ended', 'completed', 'deleted')",
                         name: "chk_workflow_state_enum",
                         validate: false

    validate_constraint :ai_conversations, :chk_workflow_state_enum
    remove_check_constraint :ai_conversations, name: "chk_workflow_state_enum_old"
  end
end

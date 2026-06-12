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

# rubocop:disable Migration/Predeploy
class AddPartialIndexAssignmentsOnIdAndContextId < ActiveRecord::Migration[8.0]
  tag :postdeploy
  disable_ddl_transaction!

  def up
    add_index :assignments,
              %i[id context_id],
              name: "index_assignments_on_id_and_context_id",
              where: "context_type = 'Course' AND workflow_state NOT IN ('deleted', 'unpublished') AND submission_types <> 'not_graded'",
              algorithm: :concurrently,
              if_not_exists: true
  end

  def down
    remove_index :assignments,
                 name: "index_assignments_on_id_and_context_id",
                 algorithm: :concurrently,
                 if_exists: true
  end
end
# rubocop:enable Migration/Predeploy

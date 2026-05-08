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

class AddLearnerDashboardLayoutToExternalContentReferences < ActiveRecord::Migration[8.0]
  tag :predeploy
  disable_ddl_transaction!

  def up
    add_reference :external_content_references,
                  :learner_dashboard_layout,
                  foreign_key: { to_table: :learner_dashboard_layouts },
                  null: true,
                  index: { algorithm: :concurrently, where: "learner_dashboard_layout_id IS NOT NULL", if_not_exists: true },
                  if_not_exists: true

    change_column_null :external_content_references, :wiki_page_id, true

    add_polymorphic_check_constraint(
      :external_content_references,
      :context,
      %i[learner_dashboard_layout wiki_page],
      null: false,
      replace: true
    )
  end

  def down
    remove_reference :external_content_references,
                     :learner_dashboard_layout,
                     foreign_key: { to_table: :learner_dashboard_layouts },
                     if_exists: true

    change_column_null :external_content_references, :wiki_page_id, false

    add_polymorphic_check_constraint(
      :external_content_references,
      :context,
      %i[wiki_page],
      null: false,
      replace: true
    )
  end
end

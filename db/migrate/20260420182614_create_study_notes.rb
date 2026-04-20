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
class CreateStudyNotes < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :study_notes do |t|
      t.references :user, null: false, foreign_key: true, index: false
      t.references :course, null: false, foreign_key: true
      t.references :root_account, null: false, foreign_key: { to_table: :accounts }, index: false
      t.references :learning_object,
                   polymorphic: %i[wiki_page assignment quiz],
                   null: false,
                   foreign_key: true
      t.text :user_text
      t.string :reaction, array: true, null: false, default: []
      t.jsonb :highlight_data, null: false, default: {}
      t.string :redwood_uuid, limit: 255
      t.string :workflow_state, null: false, default: "active", limit: 255
      t.timestamps

      t.check_constraint "workflow_state IN ('active', 'deleted')", name: "chk_workflow_state_enum"

      t.index %i[user_id course_id wiki_page_id],
              where: "wiki_page_id IS NOT NULL",
              name: "index_study_notes_on_user_course_wiki_page"
      t.index %i[user_id course_id assignment_id],
              where: "assignment_id IS NOT NULL",
              name: "index_study_notes_on_user_course_assignment"
      t.index %i[user_id course_id quiz_id],
              where: "quiz_id IS NOT NULL",
              name: "index_study_notes_on_user_course_quiz"
      t.index %i[user_id course_id created_at],
              name: "index_study_notes_on_user_course_created_at"
      t.index :redwood_uuid,
              unique: true,
              where: "redwood_uuid IS NOT NULL",
              name: "index_study_notes_on_redwood_uuid"
      t.index :reaction,
              using: :gin,
              name: "index_study_notes_on_reaction"

      t.replica_identity_index
    end
  end
end

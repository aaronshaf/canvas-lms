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

class CreateInboxTranslationFeedback < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :inbox_translation_feedback do |t|
      t.references :root_account, foreign_key: { to_table: :accounts }, index: false, null: false
      t.references :user, null: false, foreign_key: true
      t.string :target_language, null: false, limit: 16
      t.boolean :liked, default: false, null: false
      t.boolean :disliked, default: false, null: false
      t.text :feedback_notes
      t.timestamps

      t.replica_identity_index
      t.check_constraint "NOT (liked AND disliked)", name: "chk_inbox_translation_feedback_liked_disliked"
    end
  end
end

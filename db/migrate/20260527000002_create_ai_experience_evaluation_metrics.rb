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

class CreateAiExperienceEvaluationMetrics < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    create_table :ai_experience_evaluation_metrics do |t|
      t.references :ai_experience, null: false, foreign_key: true
      t.references :root_account, foreign_key: { to_table: :accounts }, index: false, null: false
      t.string :name, null: false, limit: 255
      t.boolean :enabled, null: false, default: true
      t.boolean :visible_to_learners, null: false, default: false
      t.integer :position, null: false
      t.timestamps
      t.replica_identity_index

      t.index [:ai_experience_id, :position], unique: true, name: "index_ai_exp_eval_metrics_on_exp_and_position"
      t.index [:ai_experience_id, :name], unique: true, name: "index_ai_exp_eval_metrics_on_exp_and_name"
    end
  end
end

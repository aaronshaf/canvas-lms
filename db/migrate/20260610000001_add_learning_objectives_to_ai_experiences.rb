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

class AddLearningObjectivesToAiExperiences < ActiveRecord::Migration[8.0]
  tag :predeploy

  def change
    # Replace the single learning_objective string with a learning_objectives
    # array. The old column stays (now nullable) during the transition and is
    # dropped in a follow-up once all code reads/writes the new column.
    change_table :ai_experiences, bulk: true do |t|
      # limit mirrors the model's per-item cap (TEACHER_AUTHORED_FIELD_MAX).
      t.string :learning_objectives, array: true, null: false, default: [], limit: 10_000
      t.change_null :learning_objective, true
    end
  end
end

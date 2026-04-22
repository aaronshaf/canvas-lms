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

class Mutations::DeleteStudyNote < Mutations::StudyNoteMutationBase
  argument :id, ID, required: false, prepare: GraphQLHelpers.relay_or_legacy_id_prepare_func("StudyNote")
  argument :redwood_uuid, String, required: false

  field :study_note_id, ID, null: false

  def resolve(input:)
    record = find_record!(input)
    check_feature_access!(record.course)

    context[:deleted_models] ||= {}
    context[:deleted_models][:study_note] = record

    record.destroy
    { study_note_id: record.id }
  end

  def self.study_note_id_log_entry(_entry, context)
    context[:deleted_models][:study_note]
  end
end
